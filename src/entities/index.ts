import { ActivoFijo } from './activo-fijo.entity';
import { Auditoria } from './auditoria.entity';
import { CompraItem } from './compra-item.entity';
import { Compra } from './compra.entity';
import { CambioCorreoPendiente } from './cambio-correo-pendiente.entity';
import { Categoria } from './categoria.entity';
import { DetalleSolicitud } from './detalle-solicitud.entity';
import { EnlaceSitio } from './enlace-sitio.entity';
import { GaleriaInstitucionalItem } from './galeria-institucional-item.entity';
import { HeroPrincipal } from './hero-principal.entity';
import { InformacionFooter } from './informacion-footer.entity';
import { InformacionNavbar } from './informacion-navbar.entity';
import { InventarioStockUbicacion } from './inventario-stock-ubicacion.entity';
import { InventarioUbicacion } from './inventario-ubicacion.entity';
import { MovimientoInventario } from './movimiento-inventario.entity';
import { PasswordResetEntry } from './password-reset-entry.entity';
import { Producto } from './producto.entity';
import { Proveedor } from './proveedor.entity';
import { RegistroPendiente } from './registro-pendiente.entity';
import { SolicitudCompra } from './solicitud-compra.entity';
import { SolicitudVoluntariado } from './solicitud-voluntariado.entity';
import { TarjetaInicio } from './tarjeta-inicio.entity';
import { TextoInstitucional } from './texto-institucional.entity';
import { Transferencia } from './transferencia.entity';
import { UsuarioCreacionPendiente } from './usuario-creacion-pendiente.entity';
import { Usuario } from './usuario.entity';
import { Rol } from './rol.entity';
import { Permiso } from './permiso.entity';
import { RolPermiso } from './rol-permiso.entity';
import { AjusteSistema } from './ajuste-sistema.entity';
import { DisponibilidadGrupo } from './disponibilidad-grupo.entity';
import { DonacionNecesidad } from './donacion-necesidad.entity';
import { DonacionSolicitud } from './donacion-solicitud.entity';

export const entities = [
  Usuario,
  Producto,
  Categoria,
  HeroPrincipal,
  TextoInstitucional,
  TarjetaInicio,
  InformacionNavbar,
  InformacionFooter,
  EnlaceSitio,
  GaleriaInstitucionalItem,
  SolicitudVoluntariado,
  PasswordResetEntry,
  RegistroPendiente,
  CambioCorreoPendiente,
  UsuarioCreacionPendiente,
  Auditoria,
  InventarioUbicacion,
  InventarioStockUbicacion,
  ActivoFijo,
  Compra,
  CompraItem,
  Transferencia,
  Proveedor,
  SolicitudCompra,
  DetalleSolicitud,
  MovimientoInventario,
  Rol,
  Permiso,
  RolPermiso,
  DisponibilidadGrupo,
  AjusteSistema,
  DonacionNecesidad,
  DonacionSolicitud,
];

export * from './usuario.entity';
export * from './producto.entity';
export * from './categoria.entity';
export * from './hero-principal.entity';
export * from './texto-institucional.entity';
export * from './tarjeta-inicio.entity';
export * from './informacion-navbar.entity';
export * from './informacion-footer.entity';
export * from './enlace-sitio.entity';
export * from './galeria-institucional-item.entity';
export * from './solicitud-voluntariado.entity';
export * from './password-reset-entry.entity';
export * from './registro-pendiente.entity';
export * from './cambio-correo-pendiente.entity';
export * from './usuario-creacion-pendiente.entity';
export * from './auditoria.entity';
export * from './inventario-ubicacion.entity';
export * from './inventario-stock-ubicacion.entity';
export * from './activo-fijo.entity';
export * from './compra.entity';
export * from './compra-item.entity';
export * from './transferencia.entity';
export * from './proveedor.entity';
export * from './solicitud-compra.entity';
export * from './detalle-solicitud.entity';
export * from './movimiento-inventario.entity';
export * from './rol.entity';
export * from './permiso.entity';
export * from './rol-permiso.entity';
export * from './disponibilidad-grupo.entity';
export * from './ajuste-sistema.entity';
export * from './donacion-necesidad.entity';
export * from './donacion-solicitud.entity';
