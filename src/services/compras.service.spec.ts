import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ComprasService } from './compras.service';

describe('ComprasService historial', () => {
  const comprasRepository = {
    create: jest.fn((row) => row),
    save: jest.fn(async (row) => ({ Id: 11, ...row })),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const itemsRepository = {
    create: jest.fn((row) => row),
    save: jest.fn(async (rows) => rows),
  };

  let service: ComprasService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ComprasService(
      comprasRepository as never,
      itemsRepository as never,
    );
  });

  it('registers a completed purchase with items', async () => {
    comprasRepository.findOne.mockResolvedValue({
      Id: 11,
      Numero: 'C-11',
      UsuarioId: 7,
      Fecha: new Date('2026-03-01T00:00:00Z'),
      ClienteNombre: 'Ana Cliente',
      ClienteCorreo: 'ana@una.cr',
      Subtotal: '5309.73',
      Impuestos: '690.27',
      Total: '6000',
      MetodoPago: 'Tarjeta',
      Estado: 'Pagado',
      FacturaId: null,
      Items: [
        {
          ProductoId: '1',
          Nombre: 'Café molido',
          Cantidad: 2,
          PrecioUnitario: '3000',
          Subtotal: '6000',
        },
      ],
    });

    const detalle = await service.registrar(
      {
        clienteNombre: 'Ana Cliente',
        clienteCorreo: 'ana@una.cr',
        items: [
          {
            id: '1',
            nombre: 'Café molido',
            cantidad: 2,
            precioUnitario: 3000,
            subtotal: 6000,
          },
        ],
        subtotal: 5309.73,
        impuestos: 690.27,
        total: 6000,
        estado: 'Pagado',
        metodoPago: 'Tarjeta',
      },
      7,
    );

    expect(comprasRepository.save).toHaveBeenCalled();
    expect(itemsRepository.save).toHaveBeenCalled();
    expect(detalle.clienteNombre).toBe('Ana Cliente');
    expect(detalle.total).toBe(6000);
    expect(detalle.items).toHaveLength(1);
  });

  it('returns empty paginated list for a client without purchases', async () => {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    comprasRepository.createQueryBuilder.mockReturnValue(qb);

    await expect(service.listarPropias(22, { page: '1', pageSize: '10' })).resolves.toEqual({
      data: [],
      page: 1,
      pageSize: 10,
      total: 0,
      totalPages: 1,
    });
  });

  it('lists multiple purchases with pagination', async () => {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([
        [
          {
            Id: 1,
            Numero: 'C-1',
            Fecha: new Date('2026-01-01T00:00:00Z'),
            ClienteNombre: 'A',
            ClienteCorreo: 'a@una.cr',
            Subtotal: '1000',
            Impuestos: '130',
            Total: '1130',
            MetodoPago: 'Tarjeta',
            Estado: 'Pagado',
            FacturaId: null,
            Items: [{ Cantidad: 2 }],
          },
          {
            Id: 2,
            Numero: 'C-2',
            Fecha: new Date('2026-01-02T00:00:00Z'),
            ClienteNombre: 'A',
            ClienteCorreo: 'a@una.cr',
            Subtotal: '2000',
            Impuestos: '260',
            Total: '2260',
            MetodoPago: 'Tarjeta',
            Estado: 'Pagado',
            FacturaId: null,
            Items: [{ Cantidad: 1 }],
          },
        ],
        5,
      ]),
    };
    comprasRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.listarPropias(22, { page: '2', pageSize: '2' });
    expect(result.data).toHaveLength(2);
    expect(result.total).toBe(5);
    expect(result.totalPages).toBe(3);
    expect(qb.skip).toHaveBeenCalledWith(2);
    expect(qb.take).toHaveBeenCalledWith(2);
  });

  it('applies combined q filter and date/status filters', async () => {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    comprasRepository.createQueryBuilder.mockReturnValue(qb);

    await service.listar({
      q: 'C-100',
      estado: 'Pagado',
      desde: '2026-01-01',
      hasta: '2026-01-31',
      montoMin: '1000',
      montoMax: '5000',
    });

    expect(qb.andWhere).toHaveBeenCalledWith(
      '(compra.Numero ILIKE :q OR compra.ClienteNombre ILIKE :q OR compra.ClienteCorreo ILIKE :q)',
      { q: '%C-100%' },
    );
    expect(qb.andWhere).toHaveBeenCalledWith(
      'compra.Estado ILIKE :estado',
      { estado: 'Pagado' },
    );
  });

  it('returns purchase detail for the owner', async () => {
    comprasRepository.findOne.mockResolvedValue({
      Id: 9,
      Numero: 'C-9',
      UsuarioId: 4,
      Fecha: new Date('2026-02-01T00:00:00Z'),
      ClienteNombre: 'Dueño',
      ClienteCorreo: 'dueno@una.cr',
      Subtotal: '100',
      Impuestos: '13',
      Total: '113',
      MetodoPago: 'Tarjeta',
      Estado: 'Pagado',
      FacturaId: null,
      Items: [
        {
          ProductoId: '1',
          Nombre: 'Café',
          Cantidad: 1,
          PrecioUnitario: '113',
          Subtotal: '113',
        },
      ],
    });

    const detalle = await service.obtenerDetalleAutorizado(9, 4, ['Cliente']);
    expect(detalle.numero).toBe('C-9');
    expect(detalle.items[0].nombre).toBe('Café');
  });

  it('blocks IDOR when a client requests another user purchase', async () => {
    comprasRepository.findOne.mockResolvedValue({
      Id: 9,
      Numero: 'C-9',
      UsuarioId: 4,
      Fecha: new Date('2026-02-01T00:00:00Z'),
      ClienteNombre: 'Dueño',
      ClienteCorreo: 'dueno@una.cr',
      Subtotal: '100',
      Impuestos: '13',
      Total: '113',
      MetodoPago: 'Tarjeta',
      Estado: 'Pagado',
      FacturaId: null,
      Items: [],
    });

    await expect(
      service.obtenerDetalleAutorizado(9, 99, ['Cliente']),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows admin to read any purchase detail', async () => {
    comprasRepository.findOne.mockResolvedValue({
      Id: 9,
      Numero: 'C-9',
      UsuarioId: 4,
      Fecha: new Date('2026-02-01T00:00:00Z'),
      ClienteNombre: 'Dueño',
      ClienteCorreo: 'dueno@una.cr',
      Subtotal: '100',
      Impuestos: '13',
      Total: '113',
      MetodoPago: 'Tarjeta',
      Estado: 'Pagado',
      FacturaId: null,
      Items: [],
    });

    await expect(
      service.obtenerDetalleAutorizado(9, 1, ['Admin']),
    ).resolves.toMatchObject({ numero: 'C-9' });
  });

  it('throws NotFound for missing purchase', async () => {
    comprasRepository.findOne.mockResolvedValue(null);
    await expect(
      service.obtenerDetalleAutorizado(404, 1, ['Admin']),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
