import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DonacionSolicitudesService } from './donacion-solicitudes.service';
import { VisitasService } from './visitas.service';
import { VoluntariadoService } from './voluntariado.service';

export type TipoSolicitudCliente = 'donacion' | 'voluntariado' | 'visita';

export type SolicitudResumen = {
  id: string;
  tipo: TipoSolicitudCliente;
  tipoEtiqueta: string;
  identificador: string;
  fechaEnvio: string | null;
  estado: string;
  titulo: string;
};

const TIPOS_VALIDOS: TipoSolicitudCliente[] = [
  'donacion',
  'voluntariado',
  'visita',
];

@Injectable()
export class SolicitudesClienteService {
  constructor(
    private readonly donaciones: DonacionSolicitudesService,
    private readonly voluntariado: VoluntariadoService,
    private readonly visitas: VisitasService,
  ) {}

  async listarPropias(
    usuarioId: number,
    query: { tipo?: string; estado?: string } = {},
  ): Promise<{ data: SolicitudResumen[]; total: number }> {
    this.assertUsuario(usuarioId);
    const userKey = String(usuarioId);
    const tipoFiltro = this.normalizarTipo(query.tipo);
    const estadoFiltro = String(query.estado || '')
      .trim()
      .toLowerCase();

    const [donaciones, voluntariados, visitas] = await Promise.all([
      !tipoFiltro || tipoFiltro === 'donacion'
        ? this.donaciones.listarPropias(usuarioId)
        : Promise.resolve([]),
      !tipoFiltro || tipoFiltro === 'voluntariado'
        ? this.voluntariado.obtenerSolicitudesDeUsuario(userKey)
        : Promise.resolve([]),
      !tipoFiltro || tipoFiltro === 'visita'
        ? this.visitas.obtenerSolicitudesDeUsuario(userKey)
        : Promise.resolve([]),
    ]);

    const items: SolicitudResumen[] = [
      ...donaciones.map((row) => this.mapearDonacion(row)),
      ...voluntariados.map((row) => this.mapearVoluntariado(row)),
      ...visitas.map((row) => this.mapearVisita(row)),
    ];

    const filtrados = estadoFiltro
      ? items.filter((item) =>
          String(item.estado || '')
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .includes(
              estadoFiltro
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, ''),
            ),
        )
      : items;

    filtrados.sort((a, b) => {
      const ta = a.fechaEnvio ? Date.parse(a.fechaEnvio) : 0;
      const tb = b.fechaEnvio ? Date.parse(b.fechaEnvio) : 0;
      return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
    });

