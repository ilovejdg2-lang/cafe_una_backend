import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { pickString } from '../common/body-fields';
import { DonacionNecesidad } from '../entities/donacion-necesidad.entity';
import {
  ESTADOS_SOLICITUD_DONACION,
  DonacionSolicitud,
  type EstadoSolicitudDonacion,
} from '../entities/donacion-solicitud.entity';

@Injectable()
export class DonacionSolicitudesService {
  constructor(
    @InjectRepository(DonacionSolicitud)
    private readonly solicitudes: Repository<DonacionSolicitud>,
    @InjectRepository(DonacionNecesidad)
    private readonly necesidades: Repository<DonacionNecesidad>,
  ) {}

  async crear(body: Record<string, unknown>, usuarioId: number) {
    if (!usuarioId) {
      throw new BadRequestException('Debe iniciar sesión para donar.');
    }
    const descripcion = pickString(body, 'descripcion', 'Descripcion').trim();
    const fechaPropuesta = pickString(
      body,
      'fechaPropuesta',
      'FechaPropuesta',
    ).trim();
    if (!descripcion) {
      throw new BadRequestException('La descripción es obligatoria.');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaPropuesta)) {
      throw new BadRequestException(
        'La fecha propuesta debe tener formato YYYY-MM-DD.',
      );
    }

    let tipo = pickString(body, 'tipo', 'Tipo').trim();
    let necesidadId: number | null = null;
    const necesidadRaw = String(
      body.necesidadId ?? body.NecesidadId ?? body.necesidadUuid ?? '',
    ).trim();
    if (necesidadRaw) {
      const necesidad = /^\d+$/.test(necesidadRaw)
        ? await this.necesidades.findOne({
            where: { Id: Number(necesidadRaw), Estado: 'ACTIVA' },
          })
        : await this.necesidades.findOne({
            where: { Uuid: necesidadRaw, Estado: 'ACTIVA' },
          });
      if (!necesidad) {
        throw new NotFoundException('La necesidad ya no está activa.');
      }
      necesidadId = necesidad.Id;
      if (!tipo) tipo = necesidad.Titulo;
    }
    if (!tipo) {
      throw new BadRequestException('El tipo de donación es obligatorio.');
    }

    const detalles = this.sanitizarDetalles(body);

