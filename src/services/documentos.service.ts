import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createReadStream, existsSync, mkdirSync, unlinkSync } from 'fs';
import { extname, join, relative, resolve, sep } from 'path';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Documento } from '../entities/documento.entity';
import { DescargaDocumento } from '../entities/descarga-documento.entity';
import { SolicitudDocumento } from '../entities/solicitud-documento.entity';
import { CategoriasService, TIPO_CATEGORIA_DOCUMENTO } from './categorias.service';
import { EmailService } from '../common/email.service';

export const DOCUMENTOS_DIR = join(process.cwd(), 'uploads', 'documentos');

export function asegurarDirectorioDocumentos(): void {
  if (!existsSync(DOCUMENTOS_DIR)) {
    mkdirSync(DOCUMENTOS_DIR, { recursive: true });
  }
}

export interface FiltrosDocumentosPublicos {
  categoria?: string;
  subcategoria?: string;
  buscar?: string;
  orden?: string;
}

export interface FiltrosDocumentosAdmin {
  categoria?: string;
  subcategoria?: string;
  buscar?: string;
  esPrivado?: string;
  activo?: string;
}

export interface CrearDocumentoDto {
  titulo: string;
  descripcion?: string;
  categoria: string;
  subcategoria?: string;
  esPrivado?: boolean | string;
  autor?: string;
  version?: string;
  palabrasClave?: string;
  activo?: boolean | string;
}

export interface ActualizarDocumentoDto {
  titulo?: string;
  descripcion?: string;
  categoria?: string;
  subcategoria?: string;
  esPrivado?: boolean | string;
  autor?: string;
  version?: string;
  palabrasClave?: string;
  activo?: boolean | string;
}

@Injectable()
export class DocumentosService {
  private readonly logger = new Logger(DocumentosService.name);

  constructor(
    @InjectRepository(Documento)
    private readonly docRepo: Repository<Documento>,
    @InjectRepository(DescargaDocumento)
    private readonly descargaRepo: Repository<DescargaDocumento>,
    @InjectRepository(SolicitudDocumento)
    private readonly solicitudRepo: Repository<SolicitudDocumento>,
    private readonly categoriasService: CategoriasService,
    private readonly emailService: EmailService,
  ) {
    asegurarDirectorioDocumentos();
  }

