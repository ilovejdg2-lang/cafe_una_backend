import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CompraItem } from '../entities/compra-item.entity';
import { Compra } from '../entities/compra.entity';
import { Factura } from '../entities/factura.entity';
import { IFacturaRepository } from '../repositories/factura.repository.interface';
import { FacturaPdfService } from './factura-pdf.service';
import { FacturasNotificacionesService } from './facturas-notificaciones.service';
import { FacturasService } from './facturas.service';

describe('FacturasService', () => {
  let service: FacturasService;
  let mockFacturaRepo: Partial<IFacturaRepository>;
  let mockCompraRepo: any;
  let mockCompraItemRepo: any;
  let mockPdfService: Partial<FacturaPdfService>;
  let mockNotificacionesService: Partial<FacturasNotificacionesService>;

  const compraPrueba: Compra = {
    Id: 101,
    Numero: 'C-2026-101',
    UsuarioId: 5,
    ClienteNombre: 'María Vargas',
    ClienteCorreo: 'maria@ejemplo.com',
    Fecha: new Date(),
    Subtotal: '10000.00',
    Impuestos: '1300.00',
    Total: '11300.00',
    MetodoPago: 'Transferencia',
    Estado: 'Pendiente',
    FacturaId: null,
    UbicacionId: 1,
    ComprobanteArchivo: 'comprobante-101.jpg',
    Items: [
      {
        Id: 1,
        CompraId: 101,
        ProductoId: '1',
        Nombre: 'Café Grano Especial 500g',
        Cantidad: 2,
        PrecioUnitario: '5000.00',
        Subtotal: '10000.00',
      } as CompraItem,
    ],
  };

  const facturaPrueba: Factura = {
    Id: 'FAC-101-999',
    CompraId: 101,
    UsuarioId: 5,
    NumeroConsecutivo: 'FAC-2026-000001',
    Subtotal: '10000.00',
    Impuestos: '1300.00',
    Total: '11300.00',
    UrlPdf: '/facturas/FAC-101-999/pdf',
    ArchivoPdf: 'factura-FAC-2026-000001.pdf',
    FechaEmision: new Date(),
    Estado: 'Emitida',
    CreadaEn: new Date(),
    Items: [],
  };

  beforeEach(() => {
    mockFacturaRepo = {
      obtenerPorCompraId: jest.fn().mockResolvedValue(null),
      obtenerPorId: jest.fn().mockImplementation((id: string) =>
        Promise.resolve(id === facturaPrueba.Id ? facturaPrueba : null),
      ),
      guardarFacturaTransaccional: jest.fn().mockResolvedValue({
        ...facturaPrueba,
        Compra: compraPrueba,
      }),
      actualizarUrlPdf: jest.fn().mockResolvedValue(facturaPrueba),
      listarPorCliente: jest.fn().mockResolvedValue({
        items: [facturaPrueba],
        total: 1,
      }),
      listarTodas: jest.fn().mockResolvedValue({
        items: [facturaPrueba],
        total: 1,
      }),
    };

    mockCompraRepo = {
      manager: {
        findOne: jest.fn().mockImplementation((entity, opts) => {
          if (entity === Compra && opts?.where?.Id === 101) {
            return Promise.resolve(compraPrueba);
          }
          return Promise.resolve(null);
        }),
        find: jest.fn().mockResolvedValue(compraPrueba.Items),
      },
      findOne: jest.fn().mockImplementation((opts) => {
        if (opts?.where?.Id === 101) return Promise.resolve(compraPrueba);
        return Promise.resolve(null);
      }),
    };

    mockCompraItemRepo = {
      find: jest.fn().mockResolvedValue(compraPrueba.Items),
    };

    mockPdfService = {
      generarPdfFactura: jest.fn().mockResolvedValue({
        filename: 'factura-FAC-2026-000001.pdf',
        filePath: '/tmp/factura-FAC-2026-000001.pdf',
        url: '/facturas/FAC-101-999/pdf',
        buffer: Buffer.from('%PDF-1.4 test'),
      }),
    };

    mockNotificacionesService = {
      enviarFacturaPorCorreo: jest.fn().mockResolvedValue(true),
      enviarActualizacionEstadoCompra: jest.fn().mockResolvedValue(true),
    };

    service = new FacturasService(
      mockFacturaRepo as IFacturaRepository,
      mockCompraRepo,
      mockCompraItemRepo,
      mockPdfService as FacturaPdfService,
      mockNotificacionesService as FacturasNotificacionesService,
    );
  });

  describe('generarFacturaParaCompra', () => {
    it('genera la factura atómicamente a partir de una orden existente', async () => {
      const factura = await service.generarFacturaParaCompra(101, 5);

      expect(factura).toBeDefined();
      expect(mockFacturaRepo.guardarFacturaTransaccional).toHaveBeenCalledTimes(1);
      expect(mockPdfService.generarPdfFactura).toHaveBeenCalledTimes(1);
      expect(mockFacturaRepo.actualizarUrlPdf).toHaveBeenCalledWith(
        facturaPrueba.Id,
        '/facturas/FAC-101-999/pdf',
        'factura-FAC-2026-000001.pdf',
        undefined,
      );
    });

    it('devuelve la factura existente si ya fue creada previamente', async () => {
      (mockFacturaRepo.obtenerPorCompraId as jest.Mock).mockResolvedValueOnce(facturaPrueba);

      const resultado = await service.generarFacturaParaCompra(101, 5);

      expect(resultado).toBe(facturaPrueba);
      expect(mockFacturaRepo.guardarFacturaTransaccional).not.toHaveBeenCalled();
    });

    it('arroja NotFoundException si la compra no existe', async () => {
      await expect(service.generarFacturaParaCompra(999, 5)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('arroja BadRequestException con identificador inválido', async () => {
      await expect(service.generarFacturaParaCompra(-1)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('consultas de facturas', () => {
    it('obtiene factura por su ID', async () => {
      const resultado = await service.obtenerPorId('FAC-101-999');
      expect(resultado.Id).toBe('FAC-101-999');
    });

    it('arroja NotFoundException si el id de factura no existe', async () => {
      await expect(service.obtenerPorId('INEXISTENTE')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lista facturas del cliente autenticado', async () => {
      const { items, total } = await service.listarMias(5, { page: '1', pageSize: '10' });
      expect(total).toBe(1);
      expect(items.length).toBe(1);
      expect(mockFacturaRepo.listarPorCliente).toHaveBeenCalledWith(5, {
        page: 1,
        pageSize: 10,
        q: undefined,
        estado: undefined,
      });
    });

    it('lista todas las facturas para administración', async () => {
      const { items, total } = await service.listarTodas({ page: '1' });
      expect(total).toBe(1);
      expect(items.length).toBe(1);
      expect(mockFacturaRepo.listarTodas).toHaveBeenCalled();
    });
  });
});
