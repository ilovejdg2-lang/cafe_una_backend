import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Compra } from '../entities/compra.entity';
import { CompraItem } from '../entities/compra-item.entity';
import { InventarioStockUbicacion } from '../entities/inventario-stock-ubicacion.entity';
import { InventarioUbicacion } from '../entities/inventario-ubicacion.entity';
import { Producto } from '../entities/producto.entity';
import { Usuario } from '../entities/usuario.entity';
import { ComprasService } from './compras.service';

describe('ComprasService historial', () => {
  const comprasRepository = {
    create: jest.fn((row) => row),
    save: jest.fn(async (row) => ({ Id: 11, ...row })),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const manager = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((_entity, row) => row),
    save: jest.fn(),
  };
  const queryRunner = {
    manager,
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
  };
  const dataSource = {
    createQueryRunner: jest.fn(() => queryRunner),
  };
  const clientesService = {
    obtenerFichaPorUsuarioId: jest.fn().mockResolvedValue(null),
  };

  let service: ComprasService;

  beforeEach(() => {
    jest.clearAllMocks();
    clientesService.obtenerFichaPorUsuarioId.mockResolvedValue(null);
    service = new ComprasService(
      comprasRepository as never,
      dataSource as never,
      clientesService as never,
    );
  });

  it('does not let a legacy purchase consume stock already reserved by others', async () => {
    const compra = {
      Id: 21,
      Numero: 'C-21',
      Estado: 'Pendiente',
      UbicacionId: null,
      ComprobanteArchivo: null,
      UsuarioId: null,
    };
    const item = {
      CompraId: 21,
      ProductoId: '101',
      Cantidad: 5,
      Nombre: 'Café',
    };
    const product = { Id: '101', Nombre: 'Café', Stock: 6 };
    // Compra legado sin reserva propia (reservado < cantidad) y stock libre insuficiente.
    const balance = {
      ProductoId: '101',
      UbicacionId: 1,
      Stock: 6,
      StockReservado: 2,
    };
    manager.findOne.mockImplementation(async (entity: unknown) => {
      if (entity === Compra) return compra;
      if (entity === InventarioUbicacion) {
        return { Id: 1, Codigo: 'BODEGA_CENTRAL', Nombre: 'Bodega Central' };
      }
      if (entity === Producto) return product;
      if (entity === InventarioStockUbicacion) return balance;
      return null;
    });
    manager.find.mockResolvedValue([item]);
    comprasRepository.findOne.mockResolvedValue({
      ...compra,
      Estado: 'Aceptado',
      Items: [item],
    });

    await expect(service.cambiarEstado(21, 'Aceptado')).rejects.toThrow(
      /stock suficiente/i,
    );

    expect(balance.Stock).toBe(6);
    expect(balance.StockReservado).toBe(2);
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
  });

  it('registers a completed purchase with items', async () => {
    const balance = { ProductoId: '1', UbicacionId: 2, Stock: 10, StockReservado: 0 };
    manager.findOne
      .mockResolvedValueOnce({
        Id: 2,
        Codigo: 'POS_FUNA_UNA',
        Nombre: 'FUNA-UNA',
        Activo: true,
      })
      .mockResolvedValueOnce({
        Id: '1',
        Nombre: 'Café molido',
        Estado: 'Habilitado',
        PrecioNormal: '5309.73',
        PrecioConIVA: '6000',
        Stock: 10,
      })
      .mockResolvedValueOnce(balance);
    manager.save
      .mockImplementationOnce(async (row) => row)
      .mockImplementationOnce(async (row) => ({ Id: 11, ...row }))
      .mockImplementationOnce(async (rows) => rows);
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
      MetodoPago: 'Comprobante',
      Estado: 'Pendiente',
      FacturaId: null,
      UbicacionId: 2,
      Ubicacion: {
        Id: 2,
        Codigo: 'POS_FUNA_UNA',
        Nombre: 'FUNA-UNA',
        Direccion: 'Campus Omar Dengo',
        Horario: 'Lunes a viernes de 8:00 a. m. a 5:00 p. m.',
      },
      ComprobanteArchivo: 'comprobante-test.jpg',
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
        ubicacionCodigo: 'POS_FUNA_UNA',
        comprobanteArchivo: 'comprobante-test.jpg',
        items: [
          {
            id: '1',
            nombre: 'Café molido',
            cantidad: 2,
            precioUnitario: 3000,
            subtotal: 6000,
          },
        ],
        metodoPago: 'Comprobante',
      },
      7,
    );

    expect(balance.StockReservado).toBe(2);
    expect(balance.Stock).toBe(10);
    expect(manager.save).toHaveBeenCalledTimes(3);
    expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.release).toHaveBeenCalledTimes(1);
    expect(detalle.clienteNombre).toBe('Ana Cliente');
    expect(detalle.total).toBe(6000);
    expect(detalle.ubicacionCodigo).toBe('POS_FUNA_UNA');
    expect(detalle.ubicacionDireccion).toBe('Campus Omar Dengo');
    expect(detalle.ubicacionHorario).toBe(
      'Lunes a viernes de 8:00 a. m. a 5:00 p. m.',
    );
    expect(detalle.items).toHaveLength(1);
  });

  it('rejects a second concurrent purchase when stock is already reserved', async () => {
    const balance = {
      ProductoId: '1',
      UbicacionId: 2,
      Stock: 3,
      StockReservado: 3,
    };
    manager.findOne
      .mockResolvedValueOnce({
        Id: 2,
        Codigo: 'POS_FUNA_UNA',
        Nombre: 'FUNA-UNA',
        Activo: true,
      })
      .mockResolvedValueOnce({
        Id: '1',
        Nombre: 'Café en grano',
        Estado: 'Habilitado',
        PrecioNormal: '3500',
        PrecioConIVA: '3500',
        Stock: 3,
      })
      .mockResolvedValueOnce(balance);

    await expect(
      service.registrar(
        {
          clienteNombre: 'Otra persona',
          clienteCorreo: 'otra@una.cr',
          ubicacionCodigo: 'POS_FUNA_UNA',
          comprobanteArchivo: 'comprobante-test.jpg',
          items: [
            {
              id: '1',
              nombre: 'Café en grano',
              cantidad: 3,
              precioUnitario: 3500,
              subtotal: 10500,
            },
          ],
          metodoPago: 'Comprobante',
        },
        8,
      ),
    ).rejects.toThrow(/stock suficiente/i);

    expect(balance.StockReservado).toBe(3);
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
  });

  it('releases reserved stock when a pending purchase is rejected', async () => {
    const compra = {
      Id: 33,
      Numero: 'C-33',
      Estado: 'Pendiente',
      UbicacionId: 2,
      ComprobanteArchivo: null,
      UsuarioId: null,
    };
    const item = {
      CompraId: 33,
      ProductoId: '101',
      Cantidad: 3,
      Nombre: 'Café',
    };
    const product = { Id: '101', Nombre: 'Café', Stock: 10 };
    const balance = {
      ProductoId: '101',
      UbicacionId: 2,
      Stock: 10,
      StockReservado: 3,
    };
    manager.findOne.mockImplementation(async (entity: unknown) => {
      if (entity === Compra) return compra;
      if (entity === InventarioUbicacion) {
        return { Id: 2, Codigo: 'POS_FUNA_UNA', Nombre: 'FUNA-UNA' };
      }
      if (entity === Producto) return product;
      if (entity === InventarioStockUbicacion) return balance;
      return null;
    });
    manager.find.mockResolvedValue([item]);
    manager.save.mockImplementation(async (row) => row);
    comprasRepository.findOne.mockResolvedValue({
      ...compra,
      Estado: 'Rechazado',
      Items: [item],
      Ubicacion: { Id: 2, Codigo: 'POS_FUNA_UNA', Nombre: 'FUNA-UNA' },
    });

    await service.cambiarEstado(33, 'Rechazado');

    expect(balance.Stock).toBe(10);
    expect(balance.StockReservado).toBe(0);
    expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
  });

  it('consumes reserved stock when a pending purchase is accepted', async () => {
    const compra = {
      Id: 34,
      Numero: 'C-34',
      Estado: 'Pendiente',
      UbicacionId: 2,
      ComprobanteArchivo: null,
      UsuarioId: null,
    };
    const item = {
      CompraId: 34,
      ProductoId: '101',
      Cantidad: 3,
      Nombre: 'Café',
    };
    const product = { Id: '101', Nombre: 'Café', Stock: 10 };
    const balance = {
      ProductoId: '101',
      UbicacionId: 2,
      Stock: 10,
      StockReservado: 3,
    };
    manager.findOne.mockImplementation(async (entity: unknown) => {
      if (entity === Compra) return compra;
      if (entity === InventarioUbicacion) {
        return { Id: 2, Codigo: 'POS_FUNA_UNA', Nombre: 'FUNA-UNA' };
      }
      if (entity === Producto) return product;
      if (entity === InventarioStockUbicacion) return balance;
      return null;
    });
    manager.find.mockResolvedValue([item]);
    manager.save.mockImplementation(async (row) => row);
    comprasRepository.findOne.mockResolvedValue({
      ...compra,
      Estado: 'Aceptado',
      Items: [item],
      Ubicacion: { Id: 2, Codigo: 'POS_FUNA_UNA', Nombre: 'FUNA-UNA' },
    });

    await service.cambiarEstado(34, 'Aceptado');

    expect(balance.Stock).toBe(7);
    expect(balance.StockReservado).toBe(0);
    expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
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

    await expect(
      service.listarPropias(22, { page: '1', pageSize: '10' }),
    ).resolves.toEqual({
      data: [],
      page: 1,
      pageSize: 10,
      total: 0,
      totalPages: 1,
    });
  });

  it('rejects listarPropias without a valid usuarioId', async () => {
    await expect(service.listarPropias(0, {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.listarPropias(Number.NaN, {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('forces JWT usuarioId and ignores query.usuarioId override', async () => {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    comprasRepository.createQueryBuilder.mockReturnValue(qb);

    await service.listarPropias(22, {
      usuarioId: '999',
      estado: 'Rechazado',
      page: '1',
      pageSize: '10',
    });

    expect(qb.andWhere).toHaveBeenCalledWith('compra.UsuarioId = :usuarioId', {
      usuarioId: 22,
    });
    expect(qb.andWhere).toHaveBeenCalledWith('compra.Estado IN (:...estados)', {
      estados: ['Rechazado', 'Rechazada'],
    });
    expect(qb.andWhere).not.toHaveBeenCalledWith(
      'compra.UsuarioId = :usuarioId',
      { usuarioId: 999 },
    );
  });

  it('incluye compras web del punto asignado y las registradas por el vendedor', async () => {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    comprasRepository.createQueryBuilder.mockReturnValue(qb);
    const asignaciones = {
      idsUbicacionesActivas: jest.fn().mockResolvedValue([2, 3]),
    };
    const conAsignaciones = new ComprasService(
      comprasRepository as never,
      dataSource as never,
      clientesService as never,
      undefined,
      undefined,
      asignaciones as never,
    );

    await conAsignaciones.listarParaActor(
      { estado: 'Pendiente' },
      {
        userId: 7,
        roles: ['Vendedor'],
      },
    );

    expect(asignaciones.idsUbicacionesActivas).toHaveBeenCalledWith(7);
    expect(qb.andWhere).toHaveBeenCalledWith(
      '(compra.UsuarioId = :alcanceVendedorId OR compra.UbicacionId IN (:...puntosAsignados))',
      { alcanceVendedorId: 7, puntosAsignados: [2, 3] },
    );
    expect(qb.andWhere).toHaveBeenCalledWith(
      `(COALESCE(TRIM(compra.ComprobanteArchivo), '') <> '' OR compra.Estado NOT IN (:...estadosSinComprobanteOcultos))`,
      { estadosSinComprobanteOcultos: ['Pendiente', 'Borrador'] },
    );
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

    const result = await service.listarPropias(22, {
      page: '2',
      pageSize: '2',
    });
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
    expect(qb.andWhere).toHaveBeenCalledWith('compra.Estado IN (:...estados)', {
      estados: ['Entregado', 'Enviado', 'Enviada', 'Recibido', 'Pagado'],
    });
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
    expect(detalle.items[0].precioUnitario).toBe(113);
  });

  it('keeps the historical item name when the live product name differs', async () => {
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
          Nombre: 'Café histórico',
          Cantidad: 1,
          PrecioUnitario: '113',
          Subtotal: '113',
          Producto: { Id: '1', Nombre: 'Café renombrado', PrecioConIVA: '9999' },
        },
      ],
    });

    const detalle = await service.obtenerDetalleAutorizado(9, 4, ['Cliente']);
    expect(detalle.items[0].nombre).toBe('Café histórico');
    expect(detalle.items[0].precioUnitario).toBe(113);
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

  it('does not expose the client account as vendedor on web purchases', async () => {
    comprasRepository.findOne.mockResolvedValue({
      Id: 9,
      Numero: 'C-1794372220430-193',
      UsuarioId: 4,
      Fecha: new Date('2026-11-10T00:00:00Z'),
      ClienteNombre: 'Cliente',
      ClienteCorreo: 'cliente@una.cr',
      Subtotal: '3500',
      Impuestos: '0',
      Total: '3500',
      MetodoPago: 'Comprobante',
      Estado: 'Pendiente',
      FacturaId: null,
      Usuario: {
        Id: 4,
        Nombre: 'Cliente',
        Correo: 'cliente@una.cr',
        Roles: ['Cliente'],
      },
      Items: [],
    });

    const detalle = await service.obtenerDetalleAutorizado(9, 4, ['Cliente']);
    expect(detalle.vendedorNombre).toBe('');
    expect(detalle.vendedorCorreo).toBe('');
    expect(detalle.clienteNombre).toBe('Cliente');
  });

  it('keeps the cashier as vendedor on in-person sales', async () => {
    comprasRepository.findOne.mockResolvedValue({
      Id: 12,
      Numero: 'VP-12',
      UsuarioId: 8,
      Fecha: new Date('2026-11-10T00:00:00Z'),
      ClienteNombre: 'María Pérez',
      ClienteCorreo: 'maria@una.cr',
      Subtotal: '2000',
      Impuestos: '0',
      Total: '2000',
      MetodoPago: 'Efectivo',
      Estado: 'Entregado',
      FacturaId: null,
      Usuario: {
        Id: 8,
        Nombre: 'Ana Vendedora',
        Correo: 'ana.vendedor@una.cr',
        Roles: ['Vendedor'],
      },
      Items: [],
    });

    const detalle = await service.obtenerDetalleAutorizado(12, 1, ['Admin']);
    expect(detalle.vendedorNombre).toBe('Ana Vendedora');
    expect(detalle.vendedorCorreo).toBe('ana.vendedor@una.cr');
  });

  it('does not attach the cashier client file to an in-person sale', async () => {
    clientesService.obtenerFichaPorUsuarioId.mockResolvedValue({
      TipoCliente: 'Fisico',
      NombreLegal: 'Ana',
      Apellidos: 'Vendedora',
      Telefono: '8888-0000',
      TipoDocumento: 'Cédula',
      Identificacion: '1-1111-1111',
      Nacionalidad: 'Costarricense',
      RazonSocial: '',
      NombreComercial: '',
      RepresentanteLegal: '',
      CedulaJuridica: '',
      DireccionFiscal: 'Heredia',
      TelefonoOficina: '',
    });
    comprasRepository.findOne.mockResolvedValue({
      Id: 12,
      Numero: 'VP-12',
      UsuarioId: 8,
      Fecha: new Date('2026-11-10T00:00:00Z'),
      ClienteNombre: 'María Pérez',
      ClienteCorreo: 'maria@una.cr',
      Subtotal: '2000',
      Impuestos: '0',
      Total: '2000',
      MetodoPago: 'Efectivo',
      Estado: 'Enviado',
      FacturaId: null,
      Usuario: {
        Id: 8,
        Nombre: 'Ana Vendedora',
        Correo: 'ana.vendedor@una.cr',
        Roles: ['Vendedor'],
      },
      Items: [],
    });

    const detalle = await service.obtenerDetalleAutorizado(12, 1, ['Admin']);
    expect(detalle.cliente).toBeNull();
    expect(detalle.clienteNombre).toBe('María Pérez');
    expect(clientesService.obtenerFichaPorUsuarioId).not.toHaveBeenCalled();
  });

  it('shows the reviewer as vendedor on accepted online purchases', async () => {
    comprasRepository.findOne.mockResolvedValue({
      Id: 15,
      Numero: 'C-15',
      UsuarioId: 4,
      Fecha: new Date('2026-11-10T00:00:00Z'),
      ClienteNombre: 'Cliente',
      ClienteCorreo: 'cliente@una.cr',
      Subtotal: '3500',
      Impuestos: '0',
      Total: '3500',
      MetodoPago: 'Comprobante',
      Estado: 'Aceptado',
      FacturaId: null,
      RevisadoPorId: 2,
      RevisadoPorNombre: 'Admin Café',
      RevisadoPorCorreo: 'admin@una.cr',
      Usuario: {
        Id: 4,
        Nombre: 'Cliente',
        Correo: 'cliente@una.cr',
        Roles: ['Cliente'],
      },
      Items: [],
    });

    const detalle = await service.obtenerDetalleAutorizado(15, 4, ['Cliente']);
    expect(detalle.vendedorNombre).toBe('Admin Café');
    expect(detalle.vendedorCorreo).toBe('admin@una.cr');
  });

  it('stores the actor who accepts an online purchase as reviewer', async () => {
    const compra = {
      Id: 40,
      Numero: 'C-40',
      Estado: 'Pendiente',
      UbicacionId: 2,
      ComprobanteArchivo: null,
      UsuarioId: 4,
      RevisadoPorId: null,
      RevisadoPorNombre: '',
      RevisadoPorCorreo: '',
    };
    const item = {
      CompraId: 40,
      ProductoId: '101',
      Cantidad: 1,
      Nombre: 'Café',
    };
    const product = { Id: '101', Nombre: 'Café', Stock: 5 };
    const balance = {
      ProductoId: '101',
      UbicacionId: 2,
      Stock: 5,
      StockReservado: 1,
    };
    manager.findOne.mockImplementation(async (entity: unknown) => {
      if (entity === Compra) return compra;
      if (entity === Usuario) {
        return {
          Id: 2,
          Nombre: 'Admin Café',
          Correo: 'admin@una.cr',
          Roles: ['Admin'],
        };
      }
      if (entity === InventarioUbicacion) {
        return { Id: 2, Codigo: 'POS_FUNA_UNA', Nombre: 'FUNA-UNA' };
      }
      if (entity === Producto) return product;
      if (entity === InventarioStockUbicacion) return balance;
      return null;
    });
    manager.find.mockResolvedValue([item]);
    manager.save.mockImplementation(async (row) => row);
    comprasRepository.findOne.mockResolvedValue({
      ...compra,
      Estado: 'Aceptado',
      RevisadoPorId: 2,
      RevisadoPorNombre: 'Admin Café',
      RevisadoPorCorreo: 'admin@una.cr',
      Items: [item],
      Ubicacion: { Id: 2, Codigo: 'POS_FUNA_UNA', Nombre: 'FUNA-UNA' },
      Usuario: {
        Id: 4,
        Nombre: 'Cliente',
        Correo: 'cliente@una.cr',
        Roles: ['Cliente'],
      },
    });

    await service.cambiarEstado(40, 'Aceptado', {
      userId: 2,
      roles: ['Admin'],
    });

    expect(compra.RevisadoPorId).toBe(2);
    expect(compra.RevisadoPorNombre).toBe('Admin Café');
    expect(compra.RevisadoPorCorreo).toBe('admin@una.cr');
  });

  it('throws NotFound for missing purchase', async () => {
    comprasRepository.findOne.mockResolvedValue(null);
    await expect(
      service.obtenerDetalleAutorizado(404, 1, ['Admin']),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
