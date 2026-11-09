import { DocumentosService } from './documentos.service';

function crearServicio(solicitud: Record<string, unknown>) {
  const docRepo = {
    create: jest.fn((datos: Record<string, unknown>) => datos),
    save: jest.fn((doc: Record<string, unknown>) =>
      Promise.resolve({ ...doc, Id: '20' }),
    ),
  };
  const solicitudRepo = {
    findOne: jest.fn().mockResolvedValue(solicitud),
    save: jest.fn((sol: Record<string, unknown>) => Promise.resolve(sol)),
  };
  const categorias = { asegurar: jest.fn().mockResolvedValue(undefined) };
  const email = new Proxy(
    {},
    { get: () => jest.fn().mockResolvedValue(true) },
  );
  const servicio = new (DocumentosService as unknown as new (
    ...args: unknown[]
  ) => DocumentosService)(docRepo, {}, solicitudRepo, categorias, email, {}, {
    get: () => 'https://sitio.test',
  });
  return { servicio, docRepo };
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
