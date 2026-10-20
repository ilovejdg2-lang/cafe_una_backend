import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import sharp from 'sharp';
import {
  MAX_PROFILE_IMAGE_BYTES,
  PerfilImagenStorage,
} from './perfil-imagen.storage';

describe('PerfilImagenStorage', () => {
  let directory: string;
  let storage: PerfilImagenStorage;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'cafe-perfil-storage-'));
    storage = new PerfilImagenStorage(directory);
  });

  afterEach(async () => {
    if (directory.startsWith(join(tmpdir(), 'cafe-perfil-storage-')))
      await rm(directory, { recursive: true, force: true });
  });

  it.each(['jpeg', 'png', 'webp'] as const)(
    're-encodes real %s bytes to metadata-free WebP',
    async (format) => {
      const input = await sharp({
        create: { width: 2, height: 2, channels: 3, background: 'red' },
      })
        .toFormat(format)
        .withMetadata()
        .toBuffer();
      const name = await storage.guardar(input);
      expect(name).toMatch(/^[a-f0-9-]{36}\.webp$/);
      const output = await storage.leer(name);
      expect(output).toEqual(await readFile(join(directory, name)));
      const metadata = await sharp(output).metadata();
      expect(metadata.format).toBe('webp');
      expect(metadata.exif).toBeUndefined();
      expect(metadata.icc).toBeUndefined();
    },
  );

  it.each(['empty', 'html', 'svg', 'truncated', 'oversized'] as const)(
    'rejects %s input without a file',
    async (kind) => {
      const cases = {
        empty: Buffer.alloc(0),
        html: Buffer.from('<html>not an image</html>'),
        svg: Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
        ),
        truncated: Buffer.from([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0,
        ]),
        oversized: Buffer.alloc(MAX_PROFILE_IMAGE_BYTES + 1),
      };
      await expect(storage.guardar(cases[kind])).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(await readdir(directory)).toEqual([]);
    },
  );

  it('rejects excessive input pixels before saving', async () => {
    const image = await sharp({
      create: { width: 5001, height: 5000, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer();
    await expect(storage.guardar(image)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(await readdir(directory)).toEqual([]);
  });

  it('rejects animated WebP rather than silently taking its first page', async () => {
    const image = await sharp(Buffer.from([255, 0, 0, 0, 0, 255]), {
      raw: { width: 1, height: 2, channels: 3, pageHeight: 1 },
    })
      .webp()
      .toBuffer();
    expect((await sharp(image, { animated: true }).metadata()).pages).toBe(2);
    await expect(storage.guardar(image)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(await readdir(directory)).toEqual([]);
  });

  it.each([
    '../secret.webp',
    '..\\secret.webp',
    '/absolute.webp',
    '%2e%2e%2fsecret.webp',
    'avatar.svg',
  ])('rejects unsafe name %s', async (name) => {
    await expect(storage.leer(name)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('keeps filesystem failures as safe server errors', async () => {
    const blocked = join(directory, 'not-a-directory');
    await writeFile(blocked, 'occupied');
    const unavailable = new PerfilImagenStorage(blocked);
    const input = await sharp({
      create: { width: 1, height: 1, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer();
    await expect(unavailable.guardar(input)).rejects.toEqual(
      new InternalServerErrorException('No se pudo guardar la imagen.'),
    );
    const unreadable = '00000000-0000-4000-8000-000000000000.webp';
    await mkdir(join(directory, unreadable));
    await expect(storage.leer(unreadable)).rejects.toEqual(
      new InternalServerErrorException('No se pudo leer la imagen.'),
    );
  });
});
