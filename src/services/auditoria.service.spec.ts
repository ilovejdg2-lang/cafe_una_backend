import { AuditoriaService } from './auditoria.service';

describe('AuditoriaService filtros', () => {
  const qb = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
  };
  const repo = {
    createQueryBuilder: jest.fn(() => qb),
  };

  let service: AuditoriaService;

  beforeEach(() => {
    jest.clearAllMocks();
    qb.leftJoinAndSelect.mockReturnThis();
    qb.orderBy.mockReturnThis();
    qb.andWhere.mockReturnThis();
    qb.take.mockReturnThis();
    qb.getMany.mockResolvedValue([]);
    service = new AuditoriaService(repo as never);
  });

  it('lists without filters', async () => {
    await service.obtenerTodas();
    expect(repo.createQueryBuilder).toHaveBeenCalledWith('auditoria');
    expect(qb.take).toHaveBeenCalledWith(500);
  });

  it('filters by usuario id, accion, modulo and date range', async () => {
    await service.obtenerTodas({
      usuario: '7',
      accion: 'UPDATE',
      modulo: 'producto',
      desde: '2026-01-01',
      hasta: '2026-01-31',
    });

    expect(qb.andWhere).toHaveBeenCalledWith('auditoria.IdUsuario = :usuarioId', {
      usuarioId: 7,
    });
    expect(qb.andWhere).toHaveBeenCalledWith('auditoria.Accion ILIKE :accion', {
      accion: 'UPDATE',
    });
    expect(qb.andWhere).toHaveBeenCalledWith('auditoria.Tabla IN (:...tablas)', {
      tablas: ['productos', 'categorias'],
    });
    expect(qb.andWhere).toHaveBeenCalledWith('auditoria.Fecha >= :desde', {
      desde: '2026-01-01T00:00:00.000Z',
    });
    expect(qb.andWhere).toHaveBeenCalledWith('auditoria.Fecha <= :hasta', {
      hasta: '2026-01-31T23:59:59.999Z',
    });
  });
});
