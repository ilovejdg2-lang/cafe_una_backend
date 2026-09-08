import { NecesidadesService } from './necesidades.service';
import { PRIORIDADES_NECESIDAD } from '../entities/donacion-necesidad.entity';

describe('NecesidadesService', () => {
  const repo = {
    listarActivas: jest.fn(),
    listarTodas: jest.fn(),
    crear: jest.fn(),
    actualizar: jest.fn(),
    inactivar: jest.fn(),
  };

  let service: NecesidadesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NecesidadesService(repo as never);
  });

  it('rejects a priority outside ALTA, MEDIA or BAJA', async () => {
    await expect(
      service.crear({
        titulo: 'Herramientas',
        descripcion: 'Para el cafetal',
        prioridad: 'URGENTE',
      }),
    ).rejects.toThrow('La prioridad debe ser ALTA, MEDIA o BAJA.');
    expect(repo.crear).not.toHaveBeenCalled();
    expect(PRIORIDADES_NECESIDAD).toEqual(['ALTA', 'MEDIA', 'BAJA']);
  });

  it('creates a need with a valid priority', async () => {
    repo.crear.mockResolvedValue({
      Id: 1,
      Uuid: 'u1',
      Titulo: 'Herramientas',
      Descripcion: 'Para el cafetal',
      Prioridad: 'ALTA',
      CantidadRequerida: 12,
      Estado: 'ACTIVA',
      CreatedAt: new Date(),
      UpdatedAt: new Date(),
      DeletedAt: null,
    });
    const created = await service.crear({
      titulo: 'Herramientas',
      descripcion: 'Para el cafetal',
      prioridad: 'alta',
      cantidadRequerida: 12,
    });
    expect(created.prioridad).toBe('ALTA');
    expect(repo.crear).toHaveBeenCalled();
  });
});
