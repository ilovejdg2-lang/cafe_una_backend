import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailService } from '../common/email.service';
import { pickString } from '../common/body-fields';
import { DonacionNecesidad } from '../entities/donacion-necesidad.entity';
import {
  ESTADOS_SOLICITUD_DONACION,
  DonacionSolicitud,
  type EstadoSolicitudDonacion,
} from '../entities/donacion-solicitud.entity';
import { DonacionMaterialesService } from './donacion-materiales.service';
import { FechasRecepcionDonacionService } from './fechas-recepcion-donacion.service';

const METODOS_ENTREGA = ['entrega', 'recoleccion'] as const;

@Injectable()
export class DonacionSolicitudesService {
  constructor(
    @InjectRepository(DonacionSolicitud)
    private readonly solicitudes: Repository<DonacionSolicitud>,
    @InjectRepository(DonacionNecesidad)
    private readonly necesidades: Repository<DonacionNecesidad>,
    private readonly materiales: DonacionMaterialesService,
    private readonly fechasRecepcion: FechasRecepcionDonacionService,
    private readonly emailService: EmailService,
  ) {}

  async crear(body: Record<string, unknown>, usuarioId: number) {
    if (!usuarioId) {
      throw new BadRequestException('Debe iniciar sesión para donar.');
    }
    const descripcion = pickString(body, 'descripcion', 'Descripcion').trim();
    if (!descripcion) {
      throw new BadRequestException('La descripción es obligatoria.');
    }

    const necesidadRaw = String(
      body.necesidadId ?? body.NecesidadId ?? body.necesidadUuid ?? '',
    ).trim();
    if (!necesidadRaw) {
      throw new BadRequestException('La categoría de donación es obligatoria.');
    }
    const necesidad = /^\d+$/.test(necesidadRaw)
      ? await this.necesidades.findOne({
          where: { Id: Number(necesidadRaw), Estado: 'ACTIVA' },
        })
      : await this.necesidades.findOne({
          where: { Uuid: necesidadRaw, Estado: 'ACTIVA' },
        });
    if (!necesidad) {
      throw new BadRequestException(
        'La categoría seleccionada no está activa o no existe.',
      );
    }

    const materialIdRaw = String(
      body.materialId ??
        body.MaterialId ??
        (body.detalles && typeof body.detalles === 'object'
          ? (body.detalles as Record<string, unknown>).materialId
          : '') ??
        '',
    ).trim();
    if (!/^\d+$/.test(materialIdRaw)) {
      throw new BadRequestException('El material o artículo es obligatorio.');
    }
    const material = await this.materiales.obtenerActivoDeCategoria(
      necesidad.Id,
      Number(materialIdRaw),
    );
    if (!material) {
      throw new BadRequestException(
        'El material seleccionado no pertenece a la categoría o no está activo.',
      );
    }

    const detalles = this.sanitizarDetalles(body, {
      materialId: material.Id,
      materialNombre: material.Nombre,
    });
    this.validarDetallesObligatorios(detalles);
    await this.validarFechaRecepcionSiAplica(detalles);

    const fechaPropuesta = this.resolverFechaPropuesta(detalles);
    const tipo = necesidad.Titulo.slice(0, 200);

    const guardada = await this.solicitudes.save(
      this.solicitudes.create({
        UsuarioId: usuarioId,
        NecesidadId: necesidad.Id,
        Tipo: tipo,
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

  async obtenerAdmin(id: string) {
    const row = await this.buscarPorId(id, true);
    return this.mapear(row, true);
  }

  async actualizarEstado(id: string, body: Record<string, unknown>) {
    const row = await this.buscarPorId(id, true);
    if (row.Estado !== 'Pendiente') {
      throw new BadRequestException(
        'Solo se puede aceptar o rechazar una solicitud pendiente.',
      );
    }

    const estado = this.normalizarEstadoResolucion(
      pickString(body, 'estado', 'Estado'),
    );
    const motivoRechazo =
      pickString(body, 'motivoRechazo', 'MotivoRechazo').trim() ||
      pickString(body, 'motivo', 'Motivo').trim();

    row.Estado = estado;
    const detalles =
      row.Detalles && typeof row.Detalles === 'object' ? { ...row.Detalles } : {};
    if (estado === 'Rechazada' && motivoRechazo) {
      detalles.motivoRechazo = motivoRechazo.slice(0, 1000);
    }
    row.Detalles = detalles;
    const guardada = await this.solicitudes.save(row);

    const correo =
      (typeof detalles.correo === 'string' && detalles.correo.trim()) ||
      row.Usuario?.Correo ||
      '';
    const nombre =
      (typeof detalles.donanteNombre === 'string' && detalles.donanteNombre.trim()) ||
      row.Usuario?.Nombre ||
      'Donante';
    if (correo) {
      await this.emailService.enviarActualizacionEstadoDonacion(correo, {
        nombre,
        categoria: row.Necesidad?.Titulo || row.Tipo,
        material:
          typeof detalles.materialNombre === 'string' ? detalles.materialNombre : '',
        estado,
        fechaActualizacion: new Date().toLocaleDateString('es-CR'),
        motivoRechazo: estado === 'Rechazada' ? motivoRechazo : '',
      });
    }

    return this.mapear(guardada, true);
  }

  private async buscarPorId(id: string, admin: boolean) {
    const solicitudId = Number(id);
    if (!Number.isInteger(solicitudId) || solicitudId <= 0) {
      throw new BadRequestException('Identificador de solicitud inválido.');
    }
    const row = await this.solicitudes.findOne({
      where: { Id: solicitudId },
      relations: admin ? ['Necesidad', 'Usuario'] : ['Necesidad'],
    });
    if (!row) {
      throw new NotFoundException('No se encontró la solicitud de donación.');
    }
    return row;
  }

  private normalizarEstadoResolucion(valor: string): EstadoSolicitudDonacion {
    const normalized = valor
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    if (
      normalized === 'aceptada' ||
      normalized === 'aceptado' ||
      normalized === 'aprobada' ||
      normalized === 'aprobado'
    ) {
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
    extras: { materialId: number; materialNombre: string },
  ): Record<string, unknown> {
    const raw =
      body.detalles && typeof body.detalles === 'object' && !Array.isArray(body.detalles)
        ? (body.detalles as Record<string, unknown>)
        : body;
    const texto = (clave: string, max: number) =>
      pickString(raw, clave).trim().slice(0, max);
    const fotosRaw = raw.fotos ?? raw.Fotos;
    if (Array.isArray(fotosRaw) && fotosRaw.length > 5) {
      throw new BadRequestException('Máximo 5 fotografías por solicitud.');
    }
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

    const valorEstimado = this.leerValorEstimado(
      raw.valorEstimado ?? raw.ValorEstimado ?? body.valorEstimado,
    );

    return {
      donanteNombre: texto('donanteNombre', 200),
      tipoDonante: texto('tipoDonante', 20),
      nombre: texto('nombre', 80),
      primerApellido: texto('primerApellido', 80),
      segundoApellido: texto('segundoApellido', 80),
      tipoIdentificacion: texto('tipoIdentificacion', 40),
      numeroIdentificacion: texto('numeroIdentificacion', 40),
      correo: texto('correo', 160),
      telefono: texto('telefono', 20),
      materialId: extras.materialId,
      materialNombre: extras.materialNombre.slice(0, 200),
      cantidadEstimada: texto('cantidadEstimada', 200),
      estadoArticulos: texto('estadoArticulos', 80),
      metodoEntrega: texto('metodoEntrega', 40).toLowerCase(),
      provincia: texto('provincia', 80),
      canton: texto('canton', 80),
      distrito: texto('distrito', 80),
      direccion: texto('direccion', 500),
      direccionRecoleccion: texto('direccionRecoleccion', 500),
      horarios,
      horaEntrega: texto('horaEntrega', 80),
      fechaEntrega: texto('fechaEntrega', 10),
      fechaSolicitud: texto('fechaSolicitud', 10),
      valorEstimado,
      fotos,
    };
  }

  private validarDetallesObligatorios(detalles: Record<string, unknown>) {
    const valor = Number(detalles.valorEstimado);
    if (!Number.isFinite(valor) || valor <= 0) {
      throw new BadRequestException(
        'El valor estimado es obligatorio y debe ser un número mayor a 0.',
      );
    }
    if (!String(detalles.cantidadEstimada || '').trim()) {
      throw new BadRequestException('La cantidad es obligatoria.');
    }
    if (!String(detalles.estadoArticulos || '').trim()) {
      throw new BadRequestException('El estado del artículo es obligatorio.');
    }
    const metodo = String(detalles.metodoEntrega || '');
    if (!METODOS_ENTREGA.includes(metodo as (typeof METODOS_ENTREGA)[number])) {
      throw new BadRequestException(
        'Debe indicar si entregará la donación o solicita recolección.',
      );
    }
    if (!String(detalles.provincia || '').trim()) {
      throw new BadRequestException('La provincia es obligatoria.');
    }
    if (!String(detalles.canton || '').trim()) {
      throw new BadRequestException('El cantón es obligatorio.');
    }
    if (!String(detalles.distrito || '').trim()) {
      throw new BadRequestException('El distrito es obligatorio.');
    }
    if (!String(detalles.direccion || '').trim()) {
      throw new BadRequestException('La dirección o señas son obligatorias.');
    }
    if (metodo === 'entrega') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(detalles.fechaEntrega || ''))) {
        throw new BadRequestException(
          'La fecha de entrega debe tener formato YYYY-MM-DD.',
        );
      }
      if (!String(detalles.horaEntrega || '').trim()) {
        throw new BadRequestException(
          'Debe seleccionar un horario de recepción disponible.',
        );
      }
    }
  }

  private async validarFechaRecepcionSiAplica(
    detalles: Record<string, unknown>,
  ) {
    if (String(detalles.metodoEntrega || '') !== 'entrega') return;
    const validacion = await this.fechasRecepcion.estaFechaYHorarioHabilitada(
      String(detalles.fechaEntrega || ''),
      String(detalles.horaEntrega || ''),
    );
    if (!validacion.valida) {
      throw new BadRequestException(
        validacion.mensajeError ||
          'La fecha u horario de recepción no está disponible.',
      );
    }
  }

  private leerValorEstimado(raw: unknown): string {
    const texto = String(raw ?? '')
      .replace(/[^\d.,]/g, '')
      .replace(/\./g, '')
      .replace(',', '.');
    const n = Number(texto || String(raw ?? '').replace(/[^\d.]/g, ''));
    if (!Number.isFinite(n) || n <= 0) return '';
    return String(Math.round(n * 100) / 100);
  }

  private resolverFechaPropuesta(detalles: Record<string, unknown>): string {
    const entrega = String(detalles.fechaEntrega || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(entrega)) return entrega;
    const solicitud = String(detalles.fechaSolicitud || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(solicitud)) return solicitud;
    return new Date().toISOString().slice(0, 10);
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
      materialId: detalles && typeof detalles.materialId === 'number' ? detalles.materialId : null,
      materialNombre:
        (detalles && typeof detalles.materialNombre === 'string' && detalles.materialNombre) ||
        '',
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