  /**
   * Lista documentos activos para la vista pública.
   * Muestra tanto públicos como privados (los privados tendrán la bandera esPrivado para solicitar archivo).
   */
  async listarPublicos(filtros: FiltrosDocumentosPublicos) {
    const qb = this.docRepo.createQueryBuilder('doc');
    qb.where('doc.Activo = :activo', { activo: true });

    if (filtros.categoria && filtros.categoria.trim()) {
      qb.andWhere(
        '(LOWER(doc.Categoria) = LOWER(:cat) OR LOWER(doc.Subcategoria) = LOWER(:cat))',
        { cat: filtros.categoria.trim() },
      );
    }

    if (filtros.subcategoria && filtros.subcategoria.trim()) {
      qb.andWhere('LOWER(doc.Subcategoria) = LOWER(:subcat)', {
        subcat: filtros.subcategoria.trim(),
      });
    }

    if (filtros.buscar && filtros.buscar.trim()) {
      const termino = `%${filtros.buscar.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(doc.Titulo) LIKE :term OR LOWER(doc.Descripcion) LIKE :term OR LOWER(doc.PalabrasClave) LIKE :term OR LOWER(doc.Autor) LIKE :term)',
        { term: termino },
      );
    }

    switch (filtros.orden) {
      case 'antiguos':
        qb.orderBy('doc.CreatedAt', 'ASC');
        break;
      case 'descargas':
        qb.orderBy('doc.DescargasCount', 'DESC');
        break;
      case 'az':
        qb.orderBy('doc.Titulo', 'ASC');
        break;
      case 'za':
        qb.orderBy('doc.Titulo', 'DESC');
        break;
      default:
        qb.orderBy('doc.CreatedAt', 'DESC');
        break;
    }

    const rows = await qb.getMany();

    return rows.map((d) => ({
      id: d.Id,
      titulo: d.Titulo,
      descripcion: d.Descripcion,
      categoria: d.Categoria,
      subcategoria: d.Subcategoria,
      nombreOriginal: d.NombreOriginal,
      mimeType: d.MimeType,
      tamanoBytes: Number(d.TamanoBytes),
      esPrivado: d.EsPrivado,
      autor: d.Autor,
      version: d.Version,
      palabrasClave: d.PalabrasClave,
      descargasCount: d.DescargasCount,
      fechaPublicacion: d.CreatedAt,
    }));
  }

  /**
   * Obtiene categorías de tipo 'documento' con conteo de documentos activos
   */
  async listarCategorias() {
    let categorias = await this.categoriasService.listar(TIPO_CATEGORIA_DOCUMENTO);
    if (!categorias || categorias.length === 0) {
      const base = [
        'Investigaciones',
        'Manuales y Guías',
        'Informes Institucionales',
        'Normativa y Reglamentos',
      ];
      for (const nombre of base) {
        await this.categoriasService.asegurar(nombre, TIPO_CATEGORIA_DOCUMENTO, '');
      }
      categorias = await this.categoriasService.listar(TIPO_CATEGORIA_DOCUMENTO);
    }
    return categorias;
  }

  /**
   * Lista completa para el panel administrativo con filtros
   */
  async listarAdmin(filtros: FiltrosDocumentosAdmin) {
    const qb = this.docRepo.createQueryBuilder('doc');

    if (filtros.categoria && filtros.categoria.trim()) {
      qb.andWhere(
        '(LOWER(doc.Categoria) = LOWER(:cat) OR LOWER(doc.Subcategoria) = LOWER(:cat))',
        { cat: filtros.categoria.trim() },
      );
    }

    if (filtros.subcategoria && filtros.subcategoria.trim()) {
      qb.andWhere('LOWER(doc.Subcategoria) = LOWER(:subcat)', {
        subcat: filtros.subcategoria.trim(),
      });
    }

    if (filtros.buscar && filtros.buscar.trim()) {
      const termino = `%${filtros.buscar.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(doc.Titulo) LIKE :term OR LOWER(doc.Descripcion) LIKE :term OR LOWER(doc.PalabrasClave) LIKE :term OR LOWER(doc.Autor) LIKE :term)',
        { term: termino },
      );
    }

    if (filtros.esPrivado !== undefined && filtros.esPrivado !== '') {
      const esPriv = filtros.esPrivado === 'true' || filtros.esPrivado === '1';
      qb.andWhere('doc.EsPrivado = :esPriv', { esPriv });
    }

    if (filtros.activo !== undefined && filtros.activo !== '') {
      const esActivo = filtros.activo === 'true' || filtros.activo === '1';
      qb.andWhere('doc.Activo = :esActivo', { esActivo });
    }

    qb.orderBy('doc.CreatedAt', 'DESC');

