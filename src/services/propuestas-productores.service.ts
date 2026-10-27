import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, QueryFailedError, Repository } from 'typeorm';

import {
  contenidoCorreoPropuesta,
  contenidoCorreoRecepcionPropuesta,
} from '../common/propuesta-correo';
import {
  COMENTARIO_MAX,
  ESTADO_EN_REVISION,
  NOTA_INTERNA_MAX,
  SUGERENCIAS_MAX,
  TERMINOS_VERSION,
  assertTransicionDesdePendiente,
  textoOpcional,
  validarClaveIdempotencia,
  validarEnlaceUbicacion,
  validarMotivoRechazo,
  validarPropuestaEntrada,
  PropuestaNormalizada,
} from '../common/propuesta-productor.util';
import {
  extraerCoordenadasDeEnlace,
  exigirCoordenadasEnCostaRica,
  resolverEnlaceMapas,
  estaEnCostaRica,
  MENSAJE_SOLO_COSTA_RICA,
} from '../common/ubicacion-maps.util';
import { baseUrlFrontend } from '../common/url-frontend.util';
import { InformacionFooter } from '../entities/informacion-footer.entity';
import { ProductorActivo } from '../entities/productor-activo.entity';
import { PropuestaHistorial } from '../entities/propuesta-historial.entity';
import { PropuestaProductor } from '../entities/propuesta-productor.entity';
import { Usuario } from '../entities/usuario.entity';
import { CorreosSalidaService } from './correos-salida.service';
import { NotificacionesPropuestasService } from './notificaciones-propuestas.service';
import { PropuestaImagenStorage } from './propuesta-imagen.storage';

type ArchivoImagen = {
  buffer: Buffer;
  size?: number;
  mimetype?: string;
  originalname?: string;
};

const ZONA = 'America/Costa_Rica';

/** Campos que el administrador puede corregir antes de aprobar. */
const CAMPOS_EDITABLES: Array<{
  dato: keyof ReturnType<typeof validarPropuestaEntrada>;
  columna: keyof PropuestaProductor;
  etiqueta: string;
}> = [
  { dato: 'nombre', columna: 'NombreEmprendimiento', etiqueta: 'nombre' },
  { dato: 'provincia', columna: 'Provincia', etiqueta: 'provincia' },
  { dato: 'canton', columna: 'Canton', etiqueta: 'cantón' },
  { dato: 'distrito', columna: 'Distrito', etiqueta: 'distrito' },
  { dato: 'direccion', columna: 'Direccion', etiqueta: 'dirección' },
  { dato: 'enlaceUbicacion', columna: 'EnlaceUbicacion', etiqueta: 'enlace de ubicación' },
  { dato: 'latitud', columna: 'Latitud', etiqueta: 'latitud' },
  { dato: 'longitud', columna: 'Longitud', etiqueta: 'longitud' },
  { dato: 'descripcion', columna: 'Descripcion', etiqueta: 'descripción' },
  { dato: 'facebook', columna: 'Facebook', etiqueta: 'Facebook' },
  { dato: 'instagram', columna: 'Instagram', etiqueta: 'Instagram' },
  { dato: 'whatsapp', columna: 'Whatsapp', etiqueta: 'WhatsApp' },
  { dato: 'sitioWeb', columna: 'SitioWeb', etiqueta: 'sitio web' },
  { dato: 'correo', columna: 'CorreoContacto', etiqueta: 'correo' },
  { dato: 'telefono', columna: 'TelefonoContacto', etiqueta: 'teléfono' },
];

function errorValidacion(error: unknown, respaldo: string): BadRequestException {
  return new BadRequestException(error instanceof Error ? error.message : respaldo);
}

function esClaveDuplicada(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    String((error as QueryFailedError & { driverError?: { code?: string } }).driverError?.code) ===
      '23505'
  );
}

function fechaCr(valor: Date | string | null | undefined): string | null {
  if (!valor) return null;
  const fecha = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(fecha.getTime())) return null;
  return new Intl.DateTimeFormat('es-CR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: ZONA,
  }).format(fecha);
}

