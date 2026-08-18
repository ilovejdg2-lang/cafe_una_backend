import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EstadoSolicitud } from '../entities/estado-solicitud.entity';
import { SolicitudVoluntariado } from '../entities/solicitud-voluntariado.entity';
import { TipoVoluntariado } from '../entities/tipo-voluntariado.entity';

@Injectable()
export class VoluntariadoService {
  constructor(
    @InjectRepository(SolicitudVoluntariado)
    private readonly repo: Repository<SolicitudVoluntariado>,
    @InjectRepository(EstadoSolicitud)
    private readonly estadosRepo: Repository<EstadoSolicitud>,
    @InjectRepository(TipoVoluntariado)
    private readonly tiposRepo: Repository<TipoVoluntariado>,
  ) {}

  async obtenerSolicitudes(): Promise<SolicitudVoluntariado[]> {
    return this.repo.find({ order: { Id: 'ASC' } });
  }

  async obtenerSolicitudesDeUsuario(userId: string): Promise<SolicitudVoluntariado[]> {
    const solicitudes = await this.obtenerSolicitudes();
    return solicitudes.filter((s) => String(s.UserId) === String(userId));
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
  }): Promise<SolicitudVoluntariado> {
    if (
      !request.UserId?.trim() ||
      request.UserId.trim().toLowerCase() === 'anonimo'
    ) {
      throw new Error(
        'La solicitud de voluntariado debe estar asociada a un usuario.',
      );
    }

    const hoy = new Date();
    const fecha = `${hoy.getUTCFullYear()}-${String(hoy.getUTCMonth() + 1).padStart(2, '0')}-${String(hoy.getUTCDate()).padStart(2, '0')}`;
    const tipo = await this.buscarTipo(request.TipoVoluntariado);

    const solicitud = this.repo.create({
      UserId: request.UserId.trim(),
      FechaSolicitud: fecha,
      estadoRelacion: await this.obtenerEstado('Pendiente'),
      Nombre: request.Nombre ?? null,
      Email: request.Email ?? null,
      Telefono: request.Telefono ?? null,
      tipoRelacion: tipo,
      tipoOtro: tipo ? null : request.TipoVoluntariado ?? null,
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
    });

    const saved = await this.repo.save(solicitud);
    return (await this.repo.findOne({ where: { Id: saved.Id } })) ?? saved;
  }

  async actualizar(
    id: string,
    cambios: Partial<SolicitudVoluntariado>,
  ): Promise<SolicitudVoluntariado | null> {
    const actual = await this.repo.findOne({ where: { Id: id } });
    if (!actual) return null;

    if (cambios.UserId?.trim()) actual.UserId = cambios.UserId.trim();
    if (cambios.FechaSolicitud?.trim()) actual.FechaSolicitud = cambios.FechaSolicitud;
    if (cambios.Estado?.trim()) {
      actual.estadoRelacion = await this.obtenerEstado(cambios.Estado.trim());
    }
    if (cambios.Nombre !== undefined) actual.Nombre = cambios.Nombre;
    if (cambios.Email !== undefined) actual.Email = cambios.Email;
    if (cambios.Telefono !== undefined) actual.Telefono = cambios.Telefono;
    if (cambios.TipoVoluntariado !== undefined) {
      const tipo = await this.buscarTipo(cambios.TipoVoluntariado);
      actual.tipoRelacion = tipo;
      actual.tipoOtro = tipo ? null : cambios.TipoVoluntariado;
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

    const saved = await this.repo.save(actual);
    return (await this.repo.findOne({ where: { Id: saved.Id } })) ?? saved;
  }

  async eliminar(id: string): Promise<boolean> {
    const solicitud = await this.repo.findOne({ where: { Id: id } });
    if (!solicitud) return false;
    await this.repo.remove(solicitud);
    return true;
  }

  private async obtenerEstado(codigo: string): Promise<EstadoSolicitud> {
    const estado = await this.estadosRepo.findOne({ where: { codigo } });
    if (!estado) {
      throw new Error(`No existe el estado de solicitud "${codigo}".`);
    }
    return estado;
  }

  private async buscarTipo(
    valor?: string | null,
  ): Promise<TipoVoluntariado | null> {
    if (!valor?.trim()) return null;
    const texto = valor.trim();
    return this.tiposRepo
      .createQueryBuilder('t')
      .where('t.codigo = :texto OR t.nombre = :texto', { texto })
      .getOne();
  }
}
