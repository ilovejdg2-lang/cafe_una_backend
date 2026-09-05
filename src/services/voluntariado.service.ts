import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SolicitudVoluntariado } from '../entities/solicitud-voluntariado.entity';
import { FechasVoluntariadoService } from './fechas-voluntariado.service';

export type FiltrosSolicitudesVoluntariado = {
  nombre?: string;
  tipo?: string;
  estado?: string;
  fecha?: string;
};

@Injectable()
export class VoluntariadoService {
  constructor(
    @InjectRepository(SolicitudVoluntariado)
    private readonly repo: Repository<SolicitudVoluntariado>,
    private readonly fechasService: FechasVoluntariadoService,
  ) {}

  async obtenerSolicitudes(
    filtros: FiltrosSolicitudesVoluntariado = {},
  ): Promise<SolicitudVoluntariado[]> {
    const qb = this.repo.createQueryBuilder('solicitud');

    if (filtros.nombre?.trim()) {
      qb.andWhere('LOWER(solicitud.Nombre) LIKE :nombre', {
        nombre: `%${filtros.nombre.trim().toLowerCase()}%`,
      });
    }

    if (filtros.tipo?.trim()) {
      qb.andWhere('solicitud.TipoVoluntariado = :tipo', {
        tipo: filtros.tipo.trim(),
      });
    }

    if (filtros.estado?.trim()) {
      qb.andWhere('solicitud.Estado = :estado', {
        estado: filtros.estado.trim(),
      });
    }

    if (filtros.fecha?.trim()) {
      qb.andWhere('solicitud.FechaSolicitud = :fecha', {
        fecha: filtros.fecha.trim(),
      });
    }

    return qb.orderBy('solicitud.Id', 'ASC').getMany();
  }

  async obtenerPorId(id: string): Promise<SolicitudVoluntariado | null> {
    return this.repo.findOne({ where: { Id: id } });
  }

  async obtenerSolicitudesDeUsuario(userId: string): Promise<SolicitudVoluntariado[]> {
    const solicitudes = await this.obtenerSolicitudes();
    return solicitudes.filter((s) => s.UserId === userId);
  }

  async crear(request: {
    UserId: string;
    Nombre?: string | null;
    Email?: string | null;
    Telefono?: string | null;
    TipoVoluntariado?: string | null;
    Identificacion?: string | null;
    Institucion?: string | null;
    Pais?: string | null;
    Modalidad?: string | null;
    CantidadParticipantes?: number | null;
    Residencia?: string | null;
    Horario?: string | null;
    Dias?: string | null;
    Area?: string | null;
    Descripcion?: string | null;
    Motivacion?: string | null;
    DocumentoAdjunto?: string | null;
  }): Promise<SolicitudVoluntariado> {
    if (
      !request.UserId?.trim() ||
      request.UserId.trim().toLowerCase() === 'anonimo'
    ) {
      throw new Error(
        'La solicitud de voluntariado debe estar asociada a un usuario.',
      );
    }

    // Validar fecha habilitada si se especifica en Dias
    const diasStr = String(request.Dias || '').trim();
    const matchFecha = diasStr.match(/\d{4}-\d{2}-\d{2}/);
    if (matchFecha) {
      const fechaSolicitada = matchFecha[0];
      const disponibles = await this.fechasService.listarDisponibles();
      // Si hay fechas configuradas en el sistema, la fecha solicitada DEBE estar habilitada
      if (disponibles.length > 0) {
        const estaHabilitada = disponibles.some((d) => String(d.Fecha).slice(0, 10) === fechaSolicitada);
        if (!estaHabilitada) {
          throw new BadRequestException(
            `La fecha ${fechaSolicitada} no está habilitada para realizar voluntariados. Por favor seleccione una fecha disponible del calendario.`,
          );
        }
      }
    }

    const hoy = new Date();
    const fecha = `${hoy.getUTCFullYear()}-${String(hoy.getUTCMonth() + 1).padStart(2, '0')}-${String(hoy.getUTCDate()).padStart(2, '0')}`;

    const solicitud = this.repo.create({
      UserId: request.UserId.trim(),
      FechaSolicitud: fecha,
      Estado: 'Pendiente',
      Nombre: request.Nombre ?? null,
      Email: request.Email ?? null,
      Telefono: request.Telefono ?? null,
      TipoVoluntariado: request.TipoVoluntariado ?? null,
      Identificacion: request.Identificacion ?? null,
      Institucion: request.Institucion ?? null,
      Pais: request.Pais ?? null,
      Modalidad: request.Modalidad ?? null,
      CantidadParticipantes: request.CantidadParticipantes ?? null,
      Residencia: request.Residencia ?? null,
      Horario: request.Horario ?? null,
      Dias: request.Dias ?? null,
      Area: request.Area ?? null,
      Descripcion: request.Descripcion ?? null,
      Motivacion: request.Motivacion ?? null,
      DocumentoAdjunto: request.DocumentoAdjunto ?? null,
    });

    return this.repo.save(solicitud);
  }

