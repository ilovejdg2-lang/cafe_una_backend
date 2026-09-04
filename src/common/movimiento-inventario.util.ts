import { EntityManager } from 'typeorm';
import { MovimientoInventario } from '../entities/movimiento-inventario.entity';

export const TIPO_MOVIMIENTO = {
  ENTRADA: 'entrada',
  TRANSFERENCIA: 'transferencia',
  VENTA_PRESENCIAL: 'venta_presencial',
  VENTA_WEB: 'venta_web',
} as const;

export type TipoMovimientoInventario =
  (typeof TIPO_MOVIMIENTO)[keyof typeof TIPO_MOVIMIENTO];

const TIPOS_CANONICOS = new Set<string>(Object.values(TIPO_MOVIMIENTO));

const ALIAS_TIPO: Record<string, TipoMovimientoInventario> = {
  entrada: TIPO_MOVIMIENTO.ENTRADA,
  transferencia: TIPO_MOVIMIENTO.TRANSFERENCIA,
  venta_presencial: TIPO_MOVIMIENTO.VENTA_PRESENCIAL,
  'venta presencial': TIPO_MOVIMIENTO.VENTA_PRESENCIAL,
  venta: TIPO_MOVIMIENTO.VENTA_PRESENCIAL,
  venta_web: TIPO_MOVIMIENTO.VENTA_WEB,
  'venta web': TIPO_MOVIMIENTO.VENTA_WEB,
};

export function normalizarTipoMovimiento(
  raw: unknown,
): TipoMovimientoInventario | null {
  const clave = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  const conEspacio = String(raw ?? '').trim().toLowerCase();
  return ALIAS_TIPO[clave] ?? ALIAS_TIPO[conEspacio] ?? null;
}

export function esTipoMovimientoCanonico(valor: string): boolean {
  return TIPOS_CANONICOS.has(valor);
}

export function valoresTipoParaFiltro(tipo: TipoMovimientoInventario): string[] {
  if (tipo === TIPO_MOVIMIENTO.VENTA_PRESENCIAL) {
    return [tipo, 'Venta presencial', 'venta presencial'];
  }
  if (tipo === TIPO_MOVIMIENTO.VENTA_WEB) {
    return [tipo, 'Venta web', 'venta web'];
  }
  if (tipo === TIPO_MOVIMIENTO.ENTRADA) {
    return [tipo, 'Entrada'];
  }
  if (tipo === TIPO_MOVIMIENTO.TRANSFERENCIA) {
    return [tipo, 'Transferencia'];
  }
  return [tipo];
}

export async function insertarMovimientoInventario(
  manager: EntityManager,
  datos: {
    tipo: TipoMovimientoInventario;
    productoId: string;
    cantidad: number;
    responsableId?: number | null;
    responsableNombre?: string;
    notas?: string;
    solicitudId?: string | null;
    ubicacionId?: number | null;
    ubicacionOrigenId?: number | null;
    ubicacionDestinoId?: number | null;
    fecha?: Date;
  },
): Promise<MovimientoInventario> {
  const notas = String(datos.notas ?? '').slice(0, 500);
  const responsableNombre = String(datos.responsableNombre ?? '').slice(0, 200);
  const ubicacionId =
    datos.ubicacionId ??
    datos.ubicacionOrigenId ??
    datos.ubicacionDestinoId ??
    null;

  return manager.save(
    manager.create(MovimientoInventario, {
      Tipo: datos.tipo,
      ProductoId: String(datos.productoId),
      Cantidad: datos.cantidad,
      ResponsableNombre: responsableNombre,
      ResponsableId: datos.responsableId ?? null,
      Observaciones: notas,
      Notas: notas,
      SolicitudId: datos.solicitudId ?? null,
      UbicacionId: ubicacionId,
      UbicacionOrigenId: datos.ubicacionOrigenId ?? null,
      UbicacionDestinoId: datos.ubicacionDestinoId ?? null,
      Fecha: datos.fecha ?? new Date(),
    }),
  );
}
