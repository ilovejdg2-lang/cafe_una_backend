import { DataSource } from 'typeorm';
import { AuditoriaSolicitudSalidaInventario } from '../entities/auditoria-solicitud-salida-inventario.entity';
import { InventarioStockUbicacion } from '../entities/inventario-stock-ubicacion.entity';
import { InventarioUbicacion } from '../entities/inventario-ubicacion.entity';
import { MotivoSalida } from '../entities/motivo-salida.entity';
import { MovimientoInventario } from '../entities/movimiento-inventario.entity';
import { Notificacion } from '../entities/notificacion.entity';
import { Producto } from '../entities/producto.entity';
import { SolicitudSalidaInventario } from '../entities/solicitud-salida-inventario.entity';
import { SolicitudSalidaInventarioItem } from '../entities/solicitud-salida-inventario-item.entity';
import { Usuario } from '../entities/usuario.entity';
import { StockAlertaService } from './stock-alerta.service';
import { SolicitudesSalidaInventarioService } from './solicitudes-salida-inventario.service';

function transitionHarness(
  notificationFailure = false,
  options: {
    items?: Array<{ SolicitudId: string; ProductoId: string; Cantidad: number }>;
    stocks?: Array<Record<string, unknown>>;
    products?: Array<Record<string, unknown>>;
  } = {},
) {
  const request = {
    Id: '501',
    Estado: 'pendiente',
    SolicitanteId: 7,
    MotivoSalidaId: 2,
    Destinatario: 'Biblioteca comunal',
    ResponsableNombre: 'Brayan Pérez',
  };
  const stock = {
    Id: '101',
    ProductoId: '10',
    UbicacionId: 1,
    Stock: 12,
    StockReservado: 3,
  };
  const product = { Id: '10', Stock: 12 };
  const item = { SolicitudId: '501', ProductoId: '10', Cantidad: 3 };
  const items = options.items ?? [item];
  const stocks = options.stocks ?? [stock];
  const products = options.products ?? [product];
  const movementRows: Record<string, unknown>[] = [];
  const auditRows: Record<string, unknown>[] = [];
  const insertQuery = {
    insert: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    orIgnore: jest.fn().mockReturnThis(),
    execute: jest.fn(() =>
      notificationFailure
        ? Promise.reject(new Error('notification database unavailable'))
        : Promise.resolve(undefined),
    ),
  };
  const notificationRepository = {
    createQueryBuilder: jest.fn(() => insertQuery),
  };
  const requestRepository = {
    findOne: jest.fn().mockImplementation(async () => request),
    save: jest.fn(async (row) => row),
  };
  const locationRepository = {
    findOne: jest.fn().mockResolvedValue({ Id: 1, Codigo: 'BODEGA_CENTRAL' }),
  };
  const stockRepository = {
    findOne: jest.fn(({ where }) =>
      Promise.resolve(stocks.find((row) => row.ProductoId === where.ProductoId) ?? null),
    ),
    save: jest.fn(async (row) => row),
  };
  const productRepository = {
    findOne: jest.fn(({ where }) =>
      Promise.resolve(products.find((row) => row.Id === where.Id) ?? null),
    ),
    save: jest.fn(async (row) => row),
  };
  const itemsRepository = {
    find: jest.fn().mockResolvedValue(items),
  };
  const movementRepository = {
    create: jest.fn((row) => row),
    save: jest.fn(async (row) => {
      movementRows.push(row);
      return row;
    }),
  };
  const auditRepository = {
    create: jest.fn((row) => row),
    save: jest.fn(async (row) => {
      auditRows.push(row);
      return row;
    }),
  };
  const repositories = new Map<any, any>([
    [SolicitudSalidaInventario, requestRepository],
    [InventarioUbicacion, locationRepository],
    [InventarioStockUbicacion, stockRepository],
    [Producto, productRepository],
    [SolicitudSalidaInventarioItem, itemsRepository],
    [MovimientoInventario, movementRepository],
    [AuditoriaSolicitudSalidaInventario, auditRepository],
  ]);
  const manager = {
    getRepository: jest.fn((entity) => repositories.get(entity)),
  };
  let transactionCommitted = false;
  const dataSource = {
    transaction: jest.fn(async (operation) => {
      const result = await operation(manager);
      transactionCommitted = true;
      return result;
    }),
    getRepository: jest.fn((entity) =>
      entity === Notificacion ? notificationRepository : undefined,
    ),
  } as unknown as DataSource;
  const stockAlertService = {
    verificarTrasMovimiento: jest.fn(async () => {
      if (!transactionCommitted) throw new Error('transaction not committed');
      return product;
    }),
  };
  return {
    service: new SolicitudesSalidaInventarioService(
      dataSource,
      stockAlertService as unknown as StockAlertaService,
    ),
    request,
    stock,
    product,
    stockRows: stocks,
    productRows: products,
    stockRepository,
    productRepository,
    movementRepository,
    movementRows,
    auditRows,
    insertQuery,
    stockAlertService,
  };
}

