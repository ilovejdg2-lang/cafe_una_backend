import { NotFoundException } from '@nestjs/common';
import { DocumentosService } from './documentos.service';

function crearServicio(solicitud: Record<string, unknown>) {
  const docRepo = {
    create: jest.fn((datos: Record<string, unknown>) => datos),
    save: jest.fn((doc: Record<string, unknown>) =>
      Promise.resolve({ ...doc, Id: '20' }),
    ),
  };
  const qb: Record<string, jest.Mock> = {};
  for (const m of ['where', 'orWhere', 'orderBy']) {
    qb[m] = jest.fn().mockReturnValue(qb);
  }
  qb.getMany = jest.fn().mockResolvedValue([]);
  const solicitudRepo = {
    findOne: jest.fn().mockResolvedValue(solicitud),
    save: jest.fn((sol: Record<string, unknown>) => Promise.resolve(sol)),
    create: jest.fn((datos: Record<string, unknown>) => datos),
    createQueryBuilder: jest.fn().mockReturnValue(qb),
  };
  const categorias = {
    asegurar: jest.fn().mockResolvedValue(undefined),
    esAdministrativa: jest.fn().mockResolvedValue(false),
  };
  const email = new Proxy(
    {},
    { get: () => jest.fn().mockResolvedValue(true) },
  );
  const servicio = new (DocumentosService as unknown as new (
    ...args: unknown[]
  ) => DocumentosService)(docRepo, {}, solicitudRepo, categorias, email, {}, {
    get: () => 'https://sitio.test',
  });
  return { servicio, docRepo, solicitudRepo, qb };
}

describe('DocumentosService.atenderSolicitud', () => {
  it('publica en el catálogo público el aporte aprobado', async () => {
    const { servicio, docRepo } = crearServicio({
      Id: '14',
      NombreArchivo: 'propuesta.pdf',
      NombreSolicitante: 'Persona',
      CorreoSolicitante: 'a@b.com',
      PublicadoDocumentoId: null,
    });

    await servicio.atenderSolicitud('14', { estado: 'Aprobada' });

    expect(docRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ EsPrivado: false, Activo: true }),
    );
  });

  it('mantiene privado el adjunto de una solicitud de acceso', async () => {
    const { servicio, docRepo } = crearServicio({
      Id: '16',
      DocumentoId: '7',
      NombreArchivo: 'adjunto.pdf',
      NombreSolicitante: 'Persona',
      CorreoSolicitante: 'a@b.com',
      PublicadoDocumentoId: null,
    });

    await servicio.atenderSolicitud('16', { estado: 'Aprobada' });

    expect(docRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ EsPrivado: true }),
    );
  });

  it('no publica nada al rechazar', async () => {
    const { servicio, docRepo } = crearServicio({
      Id: '15',
      NombreArchivo: 'propuesta.pdf',
      NombreSolicitante: 'Persona',
      CorreoSolicitante: 'a@b.com',
    });

    await servicio.atenderSolicitud('15', { estado: 'Rechazada' });

    expect(docRepo.create).not.toHaveBeenCalled();
  });
});

describe('DocumentosService.listarPropias / obtenerPropia', () => {
  it('lista por UsuarioId y correo legado', async () => {
    const { servicio, qb } = crearServicio({});
    qb.getMany.mockResolvedValue([{ Id: '1' }, { Id: '2' }]);

    const filas = await servicio.listarPropias(22, 'ana@una.cr');

    expect(qb.where).toHaveBeenCalledWith('s.UsuarioId = :usuarioId', {
      usuarioId: 22,
    });
    expect(qb.orWhere).toHaveBeenCalledWith(
      '(s.UsuarioId IS NULL AND LOWER(s.CorreoSolicitante) = :correo)',
      { correo: 'ana@una.cr' },
    );
    expect(filas).toHaveLength(2);
  });

  it('obtenerPropia acepta fila ligada por UsuarioId', async () => {
    const { servicio, solicitudRepo } = crearServicio({
      Id: '9',
      UsuarioId: 22,
      CorreoSolicitante: 'otra@una.cr',
    });

    const fila = await servicio.obtenerPropia(22, '9', 'ana@una.cr');
    expect(fila.Id).toBe('9');
    expect(solicitudRepo.findOne).toHaveBeenCalledWith({ where: { Id: '9' } });
  });

  it('obtenerPropia acepta fila legada por correo', async () => {
    const { servicio } = crearServicio({
      Id: '8',
      UsuarioId: null,
      CorreoSolicitante: 'ana@una.cr',
    });

    const fila = await servicio.obtenerPropia(22, '8', 'ana@una.cr');
    expect(fila.Id).toBe('8');
  });

  it('obtenerPropia rechaza filas de otra persona', async () => {
    const { servicio } = crearServicio({
      Id: '7',
      UsuarioId: 99,
      CorreoSolicitante: 'otra@una.cr',
    });

    await expect(
      servicio.obtenerPropia(22, '7', 'ana@una.cr'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('DocumentosService.solicitarAcceso con UsuarioId', () => {
  it('guarda UsuarioId cuando viene en la solicitud', async () => {
    const { servicio, solicitudRepo } = crearServicio({});
    solicitudRepo.create = jest.fn((datos: Record<string, unknown>) => datos);
    solicitudRepo.save = jest.fn((d: Record<string, unknown>) =>
      Promise.resolve(d),
    );

    await servicio.solicitarAcceso({
      nombre: 'Ana',
      correo: 'ana@una.cr',
      motivo: 'Necesito el PDF',
      usuarioId: 22,
    });

    expect(solicitudRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ UsuarioId: 22 }),
    );
  });
});