  async actualizar(
    id: string,
    cambios: Partial<SolicitudVoluntariado>,
  ): Promise<SolicitudVoluntariado | null> {
    const actual = await this.repo.findOne({ where: { Id: id } });
    if (!actual) return null;

    if (cambios.UserId?.trim()) actual.UserId = cambios.UserId.trim();
    if (cambios.FechaSolicitud?.trim()) actual.FechaSolicitud = cambios.FechaSolicitud;
    if (cambios.Estado?.trim()) actual.Estado = cambios.Estado;
    if (cambios.Nombre !== undefined) actual.Nombre = cambios.Nombre;
    if (cambios.Email !== undefined) actual.Email = cambios.Email;
    if (cambios.Telefono !== undefined) actual.Telefono = cambios.Telefono;
    if (cambios.TipoVoluntariado !== undefined) {
      actual.TipoVoluntariado = cambios.TipoVoluntariado;
    }
    if (cambios.Identificacion !== undefined) {
      actual.Identificacion = cambios.Identificacion;
    }
    if (cambios.Institucion !== undefined) actual.Institucion = cambios.Institucion;
    if (cambios.Pais !== undefined) actual.Pais = cambios.Pais;
    if (cambios.Modalidad !== undefined) actual.Modalidad = cambios.Modalidad;
    if (cambios.CantidadParticipantes !== undefined) {
      actual.CantidadParticipantes = cambios.CantidadParticipantes;
    }
    if (cambios.Residencia !== undefined) actual.Residencia = cambios.Residencia;
    if (cambios.Horario !== undefined) actual.Horario = cambios.Horario;
    if (cambios.Dias !== undefined) actual.Dias = cambios.Dias;
    if (cambios.Area !== undefined) actual.Area = cambios.Area;
    if (cambios.Descripcion !== undefined) actual.Descripcion = cambios.Descripcion;
    if (cambios.Motivacion !== undefined) actual.Motivacion = cambios.Motivacion;
    if (cambios.ObservacionesAdmin !== undefined) {
      actual.ObservacionesAdmin = cambios.ObservacionesAdmin;
    }
    if (cambios.DocumentoAdjunto !== undefined) {
      actual.DocumentoAdjunto = cambios.DocumentoAdjunto;
    }

    return this.repo.save(actual);
  }

  async obtenerNombreArchivoDocumento(id: string): Promise<string | null> {
    const solicitud = await this.repo.findOne({ where: { Id: id } });
    return solicitud?.DocumentoAdjunto ?? null;
  }

  async eliminar(id: string): Promise<boolean> {
    const solicitud = await this.repo.findOne({ where: { Id: id } });
    if (!solicitud) return false;
    await this.repo.remove(solicitud);
    return true;
  }
}
