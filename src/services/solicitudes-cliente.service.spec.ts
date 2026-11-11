import { SolicitudesClienteService } from './solicitudes-cliente.service';

describe('SolicitudesClienteService historial unificado', () => {
  const donaciones = { listarPropias: jest.fn() };
  const voluntariado = {
    obtenerSolicitudesDeUsuario: jest.fn(),
    obtenerPorId: jest.fn(),
  };
  const visitas = {
    obtenerSolicitudesDeUsuario: jest.fn(),
    obtenerPorId: jest.fn(),
  };
  const documentos = {
    listarPropias: jest.fn(),
    obtenerPropia: jest.fn(),
  };
  const propuestas = {
    listarMias: jest.fn(),
    obtenerMia: jest.fn(),
  };
  const usuarios = { obtenerPorId: jest.fn() };

  let service: SolicitudesClienteService;

  beforeEach(() => {
    jest.clearAllMocks();
    donaciones.listarPropias.mockResolvedValue([]);
    voluntariado.obtenerSolicitudesDeUsuario.mockResolvedValue([]);
    visitas.obtenerSolicitudesDeUsuario.mockResolvedValue([]);
    documentos.listarPropias.mockResolvedValue([]);
    propuestas.listarMias.mockResolvedValue([]);
    usuarios.obtenerPorId.mockResolvedValue({
      Id: 22,
      Correo: 'ana@una.cr',
    });
    service = new SolicitudesClienteService(
      donaciones as never,
      voluntariado as never,
      visitas as never,
      documentos as never,
      propuestas as never,
      usuarios as never,
    );
  });

  it('incluye documentación (por id/correo) y propuesta en el listado', async () => {
    documentos.listarPropias.mockResolvedValue([
      {
        Id: '9',
        DocumentoTitulo: 'Guía de poda',
        Estado: 'Pendiente',
        CreatedAt: '2026-11-01T10:00:00.000Z',
      },
    ]);
    propuestas.listarMias.mockResolvedValue([
      {
        id: '44',
        nombre: 'Café El Mirador',
        estado: 'Pendiente',
        fechaEnvio: '2026-11-02T12:00:00.000Z',
      },
    ]);

    const result = await service.listarPropias(22);

    expect(usuarios.obtenerPorId).toHaveBeenCalledWith(22);
    expect(documentos.listarPropias).toHaveBeenCalledWith(22, 'ana@una.cr');
    expect(propuestas.listarMias).toHaveBeenCalledWith(22);
    expect(result.total).toBe(2);
    expect(result.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tipo: 'documentacion',
          tipoEtiqueta: 'Documentación',
          identificador: '9',
          titulo: 'Guía de poda',
        }),
        expect.objectContaining({
          tipo: 'propuesta',
          tipoEtiqueta: 'Propuesta',
          identificador: '44',
          titulo: 'Café El Mirador',
        }),
      ]),
    );
  });

  it('sigue listando el resto si un origen falla', async () => {
    visitas.obtenerSolicitudesDeUsuario.mockRejectedValue(
      new Error('column DisponibilidadVisitaId does not exist'),
    );
    donaciones.listarPropias.mockResolvedValue([
      {
        id: 3,
        estado: 'Pendiente',
        createdAt: '2026-11-03T08:00:00.000Z',
        necesidadTitulo: 'Café verde',
      },
    ]);

    const result = await service.listarPropias(22);

    expect(result.total).toBe(1);
    expect(result.data[0]).toEqual(
      expect.objectContaining({ tipo: 'donacion', identificador: '3' }),
    );
  });

  it('filtra solo propuestas cuando tipo=propuesta', async () => {
    propuestas.listarMias.mockResolvedValue([
      {
        id: '44',
        nombre: 'Café El Mirador',
        estado: 'Pendiente',
        fechaEnvio: '2026-11-02T12:00:00.000Z',
      },
    ]);

    const result = await service.listarPropias(22, { tipo: 'propuesta' });

    expect(documentos.listarPropias).not.toHaveBeenCalled();
    expect(donaciones.listarPropias).not.toHaveBeenCalled();
    expect(result.data).toHaveLength(1);
    expect(result.data[0].tipo).toBe('propuesta');
  });

  it('detalle de documentación propia', async () => {
    documentos.obtenerPropia.mockResolvedValue({
      Id: '9',
      DocumentoTitulo: 'Guía de poda',
      Estado: 'Pendiente',
      CreatedAt: '2026-11-01T10:00:00.000Z',
      NombreSolicitante: 'Ana',
      CorreoSolicitante: 'ana@una.cr',
      Motivo: 'Aporte',
      Categoria: 'Investigaciones',
    });

    const result = await service.obtenerPropia(22, 'documentacion', '9');

    expect(documentos.obtenerPropia).toHaveBeenCalledWith(
      22,
      '9',
      'ana@una.cr',
    );
    expect(result.resumen.tipo).toBe('documentacion');
    expect(result.detalle.titulo).toBe('Guía de poda');
  });

  it('detalle de propuesta propia', async () => {
    propuestas.obtenerMia.mockResolvedValue({
      id: '44',
      nombre: 'Café El Mirador',
      estado: 'Pendiente',
      fechaEnvio: '2026-11-02T12:00:00.000Z',
      provincia: 'Heredia',
    });

    const result = await service.obtenerPropia(22, 'propuesta', '44');

    expect(propuestas.obtenerMia).toHaveBeenCalledWith(22, '44');
    expect(result.resumen.tipo).toBe('propuesta');
    expect(result.detalle.nombre).toBe('Café El Mirador');
  });
});
