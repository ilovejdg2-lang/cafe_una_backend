import { BadRequestException } from '@nestjs/common';
import { DonacionSolicitudesService } from './donacion-solicitudes.service';

describe('DonacionSolicitudesService', () => {
  const solicitudes = { save: jest.fn(), create: jest.fn((v) => v), find: jest.fn(), findOne: jest.fn() };
  const necesidades = { findOne: jest.fn() };
  const materiales = { obtenerActivoDeCategoria: jest.fn() };
  const emailService = { enviarActualizacionEstadoDonacion: jest.fn() };
  const fechasRecepcion = {
    estaFechaYHorarioHabilitada: jest.fn().mockResolvedValue({ valida: true }),
  };

    let service: DonacionSolicitudesService;

  beforeEach(() => {
    jest.clearAllMocks();
    fechasRecepcion.estaFechaYHorarioHabilitada.mockResolvedValue({ valida: true });
    service = new DonacionSolicitudesService(
      solicitudes as never,
      necesidades as never,
      materiales as never,
      fechasRecepcion as never,
      emailService as never,
    );
  });

  it('rejects a material that does not belong to the selected category', async () => {
    necesidades.findOne.mockResolvedValue({
      Id: 1,
      Titulo: 'Herramientas',
      Estado: 'ACTIVA',
    });
    materiales.obtenerActivoDeCategoria.mockResolvedValue(null);

    await expect(
      service.crear(
        {
          descripcion: 'Carretillo usado',
          necesidadId: 1,
          materialId: 99,
          detalles: {
            valorEstimado: '10000',
            cantidadEstimada: '1',
            estadoArticulos: 'Nuevo',
            metodoEntrega: 'entrega',
            provincia: 'Heredia',
            canton: 'Heredia',
            distrito: 'Heredia',
            direccion: 'Campus UNA',
            fechaEntrega: '2026-09-10',
          },
        },
        7,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(solicitudes.save).not.toHaveBeenCalled();
  });

  it('rejects a request without estimated value', async () => {
    necesidades.findOne.mockResolvedValue({
      Id: 1,
      Titulo: 'Herramientas',
      Estado: 'ACTIVA',
    });
    materiales.obtenerActivoDeCategoria.mockResolvedValue({
      Id: 2,
      Nombre: 'Carretillo',
    });

    await expect(
      service.crear(
        {
          descripcion: 'Carretillo usado',
          necesidadId: 1,
          materialId: 2,
          detalles: {
            cantidadEstimada: '1',
            estadoArticulos: 'Nuevo',
            metodoEntrega: 'entrega',
            provincia: 'Heredia',
            canton: 'Heredia',
            distrito: 'Heredia',
            direccion: 'Campus UNA',
            fechaEntrega: '2026-09-10',
          },
        },
        7,
      ),
    ).rejects.toThrow(/valor estimado/i);
  });
});