    return { data: filtrados, total: filtrados.length };
  }

  async obtenerPropia(
    usuarioId: number,
    tipoRaw: string,
    idRaw: string,
  ): Promise<{
    resumen: SolicitudResumen;
    detalle: Record<string, unknown>;
  }> {
    this.assertUsuario(usuarioId);
    const tipo = this.normalizarTipo(tipoRaw);
    if (!tipo) {
      throw new NotFoundException('Tipo de solicitud no válido.');
    }
    const id = String(idRaw || '').trim();
    if (!id) {
      throw new NotFoundException('Identificador de solicitud no válido.');
    }

    const userKey = String(usuarioId);

    if (tipo === 'donacion') {
      const propias = await this.donaciones.listarPropias(usuarioId);
      const row = propias.find((item) => String(item.id) === id);
      if (!row) {
        throw new NotFoundException(
          'No se encontró esa solicitud de donación.',
        );
      }
      return {
        resumen: this.mapearDonacion(row),
        detalle: row as unknown as Record<string, unknown>,
      };
    }

    if (tipo === 'voluntariado') {
      const row = await this.voluntariado.obtenerPorId(id);
      if (!row || String(row.UserId) !== userKey) {
        throw new NotFoundException(
          'No se encontró esa solicitud de voluntariado.',
        );
      }
      return {
        resumen: this.mapearVoluntariado(row),
        detalle: this.detalleVoluntariado(row),
      };
    }

    const row = await this.visitas.obtenerPorId(id);
    if (!row || String(row.UserId ?? '') !== userKey) {
      throw new NotFoundException('No se encontró esa solicitud de visita.');
    }
    return {
      resumen: this.mapearVisita(row),
      detalle: this.detalleVisita(row),
    };
  }

  private assertUsuario(usuarioId: number) {
    const id = Number(usuarioId);
    if (!Number.isFinite(id) || id <= 0) {
      throw new ForbiddenException(
        'Debés iniciar sesión para ver tus solicitudes.',
      );
    }
  }

  private normalizarTipo(valor?: string): TipoSolicitudCliente | null {
    const raw = String(valor || '')
      .trim()
      .toLowerCase();
    if (!raw || raw === 'todos' || raw === 'all') return null;
    if (raw === 'donacion' || raw === 'donación' || raw === 'donaciones') {
      return 'donacion';
    }
    if (raw === 'voluntariado' || raw === 'voluntariados') {
      return 'voluntariado';
    }
    if (raw === 'visita' || raw === 'visitas' || raw === 'visita_grupal') {
      return 'visita';
    }
    if (TIPOS_VALIDOS.includes(raw as TipoSolicitudCliente)) {
      return raw as TipoSolicitudCliente;
    }
    return null;
  }

  private mapearDonacion(row: {
    id: number | string;
    estado?: string;
    createdAt?: Date | string;
    fechaPropuesta?: string;
    necesidadTitulo?: string;
    tipo?: string;
    materialNombre?: string;
  }): SolicitudResumen {
    const identificador = String(row.id);
    return {
      id: `donacion:${identificador}`,
      tipo: 'donacion',
      tipoEtiqueta: 'Donación',
      identificador,
      fechaEnvio: this.fechaIso(row.createdAt) || row.fechaPropuesta || null,
      estado: row.estado || 'Pendiente',
      titulo:
        row.necesidadTitulo ||
        row.materialNombre ||
        row.tipo ||
        'Solicitud de donación',
    };
  }

  private mapearVoluntariado(row: {
    Id: string | number;
    Estado?: string;
    FechaSolicitud?: string;
    TipoVoluntariado?: string | null;
    Area?: string | null;
  }): SolicitudResumen {
    const identificador = String(row.Id);
    return {
      id: `voluntariado:${identificador}`,
      tipo: 'voluntariado',
      tipoEtiqueta: 'Voluntariado',
      identificador,
      fechaEnvio: this.fechaTexto(row.FechaSolicitud),
      estado: row.Estado || 'Pendiente',
      titulo: row.TipoVoluntariado || row.Area || 'Solicitud de voluntariado',
    };
  }

  private mapearVisita(row: {
    Id: string | number;
    Estado?: string;
    FechaSolicitud?: string;
    FechaVisita?: string;
    TipoGrupo?: string;
    TipoVisitante?: string;
  }): SolicitudResumen {
    const identificador = String(row.Id);
    return {
      id: `visita:${identificador}`,
      tipo: 'visita',
      tipoEtiqueta: 'Visita grupal',
      identificador,
      fechaEnvio: this.fechaTexto(row.FechaSolicitud),
      estado: row.Estado || 'Pendiente',
      titulo:
        row.TipoGrupo ||
        row.TipoVisitante ||
        (row.FechaVisita
          ? `Visita ${row.FechaVisita}`
          : 'Solicitud de visita'),
    };
  }

  private detalleVoluntariado(row: {
    Id: string | number;
    Estado?: string;
    FechaSolicitud?: string;
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
    ObservacionesAdmin?: string | null;
  }): Record<string, unknown> {
    return {
      id: row.Id,
      estado: row.Estado,
      fechaSolicitud: row.FechaSolicitud,
      nombre: row.Nombre,
      email: row.Email,
      telefono: row.Telefono,
      tipoVoluntariado: row.TipoVoluntariado,
      identificacion: row.Identificacion,
      institucion: row.Institucion,
      pais: row.Pais,
      modalidad: row.Modalidad,
      cantidadParticipantes: row.CantidadParticipantes,
      residencia: row.Residencia,
      horario: row.Horario,
      dias: row.Dias,
      area: row.Area,
      descripcion: row.Descripcion,
      motivacion: row.Motivacion,
      observacionesAdmin: row.ObservacionesAdmin,
    };
  }

  private detalleVisita(row: {
    Id: string | number;
    Estado?: string;
    FechaSolicitud?: string;
    EncargadoNombre?: string;
    EncargadoEmail?: string;
    EncargadoTelefono?: string;
    EncargadoInstitucion?: string | null;
    TipoVisitante?: string;
    TipoGrupo?: string;
    CantidadVisitantes?: number;
    CiudadProvincia?: string;
    PaisProcedencia?: string | null;
    FechaVisita?: string;
    HoraPreferida?: string;
    MotivoVisita?: string;
    MotivoOtro?: string | null;
    ObservacionesAdmin?: string | null;
  }): Record<string, unknown> {
    return {
      id: row.Id,
      estado: row.Estado,
      fechaSolicitud: row.FechaSolicitud,
      encargadoNombre: row.EncargadoNombre,
      encargadoEmail: row.EncargadoEmail,
      encargadoTelefono: row.EncargadoTelefono,
      encargadoInstitucion: row.EncargadoInstitucion,
      tipoVisitante: row.TipoVisitante,
      tipoGrupo: row.TipoGrupo,
      cantidadVisitantes: row.CantidadVisitantes,
      ciudadProvincia: row.CiudadProvincia,
      paisProcedencia: row.PaisProcedencia,
      fechaVisita: row.FechaVisita,
      horaPreferida: row.HoraPreferida,
      motivoVisita: row.MotivoVisita,
      motivoOtro: row.MotivoOtro,
      observacionesAdmin: row.ObservacionesAdmin,
    };
  }

  private fechaIso(valor?: Date | string | null): string | null {
    if (!valor) return null;
    const date = valor instanceof Date ? valor : new Date(valor);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  }

  private fechaTexto(valor?: string | null): string | null {
    const texto = String(valor || '').trim();
    return texto || null;
  }
}