    const guardada = await this.solicitudes.save(
      this.solicitudes.create({
        UsuarioId: usuarioId,
        NecesidadId: necesidadId,
        Tipo: tipo.slice(0, 200),
        Descripcion: descripcion.slice(0, 2000),
        FechaPropuesta: fechaPropuesta,
        Detalles: detalles,
        Estado: 'Pendiente',
      }),
    );
    return this.mapear(guardada);
  }

  async listarPropias(usuarioId: number) {
    const rows = await this.solicitudes.find({
      where: { UsuarioId: usuarioId },
      relations: ['Necesidad'],
      order: { CreatedAt: 'DESC' },
    });
    return rows.map((row) => this.mapear(row));
  }

  async listarAdmin() {
    const rows = await this.solicitudes.find({
      relations: ['Necesidad', 'Usuario'],
      order: { CreatedAt: 'DESC' },
    });
    return rows.map((row) => this.mapear(row, true));
  }

  async actualizarEstado(id: string, body: Record<string, unknown>) {
    const solicitudId = Number(id);
    if (!Number.isInteger(solicitudId) || solicitudId <= 0) {
      throw new BadRequestException('Identificador de solicitud inválido.');
    }
    const row = await this.solicitudes.findOne({
      where: { Id: solicitudId },
      relations: ['Necesidad', 'Usuario'],
    });
    if (!row) {
      throw new NotFoundException('No se encontró la solicitud de donación.');
    }
    if (row.Estado !== 'Pendiente') {
      throw new BadRequestException(
        'Solo se puede aceptar o rechazar una solicitud pendiente.',
      );
    }

    const estado = this.normalizarEstadoResolucion(
      pickString(body, 'estado', 'Estado'),
    );
    row.Estado = estado;
    const guardada = await this.solicitudes.save(row);
    return this.mapear(guardada, true);
  }

  private normalizarEstadoResolucion(valor: string): EstadoSolicitudDonacion {
    const normalized = valor
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    if (normalized === 'aceptada' || normalized === 'aceptado' || normalized === 'aprobada' || normalized === 'aprobado') {
      return 'Aceptada';
    }
    if (normalized === 'rechazada' || normalized === 'rechazado') {
      return 'Rechazada';
    }
    throw new BadRequestException(
      `El estado debe ser Aceptada o Rechazada. Valores válidos: ${ESTADOS_SOLICITUD_DONACION.join(', ')}.`,
    );
  }

  private sanitizarDetalles(
    body: Record<string, unknown>,
  ): Record<string, unknown> | null {
    const raw =
      body.detalles && typeof body.detalles === 'object' && !Array.isArray(body.detalles)
        ? (body.detalles as Record<string, unknown>)
        : body;
    const texto = (clave: string, max: number) =>
      pickString(raw, clave).trim().slice(0, max);
    const fotosRaw = raw.fotos ?? raw.Fotos;
    const fotos = Array.isArray(fotosRaw)
      ? fotosRaw.slice(0, 5).map((foto) => {
          const item = foto && typeof foto === 'object' ? (foto as Record<string, unknown>) : {};
          return {
            nombre: String(item.nombre ?? item.Nombre ?? '').slice(0, 200),
            tipo: String(item.tipo ?? item.Tipo ?? '').slice(0, 80),
            tamano: Number(item.tamano ?? item.Tamano ?? 0) || 0,
            url: String(item.url ?? item.Url ?? item.dataUrl ?? '')
              .trim()
              .slice(0, 1_500_000),
          };
        })
      : [];
    const horariosRaw = raw.horarios ?? raw.Horarios;
    const horarios = Array.isArray(horariosRaw)
      ? horariosRaw.map((item) => String(item).trim()).filter(Boolean).slice(0, 5)
      : [];

    const detalles = {
      donanteNombre: texto('donanteNombre', 200),
      tipoDonante: texto('tipoDonante', 20),
      nombre: texto('nombre', 80),
      primerApellido: texto('primerApellido', 80),
      segundoApellido: texto('segundoApellido', 80),
      tipoIdentificacion: texto('tipoIdentificacion', 40),
      numeroIdentificacion: texto('numeroIdentificacion', 40),
      correo: texto('correo', 160),
      telefono: texto('telefono', 20),
      cantidadEstimada: texto('cantidadEstimada', 200),
      estadoArticulos: texto('estadoArticulos', 80),
      metodoEntrega: texto('metodoEntrega', 40),
      direccionRecoleccion: texto('direccionRecoleccion', 500),
      horarios,
      horaEntrega: texto('horaEntrega', 8),
      fechaEntrega: texto('fechaEntrega', 10),
      fechaSolicitud: texto('fechaSolicitud', 10),
      valorEstimado: texto('valorEstimado', 40),
      fotos,
    };

    const tieneDatos = Object.values(detalles).some((valor) =>
      Array.isArray(valor) ? valor.length > 0 : Boolean(valor),
    );
    return tieneDatos ? detalles : null;
  }

  private mapear(row: DonacionSolicitud, admin = false) {
    const detalles =
      row.Detalles && typeof row.Detalles === 'object' ? row.Detalles : null;
    return {
      id: row.Id,
      tipo: row.Tipo,
      descripcion: row.Descripcion,
      fechaPropuesta:
        typeof row.FechaPropuesta === 'string'
          ? row.FechaPropuesta.slice(0, 10)
          : String(row.FechaPropuesta ?? '').slice(0, 10),
      estado: row.Estado,
      createdAt: row.CreatedAt,
      necesidadId: row.NecesidadId,
      necesidadTitulo: row.Necesidad?.Titulo ?? row.Tipo,
      detalles,
      donanteNombre:
        (typeof detalles?.donanteNombre === 'string' && detalles.donanteNombre) ||
        row.Usuario?.Nombre ||
        '',
      ...(admin
        ? {
            usuarioId: row.UsuarioId,
            usuarioNombre: row.Usuario?.Nombre ?? '',
            usuarioCorreo: row.Usuario?.Correo ?? '',
          }
        : {}),
    };
  }
}
