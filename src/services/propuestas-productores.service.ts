import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';

import { contenidoCorreoPropuesta } from '../common/propuesta-correo';
import {
  TERMINOS_VERSION,
  assertTransicionDesdePendiente,
  validarClaveIdempotencia,
  validarMotivoRechazo,
  validarPropuestaEntrada,
} from '../common/propuesta-productor.util';
import { InformacionFooter } from '../entities/informacion-footer.entity';
import { PropuestaProductor } from '../entities/propuesta-productor.entity';
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
        return fila;
      });
      if (guardada.ImagenReferencia !== nombreArchivo) {
        await this.imagenes.eliminar(nombreArchivo);
      }
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
    const filas = await this.repo.find({
      where: { Estado: 'Aprobada' },
      order: { RevisadoEn: 'DESC', CreadoEn: 'DESC' },
    });
    return filas.map((fila) => this.vistaPublica(fila));
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
    return this.vistaAdmin(fila, true);
  }

  async aprobar(id: string, adminId: number) {
    return this.revisar(id, adminId, 'Aprobada', null);
  }

  async rechazar(id: string, adminId: number, motivoRaw: unknown) {
    let motivo: string;
    try {
      motivo = validarMotivoRechazo(motivoRaw);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'El motivo no es válido.',
      );
    }
    return this.revisar(id, adminId, 'Rechazada', motivo);
  }

  async leerImagen(nombre: string, usuarioId: number | null, esAdmin: boolean) {
    const fila = await this.repo.findOne({ where: { ImagenReferencia: nombre } });
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

  private async revisar(
    id: string,
    adminId: number,
    estado: 'Aprobada' | 'Rechazada',
    motivo: string | null,
  ) {
    const footer = await this.footerRepo.find({ order: { Id: 'ASC' }, take: 1 });
    const institucional = footer[0];
    let claveCorreo = '';
    const guardada = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(PropuestaProductor);
      const fila = await repo
        .createQueryBuilder('p')
        .setLock('pessimistic_write')
        .where('p.Id = :id', { id })
        .getOne();
      if (!fila) throw new NotFoundException('No se encontró la propuesta.');
      try {
        assertTransicionDesdePendiente(fila.Estado);
      } catch (error) {
        throw new ConflictException(
          error instanceof Error
            ? error.message
            : 'Esta propuesta ya fue revisada.',
        );
      }
      const ahora = new Date();
      fila.Estado = estado;
      fila.RevisadoEn = ahora;
      fila.RevisadoPorId = adminId;
      fila.MotivoRechazo = motivo;
      fila.ActualizadoEn = ahora;
      const actualizada = await repo.save(fila);
      await this.notificaciones.crearResultado(manager, actualizada);
      const contenido = contenidoCorreoPropuesta({
        nombreEmprendimiento: actualizada.NombreEmprendimiento,
        id: String(actualizada.Id),
        resultado: estado,
        fechaRevision: fechaCr(ahora) || '',
        enlaceMisPropuestas: this.enlaceMisPropuestas(actualizada.Id),
        motivo,
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
      ...this.vistaAdmin(guardada, true),
      correo: { estado: 'pendiente' as const },
    };
  }

  private async buscarPropia(usuarioId: number, id: string) {
    const fila = await this.repo.findOne({ where: { Id: id } });
    if (!fila || fila.UsuarioId !== usuarioId) {
      throw new NotFoundException('No se encontró la propuesta.');
    }
    return fila;
  }

  private enlaceMisPropuestas(id: string | number): string {
    const base =
      this.config.get<string>('FRONTEND_URL')?.trim() ||
      this.config.get<string>('CORS_ORIGINS')?.split(',')[0]?.trim() ||
      'http://localhost:5173';
    return `${base.replace(/\/$/, '')}/perfil/propuestas/${id}`;
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

  private textoUbicacion(fila: PropuestaProductor) {
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

  private vistaPublica(fila: PropuestaProductor) {
    return {
      id: String(fila.Id),
      nombre: fila.NombreEmprendimiento,
      imagenUrl: this.imagenUrl(fila.ImagenReferencia),
      descripcion: fila.Descripcion,
      direccion: this.textoUbicacion(fila),
      provincia: fila.Provincia,
      canton: fila.Canton,
      distrito: fila.Distrito,
      senas: fila.Direccion,
      enlaceUbicacion: fila.EnlaceUbicacion,
      facebook: fila.Facebook,
      instagram: fila.Instagram,
      whatsapp: fila.Whatsapp,
      sitioWeb: fila.SitioWeb,
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
    };
  }
}
