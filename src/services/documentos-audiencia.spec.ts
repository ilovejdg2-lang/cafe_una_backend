import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { DocumentosService } from './documentos.service';

function crearServicio(
  opciones: {
    adminNombres?: string[];
    doc?: Record<string, unknown>;
    categoriasListadas?: unknown[];
  } = {},
) {
  const admin = new Set(
    (opciones.adminNombres ?? []).map((n) => n.toLowerCase()),
  );
  const esAdmin = (cat?: string, sub?: string) =>
    admin.has(String(cat || '').toLowerCase()) ||
    admin.has(String(sub || '').toLowerCase());
  const qb: Record<string, jest.Mock> = {};
  for (const m of ['where', 'andWhere', 'orderBy', 'select', 'addSelect', 'groupBy']) {
    qb[m] = jest.fn().mockReturnValue(qb);
  }
  qb.getMany = jest.fn().mockResolvedValue([]);
  qb.getRawMany = jest.fn().mockResolvedValue([]);
  const docRepo = {
    create: jest.fn((datos: Record<string, unknown>) => datos),
    save: jest.fn((doc: Record<string, unknown>) =>
      Promise.resolve({ ...doc, Id: '30' }),
    ),
    findOne: jest.fn().mockResolvedValue(opciones.doc ?? null),
    createQueryBuilder: jest.fn().mockReturnValue(qb),
    increment: jest.fn(),
  };
  const solicitudRepo = {
    create: jest.fn((d: Record<string, unknown>) => d),
    findOne: jest.fn(),
    save: jest.fn((d: Record<string, unknown>) => Promise.resolve(d)),
  };
  const categorias = {
    asegurar: jest.fn().mockResolvedValue(undefined),
    esAdministrativa: jest.fn((c?: string, s?: string) =>
      Promise.resolve(esAdmin(c, s)),
    ),
    crearDetectorAdministrativo: jest.fn().mockResolvedValue(esAdmin),
    listar: jest.fn().mockResolvedValue(opciones.categoriasListadas ?? []),
  };
  const email = new Proxy({}, { get: () => jest.fn().mockResolvedValue(true) });
  const supabase = { estaHabilitado: () => false };
  const servicio = new (DocumentosService as unknown as new (
    ...args: unknown[]
  ) => DocumentosService)(
    docRepo,
    {},
    solicitudRepo,
    categorias,
    email,
    supabase,
    { get: () => 'https://sitio.test' },
  );
  return { servicio, docRepo, solicitudRepo, categorias, qb };
}

const archivo = {
  filename: 'f.pdf',
  originalname: 'f.pdf',
  mimetype: 'application/pdf',
  size: 10,
} as Express.Multer.File;

