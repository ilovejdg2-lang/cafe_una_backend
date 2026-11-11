import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { InventarioStockUbicacion } from '../entities/inventario-stock-ubicacion.entity';
import { InventarioUbicacion } from '../entities/inventario-ubicacion.entity';
import { Producto } from '../entities/producto.entity';
import { Usuario } from '../entities/usuario.entity';
import {
  resolverPrecioCatalogo,
  VentasPresencialesService,
} from './ventas-presenciales.service';

const ubicacion = {
  Id: 4,
  Codigo: 'POS_QA_CAFEUNA',
  Nombre: 'QA Café UNA',
  Activo: true,
};

const producto = {
  Id: '101',
  Nombre: 'QA_CAFEUNA_Cafe',
  Estado: 'Habilitado',
  PrecioNormal: '1000.00',
  PrecioConIVA: '1130.00',
  Stock: 5,
};

function crearServicio(findOne: jest.Mock) {
  const saves: unknown[] = [];
  const queryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      findOne,
      create: jest.fn((_entity: unknown, row: unknown) => row),
      save: jest.fn(async (row: unknown) => {
        saves.push(row);
        if (Array.isArray(row)) return row;
        const registro = row as { Tipo?: string; Numero?: string };
        if (registro.Tipo === 'venta_presencial') return { ...registro, Id: '900' };
        if (registro.Numero) return { ...registro, Id: 55 };
        return row;
      }),
    },
  };
  const service = new VentasPresencialesService(
    { createQueryRunner: () => queryRunner } as never,
    { enviarComprobanteVentaFisica: jest.fn() } as never,
    { exigirVentaEnPunto: jest.fn() } as never,
  );
  return { service, queryRunner, saves };
}

describe('resolverPrecioCatalogo', () => {
  it('usa el precio con IVA del catálogo', () => {
    expect(resolverPrecioCatalogo(producto, undefined)).toBe(1130);
  });

  it('rechaza un precio alterado en la petición', () => {
    expect(() => resolverPrecioCatalogo(producto, 1)).toThrow(BadRequestException);
  });
});

