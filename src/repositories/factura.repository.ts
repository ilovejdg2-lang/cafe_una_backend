import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Compra } from '../entities/compra.entity';
import { FacturaItem } from '../entities/factura-item.entity';
import { Factura } from '../entities/factura.entity';
import {
  DatosGuardarFactura,
  FiltrosListarFacturas,
  IFacturaRepository,
} from './factura.repository.interface';

@Injectable()
export class FacturaRepository implements IFacturaRepository {
  constructor(
    @InjectRepository(Factura)
    private readonly repo: Repository<Factura>,
    @InjectRepository(FacturaItem)
    private readonly itemRepo: Repository<FacturaItem>,
    private readonly dataSource: DataSource,
  ) {}

  async guardarFacturaTransaccional(
    datos: DatosGuardarFactura,
    manager?: EntityManager,
  ): Promise<Factura> {
    const ejecutar = async (em: EntityManager): Promise<Factura> => {
      // Si ya existe factura para esta compra, recuperarla
      if (datos.compraId) {
        const existente = await em.findOne(Factura, {
          where: { CompraId: datos.compraId },
          relations: ['Items', 'Compra', 'Usuario'],
        });
        if (existente) {
          return existente;
        }
      }

      const consecutivo =
        datos.numeroConsecutivo ||
        (await this.generarConsecutivoSiguiente(em));

      const id =
        datos.id ||
        `FAC-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;

      const factura = em.create(Factura, {
        Id: id,
        CompraId: datos.compraId,
        UsuarioId: datos.usuarioId ?? null,
        NumeroConsecutivo: consecutivo,
        Subtotal: Number(datos.subtotal || 0).toFixed(2),
        Impuestos: Number(datos.impuestos || 0).toFixed(2),
        Total: Number(datos.total || 0).toFixed(2),
        UrlPdf: datos.urlPdf ?? null,
        ArchivoPdf: datos.archivoPdf ?? null,
        Estado: datos.estado || 'Emitida',
        FechaEmision: new Date(),
      });

      await em.save(Factura, factura);

      if (datos.items && datos.items.length > 0) {
        const itemsEntidades = datos.items.map((it) =>
          em.create(FacturaItem, {
            FacturaId: factura.Id,
            ProductoId: it.productoId ? String(it.productoId) : null,
            Descripcion: it.descripcion.slice(0, 250),
            Cantidad: it.cantidad,
            PrecioUnitario: Number(it.precioUnitario || 0).toFixed(2),
            Subtotal: Number(it.subtotal || 0).toFixed(2),
          }),
        );
        await em.save(FacturaItem, itemsEntidades);
        factura.Items = itemsEntidades;
      } else {
        factura.Items = [];
      }

      // Sincronizar enlace en la tabla compras
      if (datos.compraId) {
        await em.update(
          Compra,
          { Id: datos.compraId },
          { FacturaId: factura.Id },
        );
      }

      return (await em.findOne(Factura, {
        where: { Id: factura.Id },
        relations: ['Items', 'Compra', 'Usuario'],
      })) as Factura;
    };

    if (manager) {
      return ejecutar(manager);
    }
    return this.dataSource.transaction(async (trx) => ejecutar(trx));
  }

  async obtenerPorId(id: string): Promise<Factura | null> {
    if (!id?.trim()) return null;
    return this.repo.findOne({
      where: { Id: id.trim() },
      relations: ['Items', 'Compra', 'Usuario'],
    });
  }

  async obtenerPorCompraId(compraId: number): Promise<Factura | null> {
    if (!Number.isFinite(compraId) || compraId <= 0) return null;
    return this.repo.findOne({
      where: { CompraId: compraId },
      relations: ['Items', 'Compra', 'Usuario'],
    });
  }

  async listarPorCliente(
    usuarioId: number,
    filtros?: FiltrosListarFacturas,
  ): Promise<{ items: Factura[]; total: number }> {
    const page = Math.max(1, Number(filtros?.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(filtros?.pageSize) || 10));

    const qb = this.repo
      .createQueryBuilder('factura')
      .leftJoinAndSelect('factura.Items', 'items')
      .leftJoinAndSelect('factura.Compra', 'compra')
      .where('(factura.UsuarioId = :usuarioId OR compra.UsuarioId = :usuarioId)', {
        usuarioId,
      })
      .orderBy('factura.FechaEmision', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (filtros?.estado?.trim()) {
      qb.andWhere('factura.Estado = :estado', { estado: filtros.estado.trim() });
    }

    if (filtros?.q?.trim()) {
      qb.andWhere(
        '(factura.NumeroConsecutivo ILIKE :q OR compra.Numero ILIKE :q OR compra.ClienteNombre ILIKE :q)',
        { q: `%${filtros.q.trim()}%` },
      );
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async listarTodas(
    filtros?: FiltrosListarFacturas,
  ): Promise<{ items: Factura[]; total: number }> {
    const page = Math.max(1, Number(filtros?.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(filtros?.pageSize) || 10));

    const qb = this.repo
      .createQueryBuilder('factura')
      .leftJoinAndSelect('factura.Items', 'items')
      .leftJoinAndSelect('factura.Compra', 'compra')
      .leftJoinAndSelect('factura.Usuario', 'usuario')
      .orderBy('factura.FechaEmision', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (filtros?.estado?.trim()) {
      qb.andWhere('factura.Estado = :estado', { estado: filtros.estado.trim() });
    }

    if (filtros?.q?.trim()) {
      qb.andWhere(
        '(factura.NumeroConsecutivo ILIKE :q OR compra.Numero ILIKE :q OR compra.ClienteNombre ILIKE :q OR compra.ClienteCorreo ILIKE :q)',
        { q: `%${filtros.q.trim()}%` },
      );
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async generarConsecutivoSiguiente(
    manager?: EntityManager,
  ): Promise<string> {
    const em = manager || this.dataSource.manager;
    const year = new Date().getFullYear();
    const prefix = `FAC-${year}-`;

    const result = await em
      .createQueryBuilder(Factura, 'f')
      .select('f.NumeroConsecutivo', 'consecutivo')
      .where('f.NumeroConsecutivo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('f.NumeroConsecutivo', 'DESC')
      .limit(1)
      .getRawOne<{ consecutivo?: string }>();

    let correlativo = 1;
    if (result?.consecutivo) {
      const parts = result.consecutivo.split('-');
      const ultimo = Number(parts[parts.length - 1]);
      if (Number.isFinite(ultimo) && ultimo > 0) {
        correlativo = ultimo + 1;
      }
    }

    return `${prefix}${String(correlativo).padStart(6, '0')}`;
  }

  async actualizarUrlPdf(
    id: string,
    urlPdf: string,
    archivoPdf: string,
    manager?: EntityManager,
  ): Promise<Factura | null> {
    const em = manager || this.repo.manager;
    await em.update(Factura, { Id: id }, { UrlPdf: urlPdf, ArchivoPdf: archivoPdf });
    return this.obtenerPorId(id);
  }
}