@Injectable()
export class PropuestasProductoresService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(PropuestaProductor)
    private readonly repo: Repository<PropuestaProductor>,
    @InjectRepository(InformacionFooter)
    private readonly footerRepo: Repository<InformacionFooter>,
    @InjectRepository(ProductorActivo)
    private readonly activosRepo: Repository<ProductorActivo>,
    @InjectRepository(PropuestaHistorial)
    private readonly historialRepo: Repository<PropuestaHistorial>,
    @InjectRepository(Usuario)
    private readonly usuariosRepo: Repository<Usuario>,
    private readonly imagenes: PropuestaImagenStorage,
    private readonly notificaciones: NotificacionesPropuestasService,
    private readonly correos: CorreosSalidaService,
    private readonly config: ConfigService,
  ) {}

  async crear(usuarioId: number, body: Record<string, unknown>, archivo?: ArchivoImagen) {
    let datos;
    let clave;
    try {
      datos = validarPropuestaEntrada(body);
      clave = validarClaveIdempotencia(
        body.claveIdempotencia ?? body.ClaveIdempotencia,
      );
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'La propuesta no es válida.',
      );
    }
    try {
      datos = await this.asegurarCoordenadasPropuesta(datos);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw errorValidacion(error, 'No se pudo verificar la ubicación.');
    }

    const previa = await this.repo.findOne({
      where: { UsuarioId: usuarioId, ClaveIdempotencia: clave },
    });
    if (previa) return this.confirmacion(previa);

    if (!archivo?.buffer?.length) {
      throw new BadRequestException('La imagen representativa es obligatoria.');
    }
    let detectada;
    try {
      detectada = this.imagenes.validar(archivo.buffer);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'La imagen no es válida.',
      );
    }

    let nombreArchivo: string;
    try {
      nombreArchivo = await this.imagenes.guardar(archivo.buffer, detectada);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : 'No se pudo guardar la imagen. Intentá de nuevo.',
      );
    }
    const footer = await this.footerRepo.find({ order: { Id: 'ASC' }, take: 1 });
    const institucional = footer[0];
    const nombreUsuario = await this.nombreUsuario(usuarioId);
    try {
      const guardada = await this.dataSource.transaction(async (manager) => {
        const repo = manager.getRepository(PropuestaProductor);
        const repetida = await repo.findOne({
          where: { UsuarioId: usuarioId, ClaveIdempotencia: clave },
        });
        if (repetida) return repetida;
        const ahora = new Date();
        const fila = await repo.save(
          repo.create({
            UsuarioId: usuarioId,
            NombreEmprendimiento: datos.nombre,
            ImagenReferencia: nombreArchivo,
            Provincia: datos.provincia,
            Canton: datos.canton,
            Distrito: datos.distrito,
            Direccion: datos.direccion,
            EnlaceUbicacion: datos.enlaceUbicacion,
            Latitud: datos.latitud,
            Longitud: datos.longitud,
            Descripcion: datos.descripcion,
            Facebook: datos.facebook,
            Instagram: datos.instagram,
            Whatsapp: datos.whatsapp,
            SitioWeb: datos.sitioWeb,
            CorreoContacto: datos.correo,
            TelefonoContacto: datos.telefono,
            Estado: 'Pendiente',
            TerminosAceptadosEn: ahora,
            TerminosVersion: TERMINOS_VERSION,
            ClaveIdempotencia: clave,
            RevisadoEn: null,
            RevisadoPorId: null,
            MotivoRechazo: null,
          }),
        );
        await this.notificaciones.crearRecepcion(manager, fila);
        const contenido = contenidoCorreoRecepcionPropuesta({
          nombreEmprendimiento: fila.NombreEmprendimiento,
          id: String(fila.Id),
          fechaEnvio: fechaCr(fila.CreadoEn ?? ahora) || '',
          enlaceMisPropuestas: this.enlaceMisPropuestas(fila.Id),
          nombreUsuario,
          correoInstitucional: institucional?.Correo || null,
          telefonoInstitucional: institucional?.Telefono || null,
        });
        await this.correos.encolar(manager, {
          clave: `propuesta:${fila.Id}:recepcion`,
          destinatario: fila.CorreoContacto,
          asunto: contenido.asunto,
          html: contenido.html,
          texto: contenido.texto,
        });
        return fila;
      });
      if (guardada.ImagenReferencia !== nombreArchivo) {
        await this.imagenes.eliminar(nombreArchivo);
      }
      void this.correos
        .intentarClave(`propuesta:${guardada.Id}:recepcion`)
        .catch(() => undefined);
      return this.confirmacion(guardada);
    } catch (error) {
      await this.imagenes.eliminar(nombreArchivo);
      if (esClaveDuplicada(error)) {
        const existente = await this.repo.findOne({
          where: { UsuarioId: usuarioId, ClaveIdempotencia: clave },
        });
        if (existente) return this.confirmacion(existente);
      }
      throw error;
    }
  }

  async listarMias(usuarioId: number) {
    const filas = await this.repo.find({
      where: { UsuarioId: usuarioId },
      order: { CreadoEn: 'DESC' },
    });
    return filas.map((fila) => this.vistaPropia(fila));
  }

  async obtenerMia(usuarioId: number, id: string) {
    const fila = await this.buscarPropia(usuarioId, id);
    return this.vistaPropia(fila, true);
  }

  async listarPublicas() {
    const filas = await this.activosRepo.find({
      where: { Activo: true },
      order: { PublicadoEn: 'DESC' },
    });
    return filas.map((fila) => this.vistaPublica(fila));
  }

  /**
   * Resuelve un enlace de Maps/Waze a coordenadas confiables.
   * Solo consulta dominios permitidos; no es un proxy abierto.
   */
  async resolverUbicacionEnlace(enlaceRaw: unknown) {
    let enlace: string;
    try {
      enlace = validarEnlaceUbicacion(enlaceRaw);
    } catch (error) {
      throw errorValidacion(error, 'El enlace de ubicación no es válido.');
    }
    const locales = extraerCoordenadasDeEnlace(enlace);
    if (locales) {
      try {
        const enCr = exigirCoordenadasEnCostaRica(locales);
        return {
          enlaceFinal: enlace,
          latitud: enCr!.latitud,
          longitud: enCr!.longitud,
          resuelto: true,
          fuente: 'enlace' as const,
        };
      } catch (error) {
        throw errorValidacion(error, MENSAJE_SOLO_COSTA_RICA);
      }
    }
    try {
      const remoto = await resolverEnlaceMapas(enlace);
      if (remoto.coordenadas) {
        const enCr = exigirCoordenadasEnCostaRica(remoto.coordenadas);
        return {
          enlaceFinal: remoto.enlaceFinal,
          latitud: enCr!.latitud,
          longitud: enCr!.longitud,
          resuelto: true,
          fuente: 'redireccion' as const,
        };
      }
      return {
        enlaceFinal: remoto.enlaceFinal,
        latitud: null,
        longitud: null,
        resuelto: false,
        fuente: null,
        mensaje:
          'El enlace es válido, pero no trae el pin exacto (a veces pasa con búsquedas solo por ciudad). Tocá el mapa de Costa Rica para marcar el lugar.',
      };
    } catch (error) {
      throw errorValidacion(
        error,
        'No se pudo verificar ese enlace. Revisá que sea de Google Maps o Waze, esté en Costa Rica y esté completo.',
      );
    }
  }

  async listarAdmin(query: {
    q?: string;
    estado?: string;
    desde?: string;
    hasta?: string;
    page?: string;
    pageSize?: string;
  }) {
    const page = Math.max(1, Number.parseInt(query.page || '1', 10) || 1);
    const pageSize = Math.min(
      50,
      Math.max(1, Number.parseInt(query.pageSize || '20', 10) || 20),
    );
    const qb = this.repo.createQueryBuilder('p').orderBy('p.CreadoEn', 'DESC');
    const estado = String(query.estado || '').trim();
    if (estado && estado.toLowerCase() !== 'todos') {
      qb.andWhere('p.Estado = :estado', { estado });
    }
    const q = String(query.q || '').trim().toLowerCase();
    if (q) {
      qb.andWhere(
        '(CAST(p.Id AS text) = :idExacto OR LOWER(p.NombreEmprendimiento) LIKE :q OR LOWER(p.CorreoContacto) LIKE :q)',
        { idExacto: q, q: `%${q}%` },
      );
    }
    if (query.desde) {
      const desde = new Date(`${query.desde}T00:00:00.000-06:00`);
      if (!Number.isNaN(desde.getTime())) {
        qb.andWhere('p.CreadoEn >= :desde', { desde });
      }
    }
    if (query.hasta) {
      const hasta = new Date(`${query.hasta}T23:59:59.999-06:00`);
      if (!Number.isNaN(hasta.getTime())) {
        qb.andWhere('p.CreadoEn <= :hasta', { hasta });
      }
    }
    const [filas, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return {
      data: filas.map((fila) => this.vistaAdmin(fila)),
      total,
      page,
      pageSize,
    };
  }

  async obtenerAdmin(id: string) {
    const fila = await this.repo.findOne({ where: { Id: id } });
    if (!fila) throw new NotFoundException('No se encontró la propuesta.');
    return this.detalleAdmin(fila);
  }

  async aprobar(id: string, adminId: number, comentarioRaw?: unknown) {
    let comentario: string | null;
    try {
      comentario = textoOpcional(comentarioRaw, 'El comentario', COMENTARIO_MAX);
    } catch (error) {
      throw errorValidacion(error, 'El comentario no es válido.');
    }
    return this.revisar(id, adminId, 'Aprobada', { comentario });
  }

  async rechazar(
    id: string,
    adminId: number,
    motivoRaw: unknown,
    sugerenciasRaw?: unknown,
    comentarioRaw?: unknown,
  ) {
    let motivo: string;
    let sugerencias: string | null;
    let comentario: string | null;
    try {
      motivo = validarMotivoRechazo(motivoRaw);
      sugerencias = textoOpcional(sugerenciasRaw, 'Las sugerencias', SUGERENCIAS_MAX);
      comentario = textoOpcional(comentarioRaw, 'El comentario', COMENTARIO_MAX);
    } catch (error) {
      throw errorValidacion(error, 'El motivo no es válido.');
    }
    return this.revisar(id, adminId, 'Rechazada', { motivo, sugerencias, comentario });
  }

  /** Pasa entre Pendiente y En revisión; no envía correo al productor. */
  async cambiarEstadoRevision(
    id: string,
    adminId: number,
    estadoRaw: unknown,
    comentarioRaw?: unknown,
  ) {
    const estado = String(estadoRaw ?? '').trim();
    if (estado !== 'Pendiente' && estado !== ESTADO_EN_REVISION) {
      throw new BadRequestException(
        'Para aprobar o rechazar usá las acciones correspondientes.',
      );
    }
    let comentario: string | null;
    try {
      comentario = textoOpcional(comentarioRaw, 'El comentario', COMENTARIO_MAX);
    } catch (error) {
      throw errorValidacion(error, 'El comentario no es válido.');
    }
    const guardada = await this.dataSource.transaction(async (manager) => {
      const fila = await this.bloquear(manager, id);
      this.exigirAbierta(fila);
      if (fila.Estado === estado && !comentario) return fila;
      const anterior = fila.Estado;
      fila.Estado = estado;
      fila.ActualizadoEn = new Date();
      const actualizada = await manager.getRepository(PropuestaProductor).save(fila);
      await this.registrar(manager, {
        propuestaId: actualizada.Id,
        accion: 'estado',
        anterior,
        nuevo: estado,
        comentario,
        adminId,
      });
      return actualizada;
    });
    return this.detalleAdmin(guardada);
  }

  /** Corrige datos de una propuesta abierta sin tener que rechazarla. */
  async actualizarAdmin(id: string, adminId: number, body: Record<string, unknown>) {
    const guardada = await this.dataSource.transaction(async (manager) => {
      const fila = await this.bloquear(manager, id);
      this.exigirAbierta(fila);
      let datos: ReturnType<typeof validarPropuestaEntrada>;
      try {
        datos = validarPropuestaEntrada(
          {
            nombre: fila.NombreEmprendimiento,
            provincia: fila.Provincia,
            canton: fila.Canton,
            distrito: fila.Distrito,
            direccion: fila.Direccion,
            enlaceUbicacion: fila.EnlaceUbicacion,
            latitud: fila.Latitud,
            longitud: fila.Longitud,
            descripcion: fila.Descripcion,
            facebook: fila.Facebook,
            instagram: fila.Instagram,
            whatsapp: fila.Whatsapp,
            sitioWeb: fila.SitioWeb,
            correo: fila.CorreoContacto,
            telefono: fila.TelefonoContacto,
            ...body,
            aceptaTerminos: true,
          },
          {
            enlaceAnterior: fila.EnlaceUbicacion,
            latitudAnterior: fila.Latitud,
            longitudAnterior: fila.Longitud,
          },
        );
      } catch (error) {
        throw errorValidacion(error, 'Los datos de la propuesta no son válidos.');
      }
      datos = await this.asegurarCoordenadasPropuesta(datos);
      const cambiados: string[] = [];
      for (const campo of CAMPOS_EDITABLES) {
        const nuevo = datos[campo.dato] as string | number | null;
        if ((fila[campo.columna] ?? null) !== (nuevo ?? null)) {
          (fila as unknown as Record<string, unknown>)[campo.columna] = nuevo;
          cambiados.push(campo.etiqueta);
        }
      }
      if (!cambiados.length) return fila;
      fila.ActualizadoEn = new Date();
      const actualizada = await manager.getRepository(PropuestaProductor).save(fila);
      await this.registrar(manager, {
        propuestaId: actualizada.Id,
        accion: 'edicion',
        comentario: `Se corrigió: ${cambiados.join(', ')}.`,
        adminId,
      });
      return actualizada;
    });
    return this.detalleAdmin(guardada);
  }

  /** Nota solo para administradores; se puede editar en cualquier estado. */
  async guardarNotaInterna(id: string, adminId: number, notaRaw: unknown) {
    let nota: string | null;
    try {
      nota = textoOpcional(notaRaw, 'La nota interna', NOTA_INTERNA_MAX);
    } catch (error) {
      throw errorValidacion(error, 'La nota interna no es válida.');
    }
    const guardada = await this.dataSource.transaction(async (manager) => {
      const fila = await this.bloquear(manager, id);
      if ((fila.NotaInterna ?? null) === nota) return fila;
      fila.NotaInterna = nota;
      fila.ActualizadoEn = new Date();
      const actualizada = await manager.getRepository(PropuestaProductor).save(fila);
      await this.registrar(manager, {
        propuestaId: actualizada.Id,
        accion: 'nota',
        comentario: nota ? 'Actualizó la nota interna.' : 'Borró la nota interna.',
        adminId,
      });
      return actualizada;
    });
    return this.detalleAdmin(guardada);
  }

  async leerImagen(nombre: string, usuarioId: number | null, esAdmin: boolean) {
    let fila = await this.repo.findOne({ where: { ImagenReferencia: nombre } });
    if (!fila) {
      fila = await this.repo
        .createQueryBuilder('p')
        .where("p.SolicitudEdicion->>'imagenNueva' = :nombre", { nombre })
        .getOne();
    }
    if (!fila) throw new NotFoundException('No se encontró la imagen.');
    const publica = fila.Estado === 'Aprobada';
    const propia = usuarioId != null && fila.UsuarioId === usuarioId;
    if (!publica && !propia && !esAdmin) {
      throw new NotFoundException('No se encontró la imagen.');
    }
    const archivo = await this.imagenes.leer(nombre);
    if (!archivo) throw new NotFoundException('No se encontró la imagen.');
    return archivo;
  }

  async editarMia(usuarioId: number, id: string, body: Record<string, unknown>, archivo?: ArchivoImagen) {
    const fila = await this.buscarPropia(usuarioId, id);
    if (fila.Estado === 'Aprobada' || fila.Estado === 'Eliminada') {
      throw new BadRequestException('Esta propuesta no se puede editar directamente. Para emprendimientos activos debés enviar una solicitud de cambios.');
    }
    let datos: PropuestaNormalizada;
    try {
      datos = validarPropuestaEntrada(
        { ...body, aceptaTerminos: true },
        {
          enlaceAnterior: fila.EnlaceUbicacion,
          latitudAnterior: fila.Latitud,
          longitudAnterior: fila.Longitud,
        },
      );
    } catch (error) {
      throw errorValidacion(error, 'Los datos no son válidos.');
    }
    datos = await this.asegurarCoordenadasPropuesta(datos);

    let nombreArchivo = fila.ImagenReferencia;
    let imagenAnteriorParaBorrar: string | null = null;
    if (archivo?.buffer?.length) {
      const detectada = this.imagenes.validar(archivo.buffer);
      nombreArchivo = await this.imagenes.guardar(archivo.buffer, detectada);
      imagenAnteriorParaBorrar = fila.ImagenReferencia;
    }

    const anteriorEstado = fila.Estado;
    fila.NombreEmprendimiento = datos.nombre;
    fila.Provincia = datos.provincia;
    fila.Canton = datos.canton;
    fila.Distrito = datos.distrito;
    fila.Direccion = datos.direccion;
    fila.EnlaceUbicacion = datos.enlaceUbicacion;
    fila.Latitud = datos.latitud;
    fila.Longitud = datos.longitud;
    fila.Descripcion = datos.descripcion;
    fila.Facebook = datos.facebook;
    fila.Instagram = datos.instagram;
    fila.Whatsapp = datos.whatsapp;
    fila.SitioWeb = datos.sitioWeb;
    fila.CorreoContacto = datos.correo;
    fila.TelefonoContacto = datos.telefono;
    fila.ImagenReferencia = nombreArchivo;
    fila.ActualizadoEn = new Date();

    if (fila.Estado === 'Rechazada') {
      fila.Estado = 'Pendiente';
      fila.MotivoRechazo = null;
      fila.Sugerencias = null;
      fila.RevisadoEn = null;
      fila.RevisadoPorId = null;
    }

    const guardada = await this.repo.save(fila);
    if (imagenAnteriorParaBorrar && imagenAnteriorParaBorrar !== nombreArchivo) {
      await this.imagenes.eliminar(imagenAnteriorParaBorrar).catch(() => undefined);
    }

    await this.registrarHistorialSimple(
      guardada.Id,
      'edicion',
      anteriorEstado,
      guardada.Estado,
      'El productor editó los datos de la propuesta.',
      null,
    );

    return this.vistaPropia(guardada, true);
  }

  async eliminarMia(usuarioId: number, id: string) {
    const fila = await this.buscarPropia(usuarioId, id);
    if (fila.Estado === 'Aprobada') {
      throw new BadRequestException('Para dar de baja un emprendimiento activo debés solicitar la baja/eliminación.');
    }
    fila.Estado = 'Eliminada';
    fila.ActualizadoEn = new Date();
    const guardada = await this.repo.save(fila);

    await this.registrarHistorialSimple(
      guardada.Id,
      'eliminacion',
      fila.Estado,
      'Eliminada',
      'El productor canceló/eliminó su solicitud.',
      null,
    );

    return { exito: true, mensaje: 'Solicitud eliminada correctamente.' };
  }

  async solicitarEdicionMia(usuarioId: number, id: string, body: Record<string, unknown>, archivo?: ArchivoImagen) {
    const fila = await this.buscarPropia(usuarioId, id);
    if (fila.Estado !== 'Aprobada') {
      throw new BadRequestException('Solo podés solicitar cambios para emprendimientos que ya han sido aprobados.');
    }
    let datos: PropuestaNormalizada;
    try {
      datos = validarPropuestaEntrada(
        { ...body, aceptaTerminos: true },
        {
          enlaceAnterior: fila.EnlaceUbicacion,
          latitudAnterior: fila.Latitud,
          longitudAnterior: fila.Longitud,
        },
      );
    } catch (error) {
      throw errorValidacion(error, 'Los datos solicitados no son válidos.');
    }
    datos = await this.asegurarCoordenadasPropuesta(datos);

    let nombreArchivo: string | null = null;
    if (archivo?.buffer?.length) {
      const detectada = this.imagenes.validar(archivo.buffer);
      nombreArchivo = await this.imagenes.guardar(archivo.buffer, detectada);
    }

    const motivo = String(body.motivo || body.Motivo || '').trim();
    fila.SolicitudEdicion = {
      datos,
      motivo: motivo || null,
      imagenNueva: nombreArchivo,
      fechaSolicitud: new Date().toISOString(),
    };
    fila.ActualizadoEn = new Date();
    const guardada = await this.repo.save(fila);

    await this.registrarHistorialSimple(
      guardada.Id,
      'solicitud_edicion',
      fila.Estado,
      fila.Estado,
      motivo ? `Solicitó cambios: ${motivo}` : 'El productor envió una solicitud de cambios para su emprendimiento.',
      null,
    );

    return this.vistaPropia(guardada, true);
  }

  async cancelarSolicitudEdicionMia(usuarioId: number, id: string) {
    const fila = await this.buscarPropia(usuarioId, id);
    if (fila.SolicitudEdicion && typeof fila.SolicitudEdicion === 'object') {
      const sol = fila.SolicitudEdicion as { imagenNueva?: string | null };
      if (sol.imagenNueva) {
        await this.imagenes.eliminar(String(sol.imagenNueva)).catch(() => undefined);
      }
    }
    fila.SolicitudEdicion = null;
    fila.ActualizadoEn = new Date();
    const guardada = await this.repo.save(fila);
    return this.vistaPropia(guardada, true);
  }

  async solicitarEliminacionMia(usuarioId: number, id: string, motivoRaw: unknown) {
    const fila = await this.buscarPropia(usuarioId, id);
    if (fila.Estado !== 'Aprobada') {
      throw new BadRequestException('Solo podés solicitar la baja de emprendimientos aprobados y activos.');
    }
    const motivo = String(motivoRaw ?? '').trim();
    fila.SolicitudEliminacion = {
      motivo: motivo || 'Solicitud de baja del emprendimiento por parte del productor',
      fechaSolicitud: new Date().toISOString(),
    };
    fila.ActualizadoEn = new Date();
    const guardada = await this.repo.save(fila);

    await this.registrarHistorialSimple(
      guardada.Id,
      'solicitud_eliminacion',
      fila.Estado,
      fila.Estado,
      `Solicitó eliminación del emprendimiento. Motivo: ${motivo || 'Sin motivo especificado'}`,
      null,
    );

    return this.vistaPropia(guardada, true);
  }

  async cancelarSolicitudEliminacionMia(usuarioId: number, id: string) {
    const fila = await this.buscarPropia(usuarioId, id);
    fila.SolicitudEliminacion = null;
    fila.ActualizadoEn = new Date();
    const guardada = await this.repo.save(fila);
    return this.vistaPropia(guardada, true);
  }

  async resolverSolicitudEdicion(
    id: string,
    adminId: number,
    accion: 'aprobar' | 'rechazar',
    comentarioRaw?: unknown,
  ) {
    const fila = await this.repo.findOne({ where: { Id: id } });
    if (!fila) throw new NotFoundException('No se encontró la propuesta.');
    if (!fila.SolicitudEdicion) {
      throw new BadRequestException('Esta propuesta no tiene una solicitud de edición pendiente.');
    }

    const comentario = String(comentarioRaw ?? '').trim();
    const sol = fila.SolicitudEdicion as {
      datos?: Record<string, unknown>;
      imagenNueva?: string | null;
    };

    if (accion === 'aprobar') {
      const d = sol.datos || {};
      if (d.nombre) fila.NombreEmprendimiento = String(d.nombre);
      if (d.provincia !== undefined) fila.Provincia = String(d.provincia || '');
      if (d.canton !== undefined) fila.Canton = String(d.canton || '');
      if (d.distrito !== undefined) fila.Distrito = String(d.distrito || '');
      if (d.direccion) fila.Direccion = String(d.direccion);
      if (d.enlaceUbicacion) fila.EnlaceUbicacion = String(d.enlaceUbicacion);
      if (d.latitud !== undefined) {
        fila.Latitud =
          d.latitud == null || d.latitud === ''
            ? null
            : Number(d.latitud);
      }
      if (d.longitud !== undefined) {
        fila.Longitud =
          d.longitud == null || d.longitud === ''
            ? null
            : Number(d.longitud);
      }
      if (d.descripcion) fila.Descripcion = String(d.descripcion);
      if (d.facebook !== undefined) fila.Facebook = d.facebook ? String(d.facebook) : null;
      if (d.instagram !== undefined) fila.Instagram = d.instagram ? String(d.instagram) : null;
      if (d.whatsapp !== undefined) fila.Whatsapp = d.whatsapp ? String(d.whatsapp) : null;
      if (d.sitioWeb !== undefined) fila.SitioWeb = d.sitioWeb ? String(d.sitioWeb) : null;
      if (d.correo) fila.CorreoContacto = String(d.correo);
      if (d.telefono) fila.TelefonoContacto = String(d.telefono);

      if (sol.imagenNueva) {
        const vieja = fila.ImagenReferencia;
        fila.ImagenReferencia = sol.imagenNueva;
        if (vieja && vieja !== sol.imagenNueva) {
          await this.imagenes.eliminar(vieja).catch(() => undefined);
        }
      }

      fila.SolicitudEdicion = null;
      fila.ActualizadoEn = new Date();
      await this.repo.save(fila);

      await this.publicar(this.dataSource.manager, fila);

      await this.registrarHistorialSimple(
        fila.Id,
        'aprobacion_edicion',
        fila.Estado,
        fila.Estado,
        comentario ? `Aprobó solicitud de edición: ${comentario}` : 'Aprobó la solicitud de cambios del emprendimiento.',
        adminId,
      );
    } else {
      if (sol.imagenNueva) {
        await this.imagenes.eliminar(sol.imagenNueva).catch(() => undefined);
      }
      fila.SolicitudEdicion = null;
      fila.ActualizadoEn = new Date();
      await this.repo.save(fila);

      await this.registrarHistorialSimple(
        fila.Id,
        'rechazo_edicion',
        fila.Estado,
        fila.Estado,
        comentario ? `Rechazó solicitud de edición: ${comentario}` : 'Rechazó la solicitud de cambios del emprendimiento.',
        adminId,
      );
    }

    return this.detalleAdmin(fila);
  }

  async resolverSolicitudEliminacion(
    id: string,
    adminId: number,
    accion: 'aprobar' | 'rechazar',
    comentarioRaw?: unknown,
  ) {
    const fila = await this.repo.findOne({ where: { Id: id } });
    if (!fila) throw new NotFoundException('No se encontró la propuesta.');
    if (!fila.SolicitudEliminacion) {
      throw new BadRequestException('Esta propuesta no tiene una solicitud de eliminación pendiente.');
    }

    const comentario = String(comentarioRaw ?? '').trim();
    if (accion === 'aprobar') {
      fila.Estado = 'Eliminada';
      fila.SolicitudEliminacion = null;
      fila.ActualizadoEn = new Date();
      await this.repo.save(fila);

      await this.activosRepo.delete({ PropuestaId: id });

      await this.registrarHistorialSimple(
        fila.Id,
        'eliminacion',
        'Aprobada',
        'Eliminada',
        comentario ? `Aprobó baja de emprendimiento: ${comentario}` : 'Aprobó la solicitud de baja/eliminación del emprendimiento.',
        adminId,
      );
    } else {
      fila.SolicitudEliminacion = null;
      fila.ActualizadoEn = new Date();
      await this.repo.save(fila);

      await this.registrarHistorialSimple(
        fila.Id,
        'rechazo_eliminacion',
        fila.Estado,
        fila.Estado,
        comentario ? `Rechazó baja de emprendimiento: ${comentario}` : 'Rechazó la solicitud de baja/eliminación del emprendimiento.',
        adminId,
      );
    }

    return this.detalleAdmin(fila);
  }

  async eliminarAdmin(id: string, adminId: number, comentarioRaw?: unknown) {
    const fila = await this.repo.findOne({ where: { Id: id } });
    if (!fila) throw new NotFoundException('No se encontró la propuesta.');

    const anteriorEstado = fila.Estado;
    fila.Estado = 'Eliminada';
    fila.SolicitudEdicion = null;
    fila.SolicitudEliminacion = null;
    fila.ActualizadoEn = new Date();
    await this.repo.save(fila);

    await this.activosRepo.delete({ PropuestaId: id });

    const comentario = String(comentarioRaw ?? '').trim();
    await this.registrarHistorialSimple(
      fila.Id,
      'eliminacion',
      anteriorEstado,
      'Eliminada',
      comentario || 'El administrador eliminó la propuesta / emprendimiento.',
      adminId,
    );

    return this.detalleAdmin(fila);
  }

  /**
   * Si el formulario no mandó pin, intenta leerlo del enlace.
   * Sin coordenadas en Costa Rica no se acepta la propuesta.
   */
  private async asegurarCoordenadasPropuesta(
    datos: PropuestaNormalizada,
  ): Promise<PropuestaNormalizada> {
    if (
      datos.latitud != null &&
      datos.longitud != null &&
      estaEnCostaRica(datos.latitud, datos.longitud)
    ) {
      return datos;
    }

    const locales = extraerCoordenadasDeEnlace(datos.enlaceUbicacion);
    if (locales && estaEnCostaRica(locales.latitud, locales.longitud)) {
      return {
        ...datos,
        latitud: locales.latitud,
        longitud: locales.longitud,
      };
    }

    try {
      const remoto = await resolverEnlaceMapas(datos.enlaceUbicacion);
      if (
        remoto.coordenadas &&
        estaEnCostaRica(
          remoto.coordenadas.latitud,
          remoto.coordenadas.longitud,
        )
      ) {
        return {
          ...datos,
          latitud: remoto.coordenadas.latitud,
          longitud: remoto.coordenadas.longitud,
        };
      }
    } catch (error) {
      throw errorValidacion(
        error,
        'No se pudo verificar el enlace de ubicación. Revisá que sea de Google Maps o Waze.',
      );
    }

    throw new BadRequestException(
      'No pudimos leer un punto exacto en Costa Rica. En Google Maps abrí el lugar en CR, tocá Compartir y copiá el enlace del pin, o confirmá el punto en el mapa del formulario.',
    );
  }

  private async registrarHistorialSimple(
    propuestaId: string,
    accion: string,
    anterior: string | null,
    nuevo: string | null,
    comentario: string | null,
    adminId: number | null,
  ) {
    try {
      await this.historialRepo.save(
        this.historialRepo.create({
          PropuestaId: String(propuestaId),
          Accion: accion.slice(0, 50),
          EstadoAnterior: anterior ?? null,
          EstadoNuevo: nuevo ?? null,
          Comentario: comentario?.slice(0, NOTA_INTERNA_MAX) ?? null,
          AdminId: adminId ?? null,
        }),
      );
    } catch {
      // Ignorar si falla la bitácora
    }
  }

  private async revisar(
    id: string,
    adminId: number,
    estado: 'Aprobada' | 'Rechazada',
    opciones: {
      motivo?: string | null;
      sugerencias?: string | null;
      comentario?: string | null;
    } = {},
  ) {
    const motivo = opciones.motivo ?? null;
    const sugerencias = opciones.sugerencias ?? null;
    const footer = await this.footerRepo.find({ order: { Id: 'ASC' }, take: 1 });
    const institucional = footer[0];
    let claveCorreo = '';
    const guardada = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(PropuestaProductor);
      const fila = await this.bloquear(manager, id);
      this.exigirAbierta(fila);
      const anterior = fila.Estado;
      const ahora = new Date();
      fila.Estado = estado;
      fila.RevisadoEn = ahora;
      fila.RevisadoPorId = adminId;
      fila.MotivoRechazo = motivo;
      fila.Sugerencias = sugerencias;
      fila.ActualizadoEn = ahora;
      const actualizada = await repo.save(fila);
      if (estado === 'Aprobada') {
        await this.publicar(manager, actualizada);
      }
      await this.registrar(manager, {
        propuestaId: actualizada.Id,
        accion: 'estado',
        anterior,
        nuevo: estado,
        comentario:
          [motivo ? `Motivo: ${motivo}` : '', opciones.comentario || '']
            .filter(Boolean)
            .join('\n') || null,
        adminId,
      });
      await this.notificaciones.crearResultado(manager, actualizada);
      const contenido = contenidoCorreoPropuesta({
        nombreEmprendimiento: actualizada.NombreEmprendimiento,
        id: String(actualizada.Id),
        resultado: estado,
        fechaRevision: fechaCr(ahora) || '',
        enlaceMisPropuestas: this.enlaceMisPropuestas(actualizada.Id),
        enlacePerfilPublico: this.enlacePerfilPublico(actualizada.Id),
        enlaceNuevaPropuesta: `${this.baseFrontend()}/productores/propuesta`,
        motivo,
        sugerencias,
        nombreUsuario: await this.nombreUsuario(actualizada.UsuarioId),
        correoInstitucional: institucional?.Correo || null,
        telefonoInstitucional: institucional?.Telefono || null,
      });
      claveCorreo = `propuesta:${actualizada.Id}:${estado === 'Aprobada' ? 'aprobacion' : 'rechazo'}`;
      await this.correos.encolar(manager, {
        clave: claveCorreo,
        destinatario: actualizada.CorreoContacto,
        asunto: contenido.asunto,
        html: contenido.html,
        texto: contenido.texto,
      });
      return actualizada;
    });

    void this.correos.intentarClave(claveCorreo).catch(() => undefined);
    return {
      ...(await this.detalleAdmin(guardada)),
      envioCorreo: { estado: 'pendiente' as const },
    };
  }

  private async bloquear(manager: EntityManager, id: string) {
    const fila = await manager
      .getRepository(PropuestaProductor)
      .createQueryBuilder('p')
      .setLock('pessimistic_write')
      .where('p.Id = :id', { id })
      .getOne();
    if (!fila) throw new NotFoundException('No se encontró la propuesta.');
    return fila;
  }

  private exigirAbierta(fila: PropuestaProductor) {
    try {
      assertTransicionDesdePendiente(fila.Estado);
    } catch (error) {
      throw new ConflictException(
        error instanceof Error ? error.message : 'Esta propuesta ya fue revisada.',
      );
    }
  }

  /** Copia la propuesta aprobada a productores_activos (lo que ve el sitio público). */
  private async publicar(manager: EntityManager, fila: PropuestaProductor) {
    const repo = manager.getRepository(ProductorActivo);
    const existente = await repo.findOne({ where: { PropuestaId: String(fila.Id) } });
    const datos = {
      PropuestaId: String(fila.Id),
      UsuarioId: fila.UsuarioId,
      NombreEmprendimiento: fila.NombreEmprendimiento,
      ImagenReferencia: fila.ImagenReferencia,
      Provincia: fila.Provincia,
      Canton: fila.Canton,
      Distrito: fila.Distrito,
      Direccion: fila.Direccion,
      EnlaceUbicacion: fila.EnlaceUbicacion,
      Latitud: fila.Latitud,
      Longitud: fila.Longitud,
      Descripcion: fila.Descripcion,
      Facebook: fila.Facebook,
      Instagram: fila.Instagram,
      Whatsapp: fila.Whatsapp,
      SitioWeb: fila.SitioWeb,
      CorreoContacto: fila.CorreoContacto,
      TelefonoContacto: fila.TelefonoContacto,
      Activo: true,
    };
    await repo.save(existente ? repo.merge(existente, datos) : repo.create(datos));
  }

  private async registrar(
    manager: EntityManager,
    datos: {
      propuestaId: string;
      accion: 'estado' | 'edicion' | 'nota';
      anterior?: string | null;
      nuevo?: string | null;
      comentario?: string | null;
      adminId: number;
    },
  ) {
    const repo = manager.getRepository(PropuestaHistorial);
    await repo.save(
      repo.create({
        PropuestaId: String(datos.propuestaId),
        Accion: datos.accion,
        EstadoAnterior: datos.anterior ?? null,
        EstadoNuevo: datos.nuevo ?? null,
        Comentario: datos.comentario?.slice(0, NOTA_INTERNA_MAX) ?? null,
        AdminId: datos.adminId,
      }),
    );
  }

  private async detalleAdmin(fila: PropuestaProductor) {
    const historial = await this.historialRepo.find({
      where: { PropuestaId: String(fila.Id) },
      order: { CreadoEn: 'DESC', Id: 'DESC' },
    });
    const ids = [
      ...new Set(
        [fila.RevisadoPorId, ...historial.map((h) => h.AdminId)].filter(
          (valor): valor is number => typeof valor === 'number',
        ),
      ),
    ];
    const admins = ids.length
      ? await this.usuariosRepo.find({ where: { Id: In(ids) } })
      : [];
    const nombres = new Map(admins.map((u) => [u.Id, u.Nombre || u.Correo]));
    return {
      ...this.vistaAdmin(fila, true),
      revisadoPorNombre: fila.RevisadoPorId ? nombres.get(fila.RevisadoPorId) || null : null,
      enlacePerfilPublico:
        fila.Estado === 'Aprobada' ? this.enlacePerfilPublico(fila.Id, false) : null,
      historial: historial.map((h) => ({
        id: h.Id,
        accion: h.Accion,
        estadoAnterior: h.EstadoAnterior,
        estadoNuevo: h.EstadoNuevo,
        comentario: h.Comentario,
        adminId: h.AdminId,
        adminNombre: h.AdminId ? nombres.get(h.AdminId) || null : null,
        fecha: h.CreadoEn,
      })),
    };
  }

  private async buscarPropia(usuarioId: number, id: string) {
    const fila = await this.repo.findOne({ where: { Id: id } });
    if (!fila || fila.UsuarioId !== usuarioId) {
      throw new NotFoundException('No se encontró la propuesta.');
    }
    return fila;
  }

  private baseFrontend(): string {
    return baseUrlFrontend(this.config);
  }

  private async nombreUsuario(id: number | null | undefined): Promise<string | null> {
    if (!id) return null;
    const [usuario] = await this.usuariosRepo.find({ where: { Id: id }, take: 1 });
    return usuario?.Nombre?.trim() || null;
  }

  private enlaceMisPropuestas(id: string | number): string {
    return `${this.baseFrontend()}/perfil/propuestas/${id}`;
  }

  private enlacePerfilPublico(id: string | number, absoluto = true): string {
    const ruta = `/productores?productor=${encodeURIComponent(String(id))}`;
    return absoluto ? `${this.baseFrontend()}${ruta}` : ruta;
  }

  private confirmacion(fila: PropuestaProductor) {
    return {
      id: String(fila.Id),
      nombre: fila.NombreEmprendimiento,
      estado: 'Pendiente de revisión',
      fechaEnvio: fila.CreadoEn,
      mensaje:
        'Recibimos la información de tu emprendimiento. Nuestro equipo revisará tu propuesta y te notificará el resultado',
    };
  }

  private textoUbicacion(fila: {
    Provincia: string | null;
    Canton: string | null;
    Distrito: string | null;
    Direccion: string;
  }) {
    const partes = [fila.Provincia, fila.Canton, fila.Distrito]
      .map((parte) => String(parte || '').trim())
      .filter(Boolean);
    const senas = String(fila.Direccion || '').trim();
    if (partes.length && senas) return `${partes.join(', ')}. ${senas}`;
    if (partes.length) return partes.join(', ');
    return senas;
  }

  private imagenUrl(nombre: string) {
    return `/api/productores/imagenes/${nombre}`;
  }

  private vistaPublica(fila: ProductorActivo) {
    return {
      id: String(fila.PropuestaId),
      nombre: fila.NombreEmprendimiento,
      imagenUrl: this.imagenUrl(fila.ImagenReferencia),
      descripcion: fila.Descripcion,
      direccion: this.textoUbicacion(fila),
      provincia: fila.Provincia,
      canton: fila.Canton,
      distrito: fila.Distrito,
      senas: fila.Direccion,
      enlaceUbicacion: fila.EnlaceUbicacion,
      latitud: fila.Latitud,
      longitud: fila.Longitud,
      facebook: fila.Facebook,
      instagram: fila.Instagram,
      whatsapp: fila.Whatsapp,
      sitioWeb: fila.SitioWeb,
    };
  }

  private formatearSolicitudEdicion(sol: Record<string, unknown> | null) {
    if (!sol || typeof sol !== 'object') return null;
    return {
      ...sol,
      imagenUrl: sol.imagenNueva ? this.imagenUrl(String(sol.imagenNueva)) : null,
    };
  }

  private vistaPropia(fila: PropuestaProductor, detalle = false) {
    const base = {
      id: String(fila.Id),
      nombre: fila.NombreEmprendimiento,
      imagenUrl: this.imagenUrl(fila.ImagenReferencia),
      imagenNombre: fila.ImagenReferencia,
      fechaEnvio: fila.CreadoEn,
      estado: fila.Estado,
      fechaRevision: fila.RevisadoEn,
      motivoRechazo: fila.Estado === 'Rechazada' ? fila.MotivoRechazo : null,
      sugerencias: fila.Estado === 'Rechazada' ? fila.Sugerencias : null,
      solicitudEdicion: this.formatearSolicitudEdicion(fila.SolicitudEdicion),
      solicitudEliminacion: fila.SolicitudEliminacion,
    };
    if (!detalle) return base;
    return {
      ...base,
      direccion: this.textoUbicacion(fila),
      provincia: fila.Provincia,
      canton: fila.Canton,
      distrito: fila.Distrito,
      senas: fila.Direccion,
      enlaceUbicacion: fila.EnlaceUbicacion,
      latitud: fila.Latitud,
      longitud: fila.Longitud,
      descripcion: fila.Descripcion,
      facebook: fila.Facebook,
      instagram: fila.Instagram,
      whatsapp: fila.Whatsapp,
      sitioWeb: fila.SitioWeb,
      correo: fila.CorreoContacto,
      telefono: fila.TelefonoContacto,
      terminosVersion: fila.TerminosVersion,
      terminosAceptadosEn: fila.TerminosAceptadosEn,
    };
  }

  private vistaAdmin(fila: PropuestaProductor, detalle = false) {
    const base = {
      id: String(fila.Id),
      nombre: fila.NombreEmprendimiento,
      correo: fila.CorreoContacto,
      estado: fila.Estado,
      fechaEnvio: fila.CreadoEn,
      fechaRevision: fila.RevisadoEn,
      imagenUrl: this.imagenUrl(fila.ImagenReferencia),
      imagenNombre: fila.ImagenReferencia,
      solicitudEdicion: this.formatearSolicitudEdicion(fila.SolicitudEdicion),
      solicitudEliminacion: fila.SolicitudEliminacion,
    };
    if (!detalle) return base;
    return {
      ...base,
      usuarioId: fila.UsuarioId,
      direccion: this.textoUbicacion(fila),
      provincia: fila.Provincia,
      canton: fila.Canton,
      distrito: fila.Distrito,
      senas: fila.Direccion,
      enlaceUbicacion: fila.EnlaceUbicacion,
      latitud: fila.Latitud,
      longitud: fila.Longitud,
      descripcion: fila.Descripcion,
      facebook: fila.Facebook,
      instagram: fila.Instagram,
      whatsapp: fila.Whatsapp,
      sitioWeb: fila.SitioWeb,
      telefono: fila.TelefonoContacto,
      terminosVersion: fila.TerminosVersion,
      terminosAceptadosEn: fila.TerminosAceptadosEn,
      revisadoPorId: fila.RevisadoPorId,
      motivoRechazo: fila.MotivoRechazo,
      sugerencias: fila.Sugerencias,
      notaInterna: fila.NotaInterna,
    };
  }
}