    const rows = await qb.getMany();
    return rows.map((d) => ({
      id: d.Id,
      titulo: d.Titulo,
      descripcion: d.Descripcion,
      categoria: d.Categoria,
      subcategoria: d.Subcategoria,
      nombreArchivo: d.NombreArchivo,
      nombreOriginal: d.NombreOriginal,
      mimeType: d.MimeType,
      tamanoBytes: Number(d.TamanoBytes),
      esPrivado: d.EsPrivado,
      autor: d.Autor,
      version: d.Version,
      palabrasClave: d.PalabrasClave,
      descargasCount: d.DescargasCount,
      activo: d.Activo,
      createdAt: d.CreatedAt,
      updatedAt: d.UpdatedAt,
    }));
  }

  /**
   * Obtiene documento por ID
   */
  async obtenerPorId(id: string): Promise<Documento> {
    const doc = await this.docRepo.findOne({ where: { Id: id } });
    if (!doc) {
      throw new NotFoundException(`Documento con ID ${id} no encontrado.`);
    }
    return doc;
  }

  /**
   * Crea un documento con subida de archivo
   */
  async crear(
    file: Express.Multer.File | undefined,
    data: CrearDocumentoDto,
  ): Promise<Documento> {
    if (!file) {
      throw new BadRequestException('Debe seleccionar un archivo para subir.');
    }

    const titulo = String(data.titulo || '').trim();
    if (!titulo) {
      throw new BadRequestException('El título del documento es requerido.');
    }

    const categoria = String(data.categoria || '').trim();
    if (!categoria) {
      throw new BadRequestException('La categoría del documento es requerida.');
    }

    const subcategoria = String(data.subcategoria || '').trim();
    const esPrivado =
      data.esPrivado === true ||
      data.esPrivado === 'true' ||
      data.esPrivado === '1';
    const activo =
      data.activo === undefined
        ? true
        : data.activo === true ||
          data.activo === 'true' ||
          data.activo === '1';

    // Asegurar que la categoría existe en el catálogo
    await this.categoriasService.asegurar(
      categoria,
      TIPO_CATEGORIA_DOCUMENTO,
      '',
    );
    if (subcategoria) {
      await this.categoriasService.asegurar(
        subcategoria,
        TIPO_CATEGORIA_DOCUMENTO,
        categoria,
      );
    }

    const doc = this.docRepo.create({
      Titulo: titulo,
      Descripcion: String(data.descripcion || '').trim(),
      Categoria: categoria,
      Subcategoria: subcategoria,
      NombreArchivo: file.filename,
      NombreOriginal: file.originalname,
      MimeType: file.mimetype || 'application/octet-stream',
      TamanoBytes: file.size || 0,
      EsPrivado: esPrivado,
      Autor: String(data.autor || '').trim(),
      Version: String(data.version || '1.0').trim(),
      PalabrasClave: String(data.palabrasClave || '').trim(),
      DescargasCount: 0,
      Activo: activo,
    });

    return this.docRepo.save(doc);
  }

  /**
   * Actualiza los datos de un documento y opcionalmente reemplaza el archivo
   */
  async actualizar(
    id: string,
    data: ActualizarDocumentoDto,
    file?: Express.Multer.File,
  ): Promise<Documento> {
    const doc = await this.obtenerPorId(id);

    if (data.titulo !== undefined) {
      const titulo = String(data.titulo).trim();
      if (!titulo) {
        throw new BadRequestException('El título no puede estar vacío.');
      }
      doc.Titulo = titulo;
    }

    if (data.descripcion !== undefined) {
      doc.Descripcion = String(data.descripcion).trim();
    }

    if (data.categoria !== undefined) {
      const categoria = String(data.categoria).trim();
      if (!categoria) {
        throw new BadRequestException('La categoría no puede estar vacía.');
      }
      doc.Categoria = categoria;
      await this.categoriasService.asegurar(
        categoria,
        TIPO_CATEGORIA_DOCUMENTO,
        '',
      );
    }

    if (data.subcategoria !== undefined) {
      const subcategoria = String(data.subcategoria).trim();
      doc.Subcategoria = subcategoria;
      if (subcategoria) {
        await this.categoriasService.asegurar(
          subcategoria,
          TIPO_CATEGORIA_DOCUMENTO,
          doc.Categoria,
        );
      }
    }

    if (data.esPrivado !== undefined) {
      doc.EsPrivado =
        data.esPrivado === true ||
        data.esPrivado === 'true' ||
        data.esPrivado === '1';
    }

    if (data.autor !== undefined) {
      doc.Autor = String(data.autor).trim();
    }

    if (data.version !== undefined) {
      doc.Version = String(data.version).trim();
    }

    if (data.palabrasClave !== undefined) {
      doc.PalabrasClave = String(data.palabrasClave).trim();
    }

    if (data.activo !== undefined) {
      doc.Activo =
        data.activo === true ||
        data.activo === 'true' ||
        data.activo === '1';
    }

    // Si viene nuevo archivo, eliminar el viejo físicamente y asignar el nuevo
    if (file) {
      this.eliminarArchivoFisico(doc.NombreArchivo);
      doc.NombreArchivo = file.filename;
      doc.NombreOriginal = file.originalname;
      doc.MimeType = file.mimetype || 'application/octet-stream';
      doc.TamanoBytes = file.size || 0;
    }

    return this.docRepo.save(doc);
  }

  /**
   * Cambia el estado Activo / Inactivo
   */
  async cambiarEstado(id: string, activo: boolean): Promise<Documento> {
    const doc = await this.obtenerPorId(id);
    doc.Activo = activo;
    return this.docRepo.save(doc);
  }

  /**
   * Elimina un documento y su archivo físico
   */
  async eliminar(id: string): Promise<boolean> {
    const doc = await this.obtenerPorId(id);
    this.eliminarArchivoFisico(doc.NombreArchivo);
    await this.docRepo.remove(doc);
    return true;
  }

  /**
   * Descarga segura de un documento (REP-P02-T3)
   */
  async descargar(
    id: string,
    usuario?: { id?: string; name?: string; username?: string; role?: string; roles?: string[] },
    ip?: string,
  ): Promise<{ stream: StreamableFile; nombreOriginal: string; mimeType: string }> {
    const doc = await this.obtenerPorId(id);

    if (!doc.Activo) {
      throw new NotFoundException('El documento no se encuentra disponible.');
    }

    // Control de acceso a documentos privados
    if (doc.EsPrivado) {
      const esAdmin =
        usuario?.role?.toLowerCase() === 'admin' ||
        usuario?.roles?.some((r) =>
          ['admin', 'superadmin'].includes(String(r).toLowerCase()),
        );

      const puedeVerPrivado =
        esAdmin ||
        (Array.isArray(usuario?.roles) &&
          usuario.roles.some((r) =>
            ['admin', 'superadmin', 'vendedor'].includes(String(r).toLowerCase()),
          ));

      if (!puedeVerPrivado) {
        throw new ForbiddenException(
          'Este documento es privado. Para acceder a él, envíe una solicitud de archivo.',
        );
      }
    }

    // Incrementar contador y registrar auditoría
    await this.registrarDescarga(doc.Id, usuario, ip);

    const ruta = this.obtenerRutaSegura(doc.NombreArchivo);
    const stream = createReadStream(ruta);
    return {
      stream: new StreamableFile(stream),
      nombreOriginal: doc.NombreOriginal || doc.NombreArchivo,
      mimeType: doc.MimeType || 'application/octet-stream',
    };
  }

  /**
   * Descarga mediante token temporal de solicitud aprobada
   */
  async descargarPorToken(
    token: string,
    ip?: string,
  ): Promise<{ stream: StreamableFile; nombreOriginal: string; mimeType: string }> {
    const solicitud = await this.solicitudRepo.findOne({
      where: { TokenDescarga: token, Estado: 'Aprobada' },
    });

    if (!solicitud) {
      throw new NotFoundException('Enlace de descarga no válido o no encontrado.');
    }

    if (solicitud.TokenExpira && new Date() > new Date(solicitud.TokenExpira)) {
      throw new ForbiddenException(
        'El enlace de descarga ha expirado. Por favor solicite uno nuevo.',
      );
    }

    if (!solicitud.DocumentoId) {
      throw new NotFoundException('Esta solicitud no tiene un documento asociado para descargar.');
    }

    const doc = await this.obtenerPorId(solicitud.DocumentoId);
    await this.registrarDescarga(
      doc.Id,
      { name: solicitud.NombreSolicitante, username: solicitud.CorreoSolicitante },
      ip,
    );

    const ruta = this.obtenerRutaSegura(doc.NombreArchivo);
    const stream = createReadStream(ruta);
    return {
      stream: new StreamableFile(stream),
      nombreOriginal: doc.NombreOriginal || doc.NombreArchivo,
      mimeType: doc.MimeType || 'application/octet-stream',
    };
  }

  /**
   * Registra una solicitud de acceso o propuesta de archivo enviada por un usuario (REP-P03-T2)
   */
  async solicitarAcceso(
    data: {
      documentoId?: string;
      documentoTitulo?: string;
      nombre: string;
      correo: string;
      institucion?: string;
      motivo?: string;
      categoria?: string;
    },
    file?: Express.Multer.File,
  ): Promise<SolicitudDocumento> {
    let doc: Documento | null = null;
    if (data.documentoId && data.documentoId !== '0' && data.documentoId !== 'general') {
      try {
        doc = await this.obtenerPorId(data.documentoId);
      } catch {
        doc = null;
      }
    }

    const nombre = String(data.nombre || '').trim();
    const correo = String(data.correo || '').trim().toLowerCase();
    const motivo = String(data.motivo || '').trim();

    if (!nombre) {
      throw new BadRequestException('El nombre del solicitante es requerido.');
    }
    if (!correo || !correo.includes('@')) {
      throw new BadRequestException('Ingrese un correo electrónico válido.');
    }
    if (!motivo && !file) {
      throw new BadRequestException('Indique el motivo o descripción del archivo.');
    }

    const docTitulo =
      String(data.documentoTitulo || '').trim() ||
      doc?.Titulo ||
      file?.originalname ||
      'Aporte de documentación';

    const categoria = String(data.categoria || '').trim() || (doc ? doc.Categoria : 'Investigaciones');

    const solicitud = this.solicitudRepo.create({
      DocumentoId: doc ? doc.Id : null,
      DocumentoTitulo: docTitulo,
      NombreSolicitante: nombre,
      CorreoSolicitante: correo,
      Institucion: String(data.institucion || '').trim(),
      Motivo: motivo || 'Archivo aportado por usuario.',
      Categoria: categoria,
      NombreArchivo: file ? file.filename : null,
      NombreOriginal: file ? file.originalname : null,
      MimeType: file ? (file.mimetype || 'application/octet-stream') : null,
      TamanoBytes: file ? (file.size || 0) : 0,
      Estado: 'Pendiente',
    });

    return this.solicitudRepo.save(solicitud);
  }

  /**
   * Descarga el archivo que adjuntó el usuario en su solicitud
   */
  async descargarArchivoSolicitud(
    id: string,
  ): Promise<{ stream: StreamableFile; nombreOriginal: string; mimeType: string }> {
    const sol = await this.solicitudRepo.findOne({ where: { Id: id } });
    if (!sol || !sol.NombreArchivo) {
      throw new NotFoundException('Esta solicitud no cuenta con un archivo adjunto.');
    }
    const ruta = this.obtenerRutaSegura(sol.NombreArchivo);
    const stream = createReadStream(ruta);
    return {
      stream: new StreamableFile(stream),
      nombreOriginal: sol.NombreOriginal || sol.NombreArchivo,
      mimeType: sol.MimeType || 'application/octet-stream',
    };
  }

  /**
   * Lista solicitudes para el panel de administración
   */
  async listarSolicitudes(estado?: string): Promise<SolicitudDocumento[]> {
    const where: any = {};
    if (estado && estado !== 'todos') {
      where.Estado = estado;
    }
    return this.solicitudRepo.find({
      where: Object.keys(where).length ? where : undefined,
      order: { CreatedAt: 'DESC' },
    });
  }

  /**
   * Resuelve una solicitud: Aprobar o Rechazar
   * Si la solicitud incluye un archivo adjunto enviado por el usuario,
   * al aprobarse se publica automáticamente como documento en el repositorio.
   */
  async atenderSolicitud(
    id: string,
    data: {
      estado: 'Aprobada' | 'Rechazada';
      respuestaAdmin?: string;
      atendidoPor?: string;
    },
  ): Promise<SolicitudDocumento> {
    const sol = await this.solicitudRepo.findOne({ where: { Id: id } });
    if (!sol) {
      throw new NotFoundException('Solicitud no encontrada.');
    }

    sol.Estado = data.estado;
    sol.RespuestaAdmin = String(data.respuestaAdmin || '').trim();
    sol.AtendidoPor = String(data.atendidoPor || '').trim();

    if (data.estado === 'Aprobada') {
      sol.TokenDescarga = randomUUID();
      // Token válido por 48 horas
      sol.TokenExpira = new Date(Date.now() + 48 * 60 * 60 * 1000);

      // Si el usuario envió un archivo y no ha sido publicado aún, publicarlo en el catálogo
      if (sol.NombreArchivo && !sol.PublicadoDocumentoId) {
        const cat = sol.Categoria || 'Investigaciones';
        await this.categoriasService.asegurar(cat, TIPO_CATEGORIA_DOCUMENTO, '');

        const nuevoDoc = this.docRepo.create({
          Titulo: sol.DocumentoTitulo || sol.NombreOriginal || 'Aporte de la comunidad',
          Descripcion: sol.Motivo || 'Documento aportado a través del portal de solicitudes.',
          Categoria: cat,
          Subcategoria: '',
          NombreArchivo: sol.NombreArchivo,
          NombreOriginal: sol.NombreOriginal || sol.NombreArchivo,
          MimeType: sol.MimeType || 'application/octet-stream',
          TamanoBytes: Number(sol.TamanoBytes) || 0,
          EsPrivado: false,
          Autor: sol.NombreSolicitante + (sol.Institucion ? ` (${sol.Institucion})` : ''),
          Version: '1.0',
          PalabrasClave: '',
          DescargasCount: 0,
          Activo: true,
        });

        const guardadoDoc = await this.docRepo.save(nuevoDoc);
        sol.PublicadoDocumentoId = guardadoDoc.Id;
      }
    } else {
      sol.TokenDescarga = null;
      sol.TokenExpira = null;
    }

    const guardado = await this.solicitudRepo.save(sol);

    // Intentar enviar notificación si está disponible
    try {
      if (data.estado === 'Aprobada') {
        this.logger.log(
          `Solicitud ${id} aprobada para ${sol.CorreoSolicitante}. Token: ${sol.TokenDescarga}`,
        );
      }
    } catch (err) {
      this.logger.warn(`No se pudo enviar correo de notificación: ${err}`);
    }

    return guardado;
  }

  /**
   * Obtiene estadísticas y registro de descargas (REP-P02-T3)
   */
  async obtenerEstadisticas() {
    const totalDocs = await this.docRepo.count();
    const publicos = await this.docRepo.count({ where: { EsPrivado: false, Activo: true } });
    const privados = await this.docRepo.count({ where: { EsPrivado: true, Activo: true } });
    const inactivos = await this.docRepo.count({ where: { Activo: false } });

    const totalDescargasRes = await this.docRepo
      .createQueryBuilder('doc')
      .select('SUM(doc.DescargasCount)', 'total')
      .getRawOne();
    const totalDescargas = Number(totalDescargasRes?.total || 0);

    const pendientesSolicitudes = await this.solicitudRepo.count({
      where: { Estado: 'Pendiente' },
    });

    const ultimasDescargas = await this.descargaRepo.find({
      order: { FechaDescarga: 'DESC' },
      take: 20,
    });

    // Mapear con títulos de documentos
    const docIds = Array.from(new Set(ultimasDescargas.map((d) => d.DocumentoId)));
    const docs = docIds.length
      ? await this.docRepo.findByIds(docIds)
      : [];
    const docMap = new Map(docs.map((d) => [d.Id, d.Titulo]));

    const descargasConTitulo = ultimasDescargas.map((d) => ({
      id: d.Id,
      documentoId: d.DocumentoId,
      documentoTitulo: docMap.get(d.DocumentoId) || 'Documento sin título',
      usuarioNombre: d.UsuarioNombre || 'Visitante',
      ip: d.Ip || 'Desconocida',
      fechaDescarga: d.FechaDescarga,
    }));

    return {
      metricas: {
        totalDocs,
        publicos,
        privados,
        inactivos,
        totalDescargas,
        pendientesSolicitudes,
      },
      ultimasDescargas: descargasConTitulo,
    };
  }

  /**
   * Exporta catálogo a CSV para REP-P04
   */
  async exportarCatalogoCsv(): Promise<string> {
    const docs = await this.docRepo.find({
      order: { Categoria: 'ASC', Titulo: 'ASC' },
    });

    const encabezados = [
      'ID',
      'Título',
      'Categoría',
      'Subcategoría',
      'Autor',
      'Versión',
      'Visibilidad',
      'Estado',
      'Tamaño (KB)',
      'Descargas',
      'Nombre de Archivo Original',
      'Fecha Creación',
    ];

    const escapeCsv = (str: any) => {
      const val = str == null ? '' : String(str).replace(/"/g, '""');
      return `"${val}"`;
    };

    const filas = docs.map((d) => [
      d.Id,
      escapeCsv(d.Titulo),
      escapeCsv(d.Categoria),
      escapeCsv(d.Subcategoria),
      escapeCsv(d.Autor),
      escapeCsv(d.Version),
      d.EsPrivado ? 'Privado' : 'Público',
      d.Activo ? 'Activo' : 'Inactivo',
      Math.round(Number(d.TamanoBytes || 0) / 1024),
      d.DescargasCount,
      escapeCsv(d.NombreOriginal),
      d.CreatedAt ? new Date(d.CreatedAt).toISOString().split('T')[0] : '',
    ]);

    const lineas = [
      encabezados.join(','),
      ...filas.map((f) => f.join(',')),
    ];

    // UTF-8 BOM para que Excel abra acentos correctamente
    return '\uFEFF' + lineas.join('\r\n');
  }

  // --- MÉTODOS AUXILIARES ---

  private async registrarDescarga(
    documentoId: string,
    usuario?: { id?: string; name?: string; username?: string },
    ip?: string,
  ): Promise<void> {
    try {
      await this.docRepo.increment({ Id: documentoId }, 'DescargasCount', 1);
      const reg = this.descargaRepo.create({
        DocumentoId: documentoId,
        UsuarioId: usuario?.id ? String(usuario.id) : null,
        UsuarioNombre: usuario?.name || usuario?.username || null,
        Ip: ip || null,
      });
      await this.descargaRepo.save(reg);
    } catch (err) {
      this.logger.error(`Error al registrar descarga de documento ${documentoId}: ${err}`);
    }
  }

  private obtenerRutaSegura(nombreArchivo: string): string {
    const root = resolve(DOCUMENTOS_DIR);
    const absolute = resolve(root, nombreArchivo);
    const rel = relative(root, absolute);

    if (!rel || rel.startsWith('..') || rel.includes(`..${sep}`)) {
      throw new BadRequestException('Ruta de archivo no válida.');
    }

    if (!existsSync(absolute)) {
      throw new NotFoundException('El archivo físico no existe en el servidor.');
    }

    return absolute;
  }

  private eliminarArchivoFisico(nombreArchivo: string): void {
    try {
      if (!nombreArchivo) return;
      const ruta = resolve(DOCUMENTOS_DIR, nombreArchivo);
      if (existsSync(ruta)) {
        unlinkSync(ruta);
      }
    } catch (err) {
      this.logger.warn(`No se pudo borrar archivo físico ${nombreArchivo}: ${err}`);
    }
  }
}
