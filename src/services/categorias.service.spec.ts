import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CategoriasService } from './categorias.service';

function crearQb(filas: unknown[] = []) {
  const qb: Record<string, jest.Mock> = {};
  for (const m of ['where', 'andWhere', 'orderBy', 'addOrderBy']) {
    qb[m] = jest.fn().mockReturnValue(qb);
  }
  qb.getMany = jest.fn().mockResolvedValue(filas);
  qb.getOne = jest.fn().mockResolvedValue(null);
  qb.getCount = jest.fn().mockResolvedValue(0);
  return qb;
}

function crearServicio(opciones: { filas?: unknown[]; admin?: unknown[] } = {}) {
  const qb = crearQb(opciones.filas);
  const repo = {
    createQueryBuilder: jest.fn().mockReturnValue(qb),
    find: jest.fn().mockResolvedValue(opciones.admin ?? []),
    create: jest.fn((d: Record<string, unknown>) => d),
    save: jest.fn((d: Record<string, unknown>) => Promise.resolve(d)),
  };
  const docsRepo = { createQueryBuilder: jest.fn().mockReturnValue(crearQb()) };
  const servicio = new (CategoriasService as unknown as new (
    ...args: unknown[]
  ) => CategoriasService)(repo, {}, {}, docsRepo);
  return { servicio, repo, qb };
}

describe('CategoriasService (audiencia de documentos)', () => {
  it('acepta documento_admin como tipo', () => {
    const { servicio } = crearServicio();
    expect(servicio.normalizarTipo('documento_admin')).toBe('documento_admin');
    expect(() => servicio.normalizarTipo('otro')).toThrow(BadRequestException);
  });

  it('el listado público sin tipo excluye las categorías administrativas', async () => {
    const { servicio, qb } = crearServicio();
    await servicio.listar();
    expect(qb.andWhere).toHaveBeenCalledWith('c.Tipo <> :tipoAdmin', {
      tipoAdmin: 'documento_admin',
    });
  });

  it('rechaza pedir el tipo administrativo desde el listado público', async () => {
    const { servicio } = crearServicio();
    await expect(servicio.listar('documento_admin')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('permite el tipo administrativo cuando se pide explícitamente', async () => {
    const { servicio, qb } = crearServicio({
      filas: [
        { Id: '1', Nombre: 'MINUTAS', Tipo: 'documento_admin', Padre: '', Icono: '' },
      ],
    });
    const lista = await servicio.listar('documento_admin', undefined, true);
    expect(qb.andWhere).toHaveBeenCalledWith('c.Tipo = :tipo', {
      tipo: 'documento_admin',
    });
    expect(lista[0]).toMatchObject({ Nombre: 'MINUTAS', audiencia: 'administrativa' });
  });

  it('marca las categorías de documento públicas con audiencia publica', async () => {
    const { servicio } = crearServicio({
      filas: [
        { Id: '2', Nombre: 'Tesis', Tipo: 'documento', Padre: '', Icono: '' },
      ],
    });
    const lista = await servicio.listar('documento');
    expect(lista[0]).toMatchObject({ audiencia: 'publica' });
  });

  describe('esAdministrativa', () => {
    const admin = [
      { Nombre: 'MINUTAS', Padre: '' },
      { Nombre: 'PRUEBA', Padre: 'MINUTAS' },
    ];

    it('detecta la categoría raíz sin importar mayúsculas', async () => {
      const { servicio } = crearServicio({ admin });
      expect(await servicio.esAdministrativa('minutas')).toBe(true);
    });

    it('detecta la subcategoría bajo un padre administrativo', async () => {
      const { servicio } = crearServicio({ admin });
      expect(await servicio.esAdministrativa('Otra', 'prueba')).toBe(false);
      expect(await servicio.esAdministrativa('MINUTAS', 'PRUEBA')).toBe(true);
    });

    it('no marca categorías públicas', async () => {
      const { servicio } = crearServicio({ admin });
      expect(await servicio.esAdministrativa('Tesis', 'Doctorales')).toBe(false);
    });
  });

  it('crea una categoría administrativa con su tipo', async () => {
    const { servicio, repo } = crearServicio();
    await servicio.crear('Actas', 'documento_admin');
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ Nombre: 'Actas', Tipo: 'documento_admin' }),
    );
  });

  it('crea una categoría administrativa al indicar audiencia administrativa', async () => {
    const { servicio, repo } = crearServicio();
    await servicio.crear('Actas', 'documento', '', 'administrativa');
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ Tipo: 'documento_admin' }),
    );
  });
});
