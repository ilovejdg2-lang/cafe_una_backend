import { EntityManager } from 'typeorm';
import { Factura } from '../entities/factura.entity';

export type DatosItemFactura = {
  productoId?: string | null;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
};

export type DatosGuardarFactura = {
  id?: string;
  compraId: number;
  usuarioId?: number | null;
  numeroConsecutivo?: string;
  subtotal: number;
  impuestos: number;
  total: number;
  urlPdf?: string | null;
  archivoPdf?: string | null;
  estado?: string;
  items: DatosItemFactura[];
};

export type FiltrosListarFacturas = {
  page?: number;
  pageSize?: number;
  q?: string;
  estado?: string;
  desde?: string;
  hasta?: string;
};

export interface IFacturaRepository {
  guardarFacturaTransaccional(
    datos: DatosGuardarFactura,
    manager?: EntityManager,
  ): Promise<Factura>;

  obtenerPorId(id: string): Promise<Factura | null>;

  obtenerPorCompraId(compraId: number): Promise<Factura | null>;

  listarPorCliente(
    usuarioId: number,
    filtros?: FiltrosListarFacturas,
  ): Promise<{ items: Factura[]; total: number }>;

  listarTodas(
    filtros?: FiltrosListarFacturas,
  ): Promise<{ items: Factura[]; total: number }>;

  generarConsecutivoSiguiente(manager?: EntityManager): Promise<string>;

  actualizarUrlPdf(
    id: string,
    urlPdf: string,
    archivoPdf: string,
    manager?: EntityManager,
  ): Promise<Factura | null>;
}

export const FACTURA_REPOSITORY = 'IFacturaRepository';
