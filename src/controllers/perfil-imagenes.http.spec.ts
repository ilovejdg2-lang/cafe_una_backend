import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { mkdtemp, readdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import type { Server } from 'http';
import { join } from 'path';
import request from 'supertest';
import sharp from 'sharp';
import { PerfilImagenesController } from './perfil-imagenes.controller';
import {
  MAX_PROFILE_IMAGE_BYTES,
  PerfilImagenStorage,
} from '../services/perfil-imagen.storage';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { HttpExceptionFilter } from '../common/http-exception.filter';
import { PERMISOS_KEY } from '../common/requiere-permiso.decorator';

describe('authenticated profile images HTTP', () => {
  let app: INestApplication<Server>;
  let directory: string;
  let image: Buffer;
  let role = 'Cliente';
  let actorId = 44;

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'cafe-perfil-http-'));
    image = await sharp({
      create: { width: 2, height: 2, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer();
    const module = await Test.createTestingModule({
      controllers: [PerfilImagenesController],
      providers: [
        {
          provide: PerfilImagenStorage,
          useValue: new PerfilImagenStorage(directory),
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => {
            getRequest: () => {
              headers: Record<string, string>;
              user?: unknown;
            };
          };
        }) => {
          const req = context.switchToHttp().getRequest();
          if (req.headers.authorization !== 'Bearer local-test')
            throw new UnauthorizedException();
          req.user = { userId: actorId, roles: [role] };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication<INestApplication<Server>>();
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  beforeEach(() => {
    role = 'Cliente';
    actorId = 44;
  });

  afterAll(async () => {
    await app?.close();
    if (directory?.startsWith(join(tmpdir(), 'cafe-perfil-http-')))
      await rm(directory, { recursive: true, force: true });
  });

  it('accepts a real image and permits another authenticated reader without public caching', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/perfil/imagenes')
      .set('Authorization', 'Bearer local-test')
      .attach('imagen', image, {
        filename: '../../avatar.txt',
        contentType: 'text/plain',
      })
      .expect('Cache-Control', 'private, no-store')
      .expect('X-Content-Type-Options', 'nosniff')
      .expect(201);
    const body = response.body as { url: string };
    expect(Object.keys(body)).toEqual(['url']);
    expect(body.url).toMatch(/^\/api\/perfil\/imagenes\/[a-f0-9-]+\.webp$/);
    actorId = 55;
    const read = await request(app.getHttpServer())
      .get(body.url)
      .set('Authorization', 'Bearer local-test')
      .expect('Content-Type', 'image/webp')
      .expect('Cache-Control', 'private, no-store')
      .expect('X-Content-Type-Options', 'nosniff')
      .expect(200);
    expect((await sharp(read.body as Buffer).metadata()).format).toBe('webp');
  });

  it.each(['post', 'get'] as const)(
    'authenticates %s before file or path validation',
    async (method) => {
      const url =
        '/api/perfil/imagenes' + (method === 'get' ? '/not-a-name' : '');
      await request(app.getHttpServer())
        [method](url)
        .expect('Cache-Control', 'private, no-store')
        .expect('X-Content-Type-Options', 'nosniff')
        .expect(401);
    },
  );

  it.each(['post', 'get'] as const)(
    'rejects an authenticated role without permissions on %s',
    async (method) => {
      role = 'NoAccess';
      const url =
        '/api/perfil/imagenes' + (method === 'get' ? '/not-a-name' : '');
      await request(app.getHttpServer())
        [method](url)
        .set('Authorization', 'Bearer local-test')
        .expect('Cache-Control', 'private, no-store')
        .expect(403);
    },
  );

  it('declares separate own-profile write and read permissions', () => {
    expect(
      Reflect.getMetadata(
        PERMISOS_KEY,
        Object.getOwnPropertyDescriptor(
          PerfilImagenesController.prototype,
          'subirImagen',
        )?.value as object,
      ),
    ).toEqual(['actualizar_perfil_propio']);
    expect(
      Reflect.getMetadata(
        PERMISOS_KEY,
        Object.getOwnPropertyDescriptor(
          PerfilImagenesController.prototype,
          'servirImagen',
        )?.value as object,
      ),
    ).toEqual(['ver_perfil_propio']);
  });

  it('rejects missing, wrong-field and extra files', async () => {
    for (const field of ['', 'archivo', 'extra']) {
      const call = request(app.getHttpServer())
        .post('/api/perfil/imagenes')
        .set('Authorization', 'Bearer local-test');
      if (field === 'extra')
        call.attach('imagen', image, 'a.png').attach('imagen', image, 'b.png');
      else if (field) call.attach(field, image, 'a.png');
      await call.expect('Cache-Control', 'private, no-store').expect(400);
    }
  });

  it('rejects oversized multipart input before persisting it', async () => {
    const before = await readdir(directory);
    await request(app.getHttpServer())
      .post('/api/perfil/imagenes')
      .set('Authorization', 'Bearer local-test')
      .attach('imagen', Buffer.alloc(MAX_PROFILE_IMAGE_BYTES + 1), 'large.png')
      .expect('Cache-Control', 'private, no-store')
      .expect(413);
    expect(await readdir(directory)).toEqual(before);
  });

  it('rejects forged image bytes with safe errors', async () => {
    const before = await readdir(directory);
    const response = await request(app.getHttpServer())
      .post('/api/perfil/imagenes')
      .set('Authorization', 'Bearer local-test')
      .attach(
        'imagen',
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
        'avatar.png',
      )
      .expect('Cache-Control', 'private, no-store')
      .expect(400);
    expect(JSON.stringify(response.body)).not.toContain(directory);
    expect(await readdir(directory)).toEqual(before);
  });

  it.each([
    'not-a-name',
    '%2e%2e%5csecret.webp',
    '00000000-0000-4000-8000-000000000000.webp',
  ])('contains reads for %s', async (name) => {
    await request(app.getHttpServer())
      .get(`/api/perfil/imagenes/${name}`)
      .set('Authorization', 'Bearer local-test')
      .expect('Cache-Control', 'private, no-store')
      .expect(name.startsWith('0000') ? 404 : 400);
  });
});
