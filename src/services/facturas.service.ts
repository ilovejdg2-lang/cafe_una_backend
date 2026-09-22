import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { resolverArchivoUpload } from '../common/upload-paths';
import { CompraItem } from '../entities/compra-item.entity';
import { Compra } from '../entities/compra.entity';
import { Factura } from '../entities/factura.entity';
import {
  FACTURA_REPOSITORY,
} from '../repositories/factura.repository.interface';
import type {
  FiltrosListarFacturas,
  IFacturaRepository,
} from '../repositories/factura.repository.interface';
import {
  FACTURAS_SUBDIR,
  FacturaPdfService,
} from './factura-pdf.service';
import { FacturasNotificacionesService } from './facturas-notificaciones.service';

@Injectable()
export class FacturasService {
  private readonly logger = new Logger(FacturasService.name);

  constructor(
    @Inject(FACTURA_REPOSITORY)
    private readonly facturaRepo: IFacturaRepository,
    @InjectRepository(Compra)
    private readonly compraRepo: Repository<Compra>,
    @InjectRepository(CompraItem)
    private readonly compraItemRepo: Repository<CompraItem>,
    private readonly pdfService: FacturaPdfService,
    private readonly notificacionesService: FacturasNotificacionesService,
  ) {}

  /**
   * Genera y persiste la factura de forma atómica a partir de una orden de compra,
   * crea el archivo PDF y dispara en segundo plano el envío del correo con el PDF adjunto.
   */
  async generarFacturaParaCompra(
    compraId: number,
    usuarioId?: number | null,
    manager?: EntityManager,
  ): Promise<Factura> {
    const cid = Number(compraId);
    if (!Number.isFinite(cid) || cid <= 0) {
      throw new BadRequestException('ID de compra inválido.');
    }

    // 1. Verificar si ya existe una factura para esta compra
    const existente = await this.facturaRepo.obtenerPorCompraId(cid);
    if (existente) {
      return existente;
    }

    // 2. Obtener compra e ítems
    const em = manager || this.compraRepo.manager;
    const compra = await em.findOne(Compra, {
      where: { Id: cid },
      relations: ['Items', 'Usuario'],
    });

    if (!compra) {
      throw new NotFoundException(`No se encontró la compra con ID ${cid}.`);
    }

    const items =
      compra.Items && compra.Items.length > 0
        ? compra.Items
        : await em.find(CompraItem, { where: { CompraId: cid } });

    const subtotal = Number(compra.Subtotal || 0);
    const impuestos = Number(compra.Impuestos || 0);
    const total = Number(compra.Total || 0);

    const itemsFactura = items.map((it) => ({
      productoId: it.ProductoId ? String(it.ProductoId) : null,
      descripcion: it.Nombre,
      cantidad: it.Cantidad,
      precioUnitario: Number(it.PrecioUnitario || 0),
      subtotal: Number(it.Subtotal || 0),
    }));

    // 3. Guardar factura atómicamente
    const factura = await this.facturaRepo.guardarFacturaTransaccional(
      {
        compraId: compra.Id,
        usuarioId: usuarioId !== undefined ? usuarioId : compra.UsuarioId,
        subtotal,
        impuestos,
        total,
        estado: 'Emitida',
        items: itemsFactura,
      },
      manager,
    );

    // Adjuntar la compra completa para la generación del PDF
    factura.Compra = compra;

    // 4. Generar documento PDF y actualizar registro
    try {
      const { filename, url, buffer } = await this.pdfService.generarPdfFactura(factura);
      await this.facturaRepo.actualizarUrlPdf(factura.Id, url, filename, manager);
      factura.UrlPdf = url;
      factura.ArchivoPdf = filename;

      // 5. Envío en segundo plano para no demorar la respuesta al usuario
      setImmediate(async () => {
        try {
          await this.notificacionesService.enviarFacturaPorCorreo(
            factura,
            buffer,
            filename,
          );
        } catch (err) {
          this.logger.error(
            `Fallo en el listener de envío de correo para factura ${factura.Id}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      });
    } catch (err) {
      this.logger.error(
        `Error al generar PDF de factura para compra #${cid}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    return factura;
  }

  /**
   * Genera (si aún no existe) y envía la factura en PDF por correo al cliente.
   * Usado cuando una orden/solicitud de compra es aceptada.
   */
  async enviarFacturaPorCompra(compraId: number): Promise<{
    enviado: boolean;
    buffer: Buffer;
    filename: string;
    factura: Factura;
  }> {
    const cid = Number(compraId);
    if (!Number.isFinite(cid) || cid <= 0) {
      throw new BadRequestException('ID de compra inválido.');
    }

    let factura = await this.facturaRepo.obtenerPorCompraId(cid);
    if (!factura) {
      factura = await this.generarFacturaParaCompra(cid);
    }

    if (!factura) {
      throw new NotFoundException(
        `No se pudo obtener ni generar la factura para la compra #${cid}.`,
      );
    }

    // Asegurar relaciones necesarias para el PDF y correo
    if (!factura.Compra || !factura.Compra.Items || factura.Compra.Items.length === 0) {
      const compra = await this.compraRepo.findOne({
        where: { Id: cid },
        relations: ['Items', 'Usuario'],
      });
      if (compra) {
        factura.Compra = compra;
        if (!factura.Items || factura.Items.length === 0) {
          factura.Items = (compra.Items || []).map((it) => ({
            id: it.Id,
            facturaId: factura.Id,
            productoId: it.ProductoId ? String(it.ProductoId) : null,
            descripcion: it.Nombre,
            cantidad: it.Cantidad,
            precioUnitario: Number(it.PrecioUnitario || 0),
            subtotal: Number(it.Subtotal || 0),
          })) as any;
        }
      }
    }

    const { filename, url, buffer } = await this.pdfService.generarPdfFactura(factura);
    if (!factura.UrlPdf) {
      await this.facturaRepo.actualizarUrlPdf(factura.Id, url, filename);
      factura.UrlPdf = url;
      factura.ArchivoPdf = filename;
    }

    const enviado = await this.notificacionesService.enviarFacturaPorCorreo(
      factura,
      buffer,
      filename,
    );

    return { enviado, buffer, filename, factura };
  }

  async obtenerPorId(id: string): Promise<Factura> {
    const factura = await this.facturaRepo.obtenerPorId(id);
    if (!factura) {
      throw new NotFoundException(`Factura con id '${id}' no encontrada.`);
    }
    return factura;
  }

  async obtenerPorCompraId(compraId: number): Promise<Factura> {
    const factura = await this.facturaRepo.obtenerPorCompraId(compraId);
    if (!factura) {
      throw new NotFoundException(
        `No hay factura asociada a la compra #${compraId}.`,
      );
    }
    return factura;
  }

  async listarMias(
    usuarioId: number,
    query?: Record<string, string | undefined>,
  ): Promise<{ items: Factura[]; total: number }> {
    const uid = Number(usuarioId);
    if (!Number.isFinite(uid) || uid <= 0) {
      throw new BadRequestException('Usuario no válido para listar facturas.');
    }
    const filtros: FiltrosListarFacturas = {
      page: Number(query?.page) || 1,
      pageSize: Number(query?.pageSize) || 10,
      q: query?.q,
      estado: query?.estado,
    };
    return this.facturaRepo.listarPorCliente(uid, filtros);
  }

  async listarTodas(
    query?: Record<string, string | undefined>,
  ): Promise<{ items: Factura[]; total: number }> {
    const filtros: FiltrosListarFacturas = {
      page: Number(query?.page) || 1,
      pageSize: Number(query?.pageSize) || 10,
      q: query?.q,
      estado: query?.estado,
    };
    return this.facturaRepo.listarTodas(filtros);
  }

  /**
   * Resuelve la ruta física del archivo PDF de la factura para streaming seguro.
   */
  async obtenerRutaArchivoPdf(idOrCompraId: string | number): Promise<{
    filePath: string;
    filename: string;
  }> {
    let factura: Factura | null = null;
    if (typeof idOrCompraId === 'number' || /^\d+$/.test(String(idOrCompraId))) {
      factura = await this.facturaRepo.obtenerPorCompraId(Number(idOrCompraId));
    }
    if (!factura && typeof idOrCompraId === 'string') {
      factura = await this.facturaRepo.obtenerPorId(idOrCompraId);
    }

    if (!factura) {
      throw new NotFoundException('La factura solicitada no existe.');
    }

    let absolute = factura.ArchivoPdf
      ? resolverArchivoUpload(FACTURAS_SUBDIR, factura.ArchivoPdf)
      : null;

    // Regenerar si nunca se guardó el nombre o si el archivo ya no está en disco
    // (p. ej. redeploy, carpeta uploads limpia, otro entorno).
    if (!absolute) {
      const resultado = await this.pdfService.generarPdfFactura(factura);
      await this.facturaRepo.actualizarUrlPdf(
        factura.Id,
        resultado.url,
        resultado.filename,
      );
      factura.ArchivoPdf = resultado.filename;
      absolute = resultado.filePath;
    }

    if (!absolute || !factura.ArchivoPdf) {
      throw new NotFoundException(
        'El archivo PDF de la factura no se encuentra en el servidor.',
      );
    }

    return {
      filePath: absolute,
      filename: factura.ArchivoPdf,
    };
  }
}
