import { INestApplication } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { Server } from 'node:http';
import request from 'supertest';

import { CamelCaseInterceptor } from '../common/camel-case.interceptor';
import { PascalBodyInterceptor } from '../common/pascal-body.interceptor';
import { PERMISOS_KEY } from '../common/requiere-permiso.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermisosGuard } from '../guards/permisos.guard';
import { AjustesSistemaService } from '../services/ajustes-sistema.service';
import { CatalogoSistemaService } from '../services/catalogo-sistema.service';
import { CierresCompraService } from '../services/cierres-compra.service';
import { DisponibilidadGruposService } from '../services/disponibilidad-grupos.service';
import { PermisosCatalogoService } from '../services/permisos-catalogo.service';
import { AjustesController } from './ajustes.controller';

describe('AjustesController cierres-compra HTTP contract', () => {
  let app: INestApplication;
  let server: Server;
  let currentUser: { userId: number; roles: string[] };

  const cierres = {
    listarPublicos: jest.fn(),
    listarAdmin: jest.fn(),
    crear: jest.fn(),
    eliminar: jest.fn(),
  };
  const disponibilidad = {
    reglasBase: jest.fn(),
    listarPublicos: jest.fn(),
    listarExcepciones: jest.fn(),
    upsertExcepcion: jest.fn(),
    actualizar: jest.fn(),
    eliminar: jest.fn(),
    eliminarPorFecha: jest.fn(),
  };
  const fila = {
    Id: 5,
    Fecha: '2099-12-25',
    Nota: 'Navidad',
    UbicacionId: null,
  };
  const filaJson = {
    id: 5,
    fecha: '2099-12-25',
    nota: 'Navidad',
    ubicacionId: null,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    currentUser = { userId: 7, roles: ['Usuario'] };
    cierres.listarPublicos.mockResolvedValue([fila]);
    cierres.listarAdmin.mockResolvedValue([fila]);
    cierres.crear.mockResolvedValue(fila);
    cierres.eliminar.mockResolvedValue(undefined);

    const moduleRef = await Test.createTestingModule({
      controllers: [AjustesController],
      providers: [
        PermisosGuard,
        { provide: CierresCompraService, useValue: cierres },
        { provide: DisponibilidadGruposService, useValue: disponibilidad },
        { provide: PermisosCatalogoService, useValue: {} },
        { provide: AjustesSistemaService, useValue: {} },
        { provide: CatalogoSistemaService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => {
            getRequest: () => { user?: typeof currentUser };
          };
        }) => {
          context.switchToHttp().getRequest().user = currentUser;
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalInterceptors(
      new PascalBodyInterceptor(),
      new CamelCaseInterceptor(),
    );
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterEach(async () => app.close());

  describe('public list', () => {
    it('is reachable without permissions and returns camelCase rows', async () => {
      await request(server)
        .get('/api/ajustes/disponibilidad/cierres-compra')
        .expect(200)
        .expect([filaJson]);
      expect(cierres.listarPublicos).toHaveBeenCalledWith(null);
    });

    it('forwards a valid ubicacionId and ignores garbage', async () => {
      await request(server)
        .get('/api/ajustes/disponibilidad/cierres-compra?ubicacionId=4')
        .expect(200);
      expect(cierres.listarPublicos).toHaveBeenLastCalledWith(4);

      await request(server)
        .get('/api/ajustes/disponibilidad/cierres-compra?ubicacionId=abc')
        .expect(200);
      expect(cierres.listarPublicos).toHaveBeenLastCalledWith(null);
    });

    it('declares no guards', () => {
      /* eslint-disable-next-line @typescript-eslint/unbound-method */
      const handler = AjustesController.prototype.listarCierresCompra;
      expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toBeUndefined();
    });
  });

  describe('permissions', () => {
    it.each(['Usuario', 'Cliente', 'Vendedor'])(
      'denies %s on the admin list and on every mutation',
      async (rol) => {
        currentUser = { userId: 7, roles: [rol] };
        await request(server)
          .get('/api/ajustes/disponibilidad/cierres-compra/admin')
          .expect(403);
        await request(server)
          .post('/api/ajustes/disponibilidad/cierres-compra')
          .send({ fecha: '2099-12-25', nota: 'x', ubicacionId: null })
          .expect(403);
        await request(server)
          .delete('/api/ajustes/disponibilidad/cierres-compra/5')
          .expect(403);
        expect(cierres.listarAdmin).not.toHaveBeenCalled();
        expect(cierres.crear).not.toHaveBeenCalled();
        expect(cierres.eliminar).not.toHaveBeenCalled();
      },
    );

    it('guards the admin handlers with JWT and permissions', () => {
      /* eslint-disable @typescript-eslint/unbound-method */
      const proto = AjustesController.prototype;
      const permisosLectura = [
        'ver_inventario',
        'actualizar_inventario',
        'administrar_roles_permisos',
      ];
      const permisosEscritura = [
        'actualizar_inventario',
        'administrar_roles_permisos',
      ];
      for (const handler of [
        proto.listarCierresCompraAdmin,
        proto.crearCierreCompra,
        proto.eliminarCierreCompra,
      ]) {
        expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual([
          JwtAuthGuard,
          PermisosGuard,
        ]);
      }
      expect(
        Reflect.getMetadata(PERMISOS_KEY, proto.listarCierresCompraAdmin),
      ).toEqual(permisosLectura);
      expect(
        Reflect.getMetadata(PERMISOS_KEY, proto.crearCierreCompra),
      ).toEqual(permisosEscritura);
      expect(
        Reflect.getMetadata(PERMISOS_KEY, proto.eliminarCierreCompra),
      ).toEqual(permisosEscritura);
      /* eslint-enable @typescript-eslint/unbound-method */
    });

    it('lets an Admin list, create and delete', async () => {
      currentUser = { userId: 1, roles: ['Admin'] };
      await request(server)
        .get('/api/ajustes/disponibilidad/cierres-compra/admin')
        .expect(200)
        .expect([filaJson]);
      await request(server)
        .post('/api/ajustes/disponibilidad/cierres-compra')
        .send({ fecha: '2099-12-25', nota: 'Navidad', ubicacionId: null })
        .expect(201)
        .expect(filaJson);
      expect(cierres.crear).toHaveBeenCalledWith(
        expect.objectContaining({
          fecha: '2099-12-25',
          nota: 'Navidad',
          ubicacionId: null,
        }),
      );
      await request(server)
        .delete('/api/ajustes/disponibilidad/cierres-compra/5')
        .expect(200)
        .expect({ ok: true });
      expect(cierres.eliminar).toHaveBeenCalledWith(5);
    });

    it('rejects a non numeric id before reaching the service', async () => {
      currentUser = { userId: 1, roles: ['Admin'] };
      await request(server)
        .delete('/api/ajustes/disponibilidad/cierres-compra/abc')
        .expect(400);
      expect(cierres.eliminar).not.toHaveBeenCalled();
    });
  });

  describe('route shadowing against disponibilidad/:id', () => {
    beforeEach(() => {
      currentUser = { userId: 1, roles: ['Admin'] };
    });

    it('routes cierres-compra calls only to CierresCompraService', async () => {
      await request(server)
        .get('/api/ajustes/disponibilidad/cierres-compra')
        .expect(200);
      await request(server)
        .get('/api/ajustes/disponibilidad/cierres-compra/admin')
        .expect(200);
      await request(server)
        .post('/api/ajustes/disponibilidad/cierres-compra')
        .send({ fecha: '2099-12-25' })
        .expect(201);
      await request(server)
        .delete('/api/ajustes/disponibilidad/cierres-compra/5')
        .expect(200);

      for (const fn of Object.values(disponibilidad)) {
        expect(fn).not.toHaveBeenCalled();
      }
    });

    it('keeps the existing disponibilidad routes on their own service', async () => {
      // Legacy disponibilidad routes require administrar_roles_permisos.
      currentUser = { userId: 1, roles: ['SuperAdmin'] };
      disponibilidad.reglasBase.mockReturnValue({});
      disponibilidad.listarExcepciones.mockResolvedValue([]);
      disponibilidad.upsertExcepcion.mockResolvedValue({});
      disponibilidad.actualizar.mockResolvedValue({});
      disponibilidad.eliminar.mockResolvedValue(undefined);

      await request(server).get('/api/ajustes/disponibilidad').expect(200);
      await request(server)
        .post('/api/ajustes/disponibilidad')
        .send({ tipo: 'compras', fecha: '2099-12-24' })
        .expect(201);
      await request(server)
        .put('/api/ajustes/disponibilidad/9')
        .send({ nota: 'x' })
        .expect(200);
      await request(server)
        .delete('/api/ajustes/disponibilidad/9')
        .expect(200);

      expect(disponibilidad.listarExcepciones).toHaveBeenCalled();
      expect(disponibilidad.upsertExcepcion).toHaveBeenCalled();
      expect(disponibilidad.actualizar).toHaveBeenCalledWith(9, expect.anything());
      expect(disponibilidad.eliminar).toHaveBeenCalledWith(9);
      expect(cierres.crear).not.toHaveBeenCalled();
      expect(cierres.eliminar).not.toHaveBeenCalled();
    });
  });
});
