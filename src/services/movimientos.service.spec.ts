import { MovimientosService } from './movimientos.service';

describe('MovimientosService', () => {
  const qb = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  };
  const repo = {
    createQueryBuilder: jest.fn(() => qb),
  };

  let service: MovimientosService;

  beforeEach(() => {
    jest.clearAllMocks();
    qb.leftJoinAndSelect.mockReturnThis();
    qb.orderBy.mockReturnThis();
    qb.addOrderBy.mockReturnThis();
    qb.andWhere.mockReturnThis();
    qb.skip.mockReturnThis();
    qb.take.mockReturnThis();
    qb.getManyAndCount.mockResolvedValue([[], 0]);
    service = new MovimientosService(repo as never);
  });

  it('applies combinable filters and sorts by date desc', async () => {
    await service.listar({
      producto_id: '4',
      tipo: 'venta_presencial',
      ubicacion_id: '3',
      fecha_desde: '2026-09-01',
      fecha_hasta: '2026-09-03',
      page: '2',
      limit: '25',
    });

    expect(qb.orderBy).toHaveBeenCalledWith('m.Fecha', 'DESC');
    expect(qb.andWhere).toHaveBeenCalledWith('m.ProductoId = :productoId', {
      productoId: '4',
    });
    expect(qb.andWhere).toHaveBeenCalledWith('m.Tipo IN (:...tipos)', {
      tipos: expect.arrayContaining(['venta_presencial', 'Venta presencial']),
    });
    expect(qb.skip).toHaveBeenCalledWith(25);
    expect(qb.take).toHaveBeenCalledWith(25);
    expect(qb.getManyAndCount).toHaveBeenCalled();
  });

  it('maps joined names in the response', async () => {
    qb.getManyAndCount.mockResolvedValue([
      [
        {
          Id: '9',
          Tipo: 'transferencia',
          ProductoId: '4',
          Cantidad: 2,
          UbicacionOrigenId: 1,
          UbicacionDestinoId: 3,
          ResponsableId: 8,
          ResponsableNombre: '',
          MotivoSalidaId: null,
          Destinatario: null,
          Notas: 'Reposición',
          Observaciones: 'Reposición',
          Fecha: new Date('2026-09-03T12:00:00.000Z'),
          Producto: { Nombre: 'Café molido' },
          Origen: { Nombre: 'Bodega Central' },
          Destino: { Nombre: 'Editorial' },
          Responsable: { Nombre: 'Fatima' },
        },
      ],
      1,
    ]);

    const result = await service.listar({});
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      productoNombre: 'Café molido',
      origenNombre: 'Bodega Central',
      destinoNombre: 'Editorial',
      responsableNombre: 'Fatima',
      motivoSalidaId: null,
      motivoSalida: null,
      destinatario: null,
      tipo: 'transferencia',
    });
    expect(qb.leftJoinAndSelect).toHaveBeenCalledWith(
      'm.MotivoSalida',
      'motivoSalida',
    );
  });

  it('maps a classified warehouse exit reason and recipient into the history response', async () => {
    qb.getManyAndCount.mockResolvedValue([
      [
        {
          Id: '10',
          Tipo: 'salida_bodega',
          ProductoId: '101',
          Cantidad: 2,
          MotivoSalidaId: 3,
          Destinatario: 'Biblioteca de la comunidad',
          Fecha: new Date('2026-10-06T12:00:00.000Z'),
          Producto: { Nombre: 'Café molido' },
          MotivoSalida: { Id: 3, Nombre: 'Traslado' },
        },
      ],
      1,
    ]);

    const result = await service.listar({});

    expect(result.items[0]).toMatchObject({
      id: '10',
      tipo: 'salida_bodega',
      motivoSalidaId: 3,
      motivoSalida: 'Traslado',
      destinatario: 'Biblioteca de la comunidad',
    });
  });
});
