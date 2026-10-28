import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';

import { InformacionFooter } from '../entities/informacion-footer.entity';
import { ProductorActivo } from '../entities/productor-activo.entity';
import { PropuestaHistorial } from '../entities/propuesta-historial.entity';
import { PropuestaProductor } from '../entities/propuesta-productor.entity';
import { Usuario } from '../entities/usuario.entity';
import { CorreosSalidaService } from './correos-salida.service';
import { NotificacionesPropuestasService } from './notificaciones-propuestas.service';
import { PropuestaImagenStorage } from './propuesta-imagen.storage';
import { PropuestasProductoresService } from './propuestas-productores.service';

describe('PropuestasProductoresService', () => {
  const jpeg = Buffer.from([
    0xff, 0xd8, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  ]);
  const body = {
    nombre: 'Cafetal Don Juan',
    provincia: 'San José',
    canton: 'Desamparados',
    distrito: 'San Miguel',
    direccion: 'Frente al parque',
    enlaceUbicacion: 'https://maps.google.com/maps?q=cafe',
    descripcion: 'Café de altura.',
    correo: 'hola@cafetal.com',
    telefono: '8888-8888',
    aceptaTerminos: 'true',
    claveIdempotencia: 'idem-12345678',
  };

  let service: PropuestasProductoresService;
  let findOne: jest.Mock;
  let find: jest.Mock;
  let findActivos: jest.Mock;
  let guardar: jest.Mock;
  let eliminar: jest.Mock;
  let transaction: jest.Mock;
  let intentarClave: jest.Mock;

  beforeEach(async () => {
    findOne = jest.fn();
    find = jest.fn().mockResolvedValue([]);
    findActivos = jest.fn().mockResolvedValue([]);
    guardar = jest.fn().mockResolvedValue('propuesta-nueva.jpg');
    eliminar = jest.fn().mockResolvedValue(undefined);
    intentarClave = jest.fn().mockResolvedValue('enviado');
    transaction = jest.fn();

    const moduleRef = await Test.createTestingModule({
      providers: [
        PropuestasProductoresService,
        { provide: getDataSourceToken(), useValue: { transaction } },
        {
          provide: getRepositoryToken(PropuestaProductor),
          useValue: { findOne, find, createQueryBuilder: jest.fn() },
        },
        {
          provide: getRepositoryToken(InformacionFooter),
          useValue: { find: jest.fn().mockResolvedValue([{ Correo: 'contacto@cafeuna.ac.cr', Telefono: '2222-2222' }]) },
        },
        {
          provide: getRepositoryToken(ProductorActivo),
          useValue: { find: findActivos },
        },
        {
          provide: getRepositoryToken(PropuestaHistorial),
          useValue: { find: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: getRepositoryToken(Usuario),
          useValue: { find: jest.fn().mockResolvedValue([{ Id: 3, Nombre: 'Ana Admin' }]) },
        },
        {
          provide: PropuestaImagenStorage,
          useValue: {
            guardar,
            eliminar,
            validar: jest.fn().mockReturnValue({ extension: '.jpg', mime: 'image/jpeg' }),
            leer: jest.fn(),
            urlPublica: jest.fn().mockReturnValue(null),
          },
        },
        {
          provide: NotificacionesPropuestasService,
          useValue: { crearRecepcion: jest.fn(), crearResultado: jest.fn() },
        },
        {
          provide: CorreosSalidaService,
          useValue: { encolar: jest.fn(), intentarClave },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('http://localhost:5173') },
        },
      ],
    }).compile();

    service = moduleRef.get(PropuestasProductoresService);
  });

  it('recupera la misma propuesta si la clave de envío ya fue guardada', async () => {
    findOne.mockResolvedValue({
      Id: '41',
      NombreEmprendimiento: 'Cafetal Don Juan',
      CreadoEn: new Date('2026-10-10T12:00:00.000Z'),
      ImagenReferencia: 'propuesta-41.jpg',
    });

    const resultado = await service.crear(7, body, { buffer: jpeg });

    expect(resultado).toMatchObject({
      id: '41',
      estado: 'Pendiente de revisión',
    });
    expect(guardar).not.toHaveBeenCalled();
  });

  it('borra la imagen nueva si el registro falla', async () => {
    findOne.mockResolvedValue(null);
    transaction.mockRejectedValue(new Error('fallo de base'));

    await expect(service.crear(7, body, { buffer: jpeg })).rejects.toThrow(
      'fallo de base',
    );
    expect(eliminar).toHaveBeenCalledWith('propuesta-nueva.jpg');
  });

  it('no cambia una propuesta que otro administrador ya revisó', async () => {
    transaction.mockImplementation(async (fn: (manager: unknown) => Promise<unknown>) => {
      const manager = {
        getRepository: () => ({
          createQueryBuilder: () => ({
            setLock: () => ({
              where: () => ({
                getOne: async () => ({
                  Id: '9',
                  Estado: 'Aprobada',
                }),
              }),
            }),
          }),
        }),
      };
      return fn(manager);
    });

    await expect(service.aprobar('9', 3)).rejects.toBeInstanceOf(ConflictException);
    expect(intentarClave).not.toHaveBeenCalled();
  });

  it('conserva la decisión aunque el correo no salga y copia a productores activos', async () => {
    intentarClave.mockRejectedValue(new Error('smtp caído'));
    const publicados = jest.fn(async (valor: unknown) => valor);
    transaction.mockImplementation(async (fn: (manager: unknown) => Promise<unknown>) => {
      const fila = {
        Id: '9',
        UsuarioId: 7,
        NombreEmprendimiento: 'Cafetal Don Juan',
        Estado: 'Pendiente',
        CorreoContacto: 'hola@cafetal.com',
        ImagenReferencia: 'propuesta-9.jpg',
        CreadoEn: new Date('2026-10-10T12:00:00.000Z'),
        Direccion: 'San José',
        EnlaceUbicacion: 'https://waze.com/ul/abc',
        Descripcion: 'Café',
        Facebook: null,
        Instagram: null,
        Whatsapp: null,
        SitioWeb: null,
        TelefonoContacto: '+50688888888',
        TerminosVersion: 'propuesta-productor-v1',
        TerminosAceptadosEn: new Date(),
        RevisadoPorId: null as number | null,
        RevisadoEn: null as Date | null,
        MotivoRechazo: null as string | null,
        ActualizadoEn: new Date(),
      };
      const repo = {
        createQueryBuilder: () => ({
          setLock: () => ({
            where: () => ({
              getOne: async () => fila,
            }),
          }),
        }),
        save: async (valor: typeof fila) => valor,
      };
      const activos = {
        findOne: async () => null,
        create: (valor: Record<string, unknown>) => valor,
        save: publicados,
      };
      const historial = {
        create: (valor: Record<string, unknown>) => valor,
        save: async (valor: unknown) => valor,
      };
      const manager = {
        getRepository: (entidad: unknown) =>
          entidad === ProductorActivo ? activos : entidad === PropuestaHistorial ? historial : repo,
      };
      return fn(manager);
    });

    const resultado = await service.aprobar('9', 3);

    expect(resultado.estado).toBe('Aprobada');
    expect('revisadoPorId' in resultado && resultado.revisadoPorId).toBe(3);
    expect(resultado.revisadoPorNombre).toBe('Ana Admin');
    expect(resultado.envioCorreo).toEqual({ estado: 'pendiente' });
    expect(resultado.correo).toBe('hola@cafetal.com');
    expect(publicados).toHaveBeenCalledWith(
      expect.objectContaining({ PropuestaId: '9', NombreEmprendimiento: 'Cafetal Don Juan', Activo: true }),
    );
  });

  it('publica solo datos visibles de productores activos y omite contacto', async () => {
    findActivos.mockResolvedValue([
      {
        Id: 1,
        PropuestaId: '3',
        UsuarioId: 99,
        NombreEmprendimiento: 'Finca Luz',
        ImagenReferencia: 'propuesta-3.jpg',
        Descripcion: 'Historia del cafetal.',
        Direccion: 'Tarrazú',
        EnlaceUbicacion: 'https://maps.google.com/maps?q=1',
        Facebook: null,
        Instagram: 'https://instagram.com/finca',
        Whatsapp: 'https://wa.me/50688888888',
        SitioWeb: null,
        CorreoContacto: 'secreto@finca.com',
        TelefonoContacto: '+50688888888',
        Activo: true,
      },
    ]);

    const publicados = await service.listarPublicas();
    expect(findActivos).toHaveBeenCalledWith(
      expect.objectContaining({ where: { Activo: true } }),
    );
    expect(publicados).toHaveLength(1);
    expect(publicados[0]).toMatchObject({
      id: '3',
      nombre: 'Finca Luz',
      whatsapp: 'https://wa.me/50688888888',
    });
    expect(publicados[0]).not.toHaveProperty('correo');
    expect(publicados[0]).not.toHaveProperty('telefono');
    expect(publicados[0]).not.toHaveProperty('usuarioId');
    expect(publicados[0]).not.toHaveProperty('motivoRechazo');
    expect(JSON.stringify(publicados[0])).not.toContain('secreto@finca.com');
  });
});
