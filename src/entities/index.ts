import { CambioCorreoPendiente } from './cambio-correo-pendiente.entity';
import { EnlaceSitio } from './enlace-sitio.entity';
import { GaleriaInstitucionalItem } from './galeria-institucional-item.entity';
import { HeroPrincipal } from './hero-principal.entity';
import { InformacionFooter } from './informacion-footer.entity';
import { InformacionNavbar } from './informacion-navbar.entity';
import { PasswordResetEntry } from './password-reset-entry.entity';
import { Producto } from './producto.entity';
import { RegistroPendiente } from './registro-pendiente.entity';
import { SolicitudVoluntariado } from './solicitud-voluntariado.entity';
import { TarjetaInicio } from './tarjeta-inicio.entity';
import { TextoInstitucional } from './texto-institucional.entity';
import { UsuarioCreacionPendiente } from './usuario-creacion-pendiente.entity';
import { Usuario } from './usuario.entity';

export const entities = [
  Usuario,
  Producto,
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
];

export * from './usuario.entity';
export * from './producto.entity';
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