describe('SolicitudesSalidaInventarioService', () => {
  it('rejects impossible calendar dates before opening a stock transaction', async () => {
    const dataSource = { transaction: jest.fn() } as unknown as DataSource;
    const service = new SolicitudesSalidaInventarioService(
      dataSource,
      { verificarTrasMovimiento: jest.fn() } as unknown as StockAlertaService,
    );

    await expect(
      service.crearSolicitud(
        {
          tipo: 'donacion',
          fechaSalida: '2026-02-31',
          destinatario: 'Biblioteca comunal',
          responsable: 'Brayan Pérez',
          items: [{ productoId: '10', cantidad: 1 }],
        },
        7,
      ),
    ).rejects.toThrow('La fecha de salida debe tener formato YYYY-MM-DD.');
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it.each(['aprobar', 'rechazar', 'cancelar'])(
    'allows only SuperAdmin to %s a request',
    async (action) => {
      const dataSource = { transaction: jest.fn() } as unknown as DataSource;
      const service = new SolicitudesSalidaInventarioService(
        dataSource,
        { verificarTrasMovimiento: jest.fn() } as unknown as StockAlertaService,
      );
      const calls = {
        aprobar: () => service.aprobarSolicitud('501', 7, []),
        rechazar: () => service.rechazarSolicitud('501', 7, [], 'No procede.'),
        cancelar: () => service.cancelarSolicitud('501', 7, [], 'Cancelada.'),
      };

      await expect(calls[action as keyof typeof calls]()).rejects.toThrow(
        'Solo SuperAdmin puede revisar o cancelar solicitudes de salida.',
      );
      expect(dataSource.transaction).not.toHaveBeenCalled();
    },
  );

  it('releases reservations without reducing physical stock when SuperAdmin cancels', async () => {
    const harness = transitionHarness();

    const result = await harness.service.cancelarSolicitud(
      '501',
      7,
      ['SuperAdmin'],
      'Se canceló la entrega.',
    );

    expect(result.Estado).toBe('cancelada');
    expect(harness.stock).toMatchObject({ Stock: 12, StockReservado: 0 });
    expect(harness.movementRepository.save).not.toHaveBeenCalled();
    expect(harness.auditRows[0]).toMatchObject({
      Accion: 'cancelada',
      EstadoAnterior: 'pendiente',
      EstadoNuevo: 'cancelada',
      ActorId: 7,
    });
  });

  it('releases reservations without reducing physical stock when SuperAdmin rejects', async () => {
    const harness = transitionHarness();

    const result = await harness.service.rechazarSolicitud(
      '501',
      8,
      ['SuperAdmin'],
      'No corresponde la entrega.',
    );

    expect(result.Estado).toBe('rechazada');
    expect(harness.stock).toMatchObject({ Stock: 12, StockReservado: 0 });
    expect(harness.movementRows).toHaveLength(0);
    expect(harness.auditRows[0]).toMatchObject({
      Accion: 'rechazada',
      EstadoAnterior: 'pendiente',
      EstadoNuevo: 'rechazada',
      ActorId: 8,
    });
  });

  it('retries stock-flag recalculation without duplicating approval effects', async () => {
    const harness = transitionHarness();
    harness.stockAlertService.verificarTrasMovimiento.mockRejectedValueOnce(
      new Error('stock flag store unavailable'),
    );

    await harness.service.aprobarSolicitud('501', 8, ['SuperAdmin']);
    await harness.service.aprobarSolicitud('501', 8, ['SuperAdmin']);

    expect(harness.stock).toMatchObject({ Stock: 9, StockReservado: 0 });
    expect(harness.product.Stock).toBe(9);
    expect(harness.stockAlertService.verificarTrasMovimiento).toHaveBeenCalledTimes(2);
    expect(harness.stockAlertService.verificarTrasMovimiento).toHaveBeenCalledWith('10');
    expect(harness.movementRows).toHaveLength(1);
    expect(harness.movementRows[0]).toMatchObject({
      Tipo: 'salida_bodega',
      SolicitudSalidaId: '501',
      ProductoId: '10',
      Cantidad: 3,
    });
    expect(harness.insertQuery.values).toHaveBeenCalledTimes(2);
    expect(harness.insertQuery.values).toHaveBeenNthCalledWith(
      1,
      expect.arrayContaining([
        expect.objectContaining({
          ClaveUnica: 'salida-inventario:501:aprobada:7',
        }),
      ]),
    );
    expect(harness.insertQuery.orIgnore).toHaveBeenCalledTimes(2);
  });

  it('does not write any item when a later approval balance is invalid', async () => {
    const harness = transitionHarness(false, {
      items: [
        { SolicitudId: '501', ProductoId: '10', Cantidad: 3 },
        { SolicitudId: '501', ProductoId: '20', Cantidad: 2 },
      ],
      stocks: [
        { Id: '101', ProductoId: '10', UbicacionId: 1, Stock: 12, StockReservado: 3 },
        { Id: '102', ProductoId: '20', UbicacionId: 1, Stock: 8, StockReservado: 1 },
      ],
      products: [
        { Id: '10', Stock: 12 },
        { Id: '20', Stock: 8 },
      ],
    });

    await expect(
      harness.service.aprobarSolicitud('501', 8, ['SuperAdmin']),
    ).rejects.toThrow('balance inválido del producto 20');

    expect(harness.stockRepository.save).not.toHaveBeenCalled();
    expect(harness.productRepository.save).not.toHaveBeenCalled();
    expect(harness.movementRows).toHaveLength(0);
    expect(harness.request.Estado).toBe('pendiente');
  });

  it('keeps the committed approval when in-app notification storage fails', async () => {
    const harness = transitionHarness(true);

    await expect(
      harness.service.aprobarSolicitud('501', 8, ['SuperAdmin']),
    ).resolves.toMatchObject({ Estado: 'aprobada' });

    expect(harness.stock).toMatchObject({ Stock: 9, StockReservado: 0 });
    expect(harness.movementRows).toHaveLength(1);
  });

  it('keeps an approval committed if product-flag recalculation fails afterward', async () => {
    const harness = transitionHarness();
    harness.stockAlertService.verificarTrasMovimiento.mockRejectedValue(
      new Error('stock flag store unavailable'),
    );

    await expect(
      harness.service.aprobarSolicitud('501', 8, ['SuperAdmin']),
    ).resolves.toMatchObject({ Estado: 'aprobada' });

    expect(harness.stock).toMatchObject({ Stock: 9, StockReservado: 0 });
    expect(harness.movementRows).toHaveLength(1);
  });

  it('rejects insufficient net stock before reserving any item in a multi-product request', async () => {
    const stocks = new Map([
      ['10', { Id: '101', ProductoId: '10', UbicacionId: 1, Stock: 12, StockReservado: 2 }],
      ['20', { Id: '102', ProductoId: '20', UbicacionId: 1, Stock: 8, StockReservado: 7 }],
    ]);
    const products = new Map([
      ['10', { Id: '10', Nombre: 'Café' }],
      ['20', { Id: '20', Nombre: 'Taza' }],
    ]);
    const stockRepository = {
      findOne: jest.fn(({ where }) => Promise.resolve(stocks.get(String(where.ProductoId)))),
      save: jest.fn(async (row) => row),
    };
    const requestRepository = {
      create: jest.fn((row) => row),
      save: jest.fn(async (row) => ({ Id: '501', ...row })),
    };
    const repositories = new Map<any, any>([
      [InventarioUbicacion, { findOne: jest.fn().mockResolvedValue({ Id: 1, Codigo: 'BODEGA_CENTRAL' }) }],
      [MotivoSalida, { findOne: jest.fn().mockResolvedValue({ Id: 2, Nombre: 'Donación' }) }],
      [InventarioStockUbicacion, stockRepository],
      [Producto, { findOne: jest.fn(({ where }) => Promise.resolve(products.get(String(where.Id)))) }],
      [SolicitudSalidaInventario, requestRepository],
      [SolicitudSalidaInventarioItem, { create: jest.fn((row) => row), save: jest.fn() }],
      [AuditoriaSolicitudSalidaInventario, { create: jest.fn((row) => row), save: jest.fn() }],
    ]);
    const manager = { getRepository: jest.fn((entity) => repositories.get(entity)) };
    const dataSource = {
      transaction: jest.fn(async (operation) => operation(manager)),
    } as unknown as DataSource;
    const service = new SolicitudesSalidaInventarioService(
      dataSource,
      { verificarTrasMovimiento: jest.fn() } as unknown as StockAlertaService,
    );

    await expect(service.crearSolicitud({
      tipo: 'donacion',
      fechaSalida: '2026-10-27',
      destinatario: 'Biblioteca comunal',
      responsable: 'Brayan Pérez',
      items: [
        { productoId: '10', cantidad: 3 },
        { productoId: '20', cantidad: 2 },
      ],
    }, 7)).rejects.toThrow('Stock disponible insuficiente para el producto 20.');

    expect(stockRepository.save).not.toHaveBeenCalled();
    expect(requestRepository.save).not.toHaveBeenCalled();
  });

  it('reserves multiple requested products without changing physical stock', async () => {
    const central = { Id: 1, Codigo: 'BODEGA_CENTRAL' };
    const stocks = new Map([
      [
        '10',
        {
          Id: 101,
          ProductoId: '10',
          UbicacionId: 1,
          Stock: 12,
          StockReservado: 2,
        },
      ],
      [
        '20',
        {
          Id: 102,
          ProductoId: '20',
          UbicacionId: 1,
          Stock: 8,
          StockReservado: 1,
        },
      ],
    ]);
    const products = new Map([
      ['10', { Id: '10', Nombre: 'Café' }],
      ['20', { Id: '20', Nombre: 'Taza' }],
    ]);
    const saved = { requests: [], items: [], audits: [] };
    const locationRepository = {
      findOne: jest.fn().mockResolvedValue(central),
    };
    const stockRepository = {
      findOne: jest.fn(({ where }) =>
        Promise.resolve(stocks.get(String(where.ProductoId))),
      ),
      save: jest.fn(async (row) => row),
    };
    const productRepository = {
      findOne: jest.fn(({ where }) =>
        Promise.resolve(products.get(String(where.Id))),
      ),
    };
    const reasonRepository = {
      findOne: jest.fn().mockResolvedValue({ Id: 2, Nombre: 'Donación' }),
    };
    const requestRepository = {
      create: jest.fn((row) => row),
      save: jest.fn(async (row) => {
        row.Id = '501';
        saved.requests.push(row);
        return row;
      }),
      findOne: jest.fn(),
    };
    const itemRepository = {
      create: jest.fn((row) => row),
      save: jest.fn(async (row) => {
        saved.items.push(row);
        return row;
      }),
    };
    const auditRepository = {
      create: jest.fn((row) => row),
      save: jest.fn(async (row) => {
        saved.audits.push(row);
        return row;
      }),
    };
    const usuarioRepository = {
      find: jest.fn().mockResolvedValue([
        { Id: 3, Roles: ['SuperAdmin'], Estado: 'activo' },
        { Id: 4, Roles: ['Admin'], Estado: 'activo' },
      ]),
    };
    const insertQuery = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    };
    const notificationRepository = {
      createQueryBuilder: jest.fn(() => insertQuery),
    };
    const repositories = new Map<any, any>([
      [InventarioUbicacion, locationRepository],
      [InventarioStockUbicacion, stockRepository],
      [Producto, productRepository],
      [MotivoSalida, reasonRepository],
    ]);
    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity.name === 'SolicitudSalidaInventario')
          return requestRepository;
        if (entity.name === 'SolicitudSalidaInventarioItem')
          return itemRepository;
        if (entity.name === 'AuditoriaSolicitudSalidaInventario')
          return auditRepository;
        return repositories.get(entity);
      }),
    };
    const dataSource = {
      transaction: jest.fn(async (operation) => operation(manager)),
      getRepository: jest.fn((entity) => {
        if (entity === Usuario) return usuarioRepository;
        if (entity === Notificacion) return notificationRepository;
        return undefined;
      }),
    } as unknown as DataSource;
    const service = new SolicitudesSalidaInventarioService(
      dataSource,
      { verificarTrasMovimiento: jest.fn() } as unknown as StockAlertaService,
    );

    const result = await service.crearSolicitud(
      {
        tipo: 'donacion',
        fechaSalida: '2026-10-27',
        destinatario: 'Biblioteca comunal',
        responsable: 'Brayan Pérez',
        items: [
          { productoId: '10', cantidad: 3 },
          { productoId: '20', cantidad: 2 },
        ],
      },
      7,
    );

    expect(result.Id).toBe('501');
    expect(stockRepository.save).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        ProductoId: '10',
        Stock: 12,
        StockReservado: 5,
      }),
    );
    expect(stockRepository.save).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        ProductoId: '20',
        Stock: 8,
        StockReservado: 3,
      }),
    );
    expect(saved.requests[0]).toMatchObject({
      Estado: 'pendiente',
      MotivoSalidaId: 2,
      SolicitanteId: 7,
      Destinatario: 'Biblioteca comunal',
      ResponsableNombre: 'Brayan Pérez',
    });
    expect(saved.items).toHaveLength(2);
    expect(saved.audits[0]).toMatchObject({
      ActorId: 7,
      EstadoAnterior: null,
      EstadoNuevo: 'pendiente',
    });
    expect(usuarioRepository.find).toHaveBeenCalledWith({
      where: { Estado: 'activo' },
      select: ['Id', 'Roles'],
    });
    expect(insertQuery.values).toHaveBeenCalledWith([
      expect.objectContaining({
        UsuarioId: 3,
        Tipo: 'salida_solicitud',
        ClaveUnica: 'salida-inventario:501:solicitada:3',
        Enlace: '/admin/salidas-inventario#solicitud-501',
      }),
    ]);
    expect(insertQuery.orIgnore).toHaveBeenCalled();
    expect(insertQuery.execute).toHaveBeenCalled();
  });
});