describe('VentasPresencialesService registrar', () => {
  it('no descuenta stock ni confirma la venta si el precio no es el del catálogo', async () => {
    const balance = { ProductoId: '101', UbicacionId: 4, Stock: 5, StockReservado: 0 };
    const findOne = jest.fn(async (entity: unknown) => {
      if (entity === InventarioUbicacion) return ubicacion;
      if (entity === Usuario) return { Id: 7, Nombre: 'Vendedor QA', Correo: 'qa@cafeuna.test' };
      if (entity === Producto) return producto;
      if (entity === InventarioStockUbicacion) return balance;
      return null;
    });
    const { service, queryRunner, saves } = crearServicio(findOne);

    await expect(
      service.registrar(
        {
          ubicacionId: 4,
          items: [{ productoId: '101', cantidad: 1, precioUnitario: 1 }],
        },
        7,
        ['Vendedor'],
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(balance.Stock).toBe(5);
    expect(saves).toHaveLength(0);
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
  });

  it('rechaza vender unidades ya reservadas y conserva el stock físico', async () => {
    const balance = { ProductoId: '101', UbicacionId: 4, Stock: 5, StockReservado: 4 };
    const findOne = jest.fn(async (entity: unknown) => {
      if (entity === InventarioUbicacion) return ubicacion;
      if (entity === Usuario) return { Id: 7, Nombre: 'Vendedor QA' };
      if (entity === Producto) return producto;
      if (entity === InventarioStockUbicacion) return balance;
      return null;
    });
    const { service, queryRunner } = crearServicio(findOne);

    await expect(
      service.registrar(
        {
          ubicacionId: 4,
          items: [{ productoId: '101', cantidad: 2, precioUnitario: 1130 }],
        },
        7,
        ['Vendedor'],
      ),
    ).rejects.toThrow(/Stock insuficiente/);

    expect(balance.Stock).toBe(5);
    expect(balance.StockReservado).toBe(4);
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
  });

  it('guarda el precio de catálogo, el cajero y descuenta solo el stock libre', async () => {
    const balance = { ProductoId: '101', UbicacionId: 4, Stock: 5, StockReservado: 1 };
    const findOne = jest.fn(async (entity: unknown) => {
      if (entity === InventarioUbicacion) return ubicacion;
      if (entity === Usuario) return { Id: 7, Nombre: 'Vendedor QA', Correo: 'qa@cafeuna.test' };
      if (entity === Producto) return producto;
      if (entity === InventarioStockUbicacion) return balance;
      return null;
    });
    const { service, queryRunner, saves } = crearServicio(findOne);

    const venta = await service.registrar(
      {
        ubicacionCodigo: 'POS_QA_CAFEUNA',
        clienteNombre: 'Cliente QA',
        clienteCorreo: '',
        metodoPago: 'Efectivo',
        items: [
          { productoId: '101', cantidad: 2, precioUnitario: 1130, subtotal: 1 },
        ],
      },
      7,
      ['Vendedor'],
    );

    expect(venta.total).toBe(2260);
    expect(venta.compraId).toBe(55);
    expect(venta.facturaId).toMatch(/^FAC-VP-/);
    expect(saves).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          CompraId: 55,
          Monto: '2260.00',
          Metodo: 'Efectivo',
          Estado: 'Pagado',
        }),
        expect.objectContaining({
          Id: venta.facturaId,
          CompraId: 55,
          Total: '2260.00',
          Estado: 'Emitida',
        }),
      ]),
    );
    expect(venta.ubicacionCodigo).toBe('POS_QA_CAFEUNA');
    expect(venta.responsableId).toBe(7);
    expect(balance.Stock).toBe(3);
    expect(balance.StockReservado).toBe(1);
    const items = saves.find((row) => Array.isArray(row)) as Array<{
      PrecioUnitario: string;
      Subtotal: string;
      Nombre: string;
      Cantidad: number;
    }>;
    expect(items[0]).toMatchObject({
      Nombre: 'QA_CAFEUNA_Cafe',
      Cantidad: 2,
      PrecioUnitario: '1130.00',
      Subtotal: '2260.00',
    });
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
    expect(findOne).toHaveBeenCalledWith(Producto, expect.anything());
  });

  it('rechaza una venta sin productos', async () => {
    const findOne = jest.fn(async (entity: unknown) => {
      if (entity === InventarioUbicacion) return ubicacion;
      if (entity === Usuario) return { Id: 7, Nombre: 'Vendedor QA' };
      return null;
    });
    const { service, queryRunner } = crearServicio(findOne);

    await expect(
      service.registrar({ ubicacionId: 4, items: [] }, 7, ['Vendedor']),
    ).rejects.toThrow(/obligatorio/);
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
  });

  it('rechaza un producto deshabilitado', async () => {
    const findOne = jest.fn(async (entity: unknown) => {
      if (entity === InventarioUbicacion) return ubicacion;
      if (entity === Usuario) return { Id: 7, Nombre: 'Vendedor QA' };
      if (entity === Producto) return { ...producto, Estado: 'Deshabilitado' };
      return null;
    });
    const { service } = crearServicio(findOne);

    await expect(
      service.registrar(
        { ubicacionId: 4, items: [{ productoId: '101', cantidad: 1 }] },
        7,
        ['Vendedor'],
      ),
    ).rejects.toThrow(/deshabilitado/);
  });

  it('hace rollback si el punto no está asignado al vendedor', async () => {
    const queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        findOne: jest.fn(async (entity: unknown) =>
          entity === InventarioUbicacion ? ubicacion : null,
        ),
        save: jest.fn(),
      },
    };
    const service = new VentasPresencialesService(
      { createQueryRunner: () => queryRunner } as never,
      { enviarComprobanteVentaFisica: jest.fn() } as never,
      {
        exigirVentaEnPunto: jest
          .fn()
          .mockRejectedValue(new ForbiddenException('No tienes una asignación activa para este punto de venta.')),
      } as never,
    );

    await expect(
      service.registrar(
        { ubicacionId: 4, items: [{ productoId: '101', cantidad: 1 }] },
        7,
        ['Vendedor'],
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(queryRunner.manager.save).not.toHaveBeenCalled();
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
  });
});