describe('DocumentosService audiencia de categorías', () => {
  it('fuerza privado un documento nuevo en categoría administrativa', async () => {
    const { servicio, docRepo, categorias } = crearServicio({
      adminNombres: ['MINUTAS'],
    });
    await servicio.crear(archivo, {
      titulo: 'Acta',
      categoria: 'MINUTAS',
      esPrivado: 'false',
    });
    expect(docRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ EsPrivado: true }),
    );
    expect(categorias.asegurar).toHaveBeenCalledWith(
      'MINUTAS',
      'documento_admin',
      '',
    );
  });

  it('respeta esPrivado=false en una categoría pública', async () => {
    const { servicio, docRepo, categorias } = crearServicio();
    await servicio.crear(archivo, {
      titulo: 'Tesis',
      categoria: 'Tesis',
      esPrivado: 'false',
    });
    expect(docRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ EsPrivado: false }),
    );
    expect(categorias.asegurar).toHaveBeenCalledWith('Tesis', 'documento', '');
  });

  it('actualizar: mover a categoría administrativa lo deja privado', async () => {
    const doc = {
      Id: '5',
      Titulo: 'x',
      Categoria: 'Tesis',
      Subcategoria: '',
      EsPrivado: false,
    };
    const { servicio, docRepo } = crearServicio({
      adminNombres: ['Documento Vision'],
      doc,
    });
    await servicio.actualizar('5', {
      categoria: 'Documento Vision',
      esPrivado: 'false',
    });
    expect(docRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        Categoria: 'Documento Vision',
        EsPrivado: true,
      }),
    );
  });

  it('actualizar: no permite publicar un documento que ya es administrativo', async () => {
    const doc = {
      Id: '6',
      Titulo: 'x',
      Categoria: 'MINUTAS',
      Subcategoria: '',
      EsPrivado: true,
    };
    const { servicio, docRepo } = crearServicio({
      adminNombres: ['MINUTAS'],
      doc,
    });
    await servicio.actualizar('6', { esPrivado: 'false' });
    expect(docRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ EsPrivado: true }),
    );
  });

  it('listarPublicos excluye documentos de categorías administrativas', async () => {
    const { servicio, qb } = crearServicio();
    await servicio.listarPublicos({});
    expect(qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('NOT EXISTS'),
      { tipoAdmin: 'documento_admin' },
    );
  });

  it('listarCategorias solo consulta las categorías públicas', async () => {
    const { servicio, categorias } = crearServicio({
      categoriasListadas: [{ Nombre: 'Tesis', Tipo: 'documento' }],
    });
    await servicio.listarCategorias();
    expect(categorias.listar).toHaveBeenCalledWith('documento');
    expect(categorias.listar).not.toHaveBeenCalledWith('documento_admin');
  });

  it('listarCategoriasAdmin devuelve ambas audiencias', async () => {
    const { servicio, categorias } = crearServicio();
    categorias.listar
      .mockResolvedValueOnce([
        { Nombre: 'Tesis', Tipo: 'documento', audiencia: 'publica' },
      ])
      .mockResolvedValueOnce([
        {
          Nombre: 'MINUTAS',
          Tipo: 'documento_admin',
          audiencia: 'administrativa',
        },
      ]);
    const lista = await servicio.listarCategoriasAdmin();
    expect(categorias.listar).toHaveBeenCalledWith('documento', undefined, true);
    expect(categorias.listar).toHaveBeenCalledWith(
      'documento_admin',
      undefined,
      true,
    );
    expect(lista.map((c) => (c as { audiencia?: string }).audiencia)).toEqual([
      'publica',
      'administrativa',
    ]);
  });

  it('listarAdmin expone la audiencia de cada documento', async () => {
    const { servicio, qb } = crearServicio({ adminNombres: ['MINUTAS'] });
    qb.getMany.mockResolvedValue([
      { Id: '1', Categoria: 'MINUTAS', Subcategoria: '', TamanoBytes: 0 },
      { Id: '2', Categoria: 'Tesis', Subcategoria: '', TamanoBytes: 0 },
    ]);
    const filas = await servicio.listarAdmin({});
    expect(filas.map((f) => f.audiencia)).toEqual([
      'administrativa',
      'publica',
    ]);
  });

  it('solicitar: rechaza un aporte en categoría administrativa', async () => {
    const { servicio, solicitudRepo } = crearServicio({
      adminNombres: ['MINUTAS'],
    });
    await expect(
      servicio.solicitarAcceso(
        { nombre: 'Ana', correo: 'a@b.com', motivo: 'm', categoria: 'MINUTAS' },
        archivo,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(solicitudRepo.save).not.toHaveBeenCalled();
  });

  it('solicitar: sin categoría mantiene Investigaciones', async () => {
    const { servicio, solicitudRepo } = crearServicio();
    await servicio.solicitarAcceso(
      { nombre: 'Ana', correo: 'a@b.com', motivo: 'm' },
      archivo,
    );
    expect(solicitudRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ Categoria: 'Investigaciones' }),
    );
  });

  it('solicitar: pedir acceso a un documento existente no exige categoría pública', async () => {
    const { servicio, solicitudRepo } = crearServicio({
      adminNombres: ['MINUTAS'],
      doc: {
        Id: '9',
        Titulo: 'Acta',
        Categoria: 'MINUTAS',
        Subcategoria: '',
        Autor: 'x',
      },
    });
    await servicio.solicitarAcceso({
      documentoId: '9',
      nombre: 'Ana',
      correo: 'a@b.com',
      motivo: 'm',
    });
    expect(solicitudRepo.save).toHaveBeenCalled();
  });

  it('atenderSolicitud: un aporte en categoría administrativa se publica privado', async () => {
    const { servicio, docRepo, solicitudRepo, categorias } = crearServicio({
      adminNombres: ['MINUTAS'],
    });
    solicitudRepo.findOne.mockResolvedValue({
      Id: '3',
      NombreArchivo: 'p.pdf',
      Categoria: 'MINUTAS',
      NombreSolicitante: 'Ana',
      CorreoSolicitante: 'a@b.com',
    });
    await servicio.atenderSolicitud('3', { estado: 'Aprobada' });
    expect(docRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ EsPrivado: true }),
    );
    expect(categorias.asegurar).toHaveBeenCalledWith(
      'MINUTAS',
      'documento_admin',
      '',
    );
  });

  it('descargar: un documento administrativo con bandera pública sigue protegido', async () => {
    const { servicio } = crearServicio({
      adminNombres: ['MINUTAS'],
      doc: {
        Id: '8',
        Activo: true,
        EsPrivado: false,
        Categoria: 'MINUTAS',
        Subcategoria: '',
      },
    });
    await expect(
      servicio.descargar('8', undefined, '1.1.1.1'),
    ).rejects.toThrow(ForbiddenException);
  });
});
