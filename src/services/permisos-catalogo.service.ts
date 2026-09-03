import { Injectable, Logger, OnModuleInit, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  construirMatrizDesdeSeed,
  PERMISOS_PROTEGIDOS_SUPERADMIN,
  PERMISOS_PUBLICOS_FIJOS,
  PERMISOS_SEED,
  ROLES_SISTEMA,
} from '../common/permisos-seed';
import { reemplazarMatrizPermisos } from '../common/permisos';
import { Permiso } from '../entities/permiso.entity';
import { Rol } from '../entities/rol.entity';
import { RolPermiso } from '../entities/rol-permiso.entity';

export type MatrizEditable = {
  roles: string[];
  permisos: { codigo: string; nombre: string }[];
  matriz: Record<string, string[]>;
};

@Injectable()
export class PermisosCatalogoService implements OnModuleInit {
  private readonly logger = new Logger(PermisosCatalogoService.name);

  constructor(
    @InjectRepository(Rol) private readonly rolesRepo: Repository<Rol>,
    @InjectRepository(Permiso)
    private readonly permisosRepo: Repository<Permiso>,
    @InjectRepository(RolPermiso)
    private readonly rolPermisoRepo: Repository<RolPermiso>,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.asegurarSeed();
      await this.recargarMatrizEnMemoria();
    } catch (error) {
      this.logger.warn(
        'No se pudo cargar la matriz de permisos desde BD; se usa semilla en memoria.',
      );
      reemplazarMatrizPermisos(construirMatrizDesdeSeed());
    }
  }

  async asegurarSeed(): Promise<void> {
    for (const nombre of ROLES_SISTEMA) {
      const existe = await this.rolesRepo.findOne({ where: { Nombre: nombre } });
      if (!existe) {
        await this.rolesRepo.save(this.rolesRepo.create({ Nombre: nombre, Activo: true }));
      }
    }

    for (const seed of PERMISOS_SEED) {
      const existe = await this.permisosRepo.findOne({
        where: { Codigo: seed.codigo },
      });
      if (!existe) {
        await this.permisosRepo.save(
          this.permisosRepo.create({
            Codigo: seed.codigo,
            Nombre: seed.nombre,
            Activo: true,
          }),
        );
      }
    }

    const count = await this.rolPermisoRepo.count();
    if (count > 0) return;

    const roles = await this.rolesRepo.find();
    const permisos = await this.permisosRepo.find();
    const rolPorNombre = new Map(roles.map((r) => [r.Nombre, r]));
    const permisoPorCodigo = new Map(permisos.map((p) => [p.Codigo, p]));

    const filas: RolPermiso[] = [];
    for (const seed of PERMISOS_SEED) {
      const permiso = permisoPorCodigo.get(seed.codigo);
      if (!permiso) continue;
      for (const nombreRol of seed.roles) {
        const rol = rolPorNombre.get(nombreRol);
        if (!rol) continue;
        filas.push(
          this.rolPermisoRepo.create({
            RolId: rol.Id,
            PermisoId: permiso.Id,
            Rol: rol,
            Permiso: permiso,
          }),
        );
      }
    }
    if (filas.length > 0) {
      await this.rolPermisoRepo.save(filas);
      this.logger.log(`Semilla rol_permiso: ${filas.length} filas.`);
    }
  }

  async recargarMatrizEnMemoria(): Promise<void> {
    const filas = await this.rolPermisoRepo.find({
      relations: ['Rol', 'Permiso'],
    });
    const matriz: Record<string, string[]> = {};

    for (const seed of PERMISOS_SEED) {
      matriz[seed.codigo] = [];
    }

    for (const fila of filas) {
      const codigo = fila.Permiso?.Codigo;
      const rol = fila.Rol?.Nombre;
      if (!codigo || !rol) continue;
      if (!matriz[codigo]) matriz[codigo] = [];
      if (!matriz[codigo].includes(rol)) matriz[codigo].push(rol);
    }

    for (const [codigo, roles] of Object.entries(PERMISOS_PUBLICOS_FIJOS)) {
      matriz[codigo] = [...roles];
    }

    reemplazarMatrizPermisos(matriz);
  }

  async obtenerMatrizEditable(): Promise<MatrizEditable> {
    const roles = await this.rolesRepo.find({
      where: { Activo: true },
      order: { Id: 'ASC' },
    });
    const permisos = await this.permisosRepo.find({
      where: { Activo: true },
      order: { Id: 'ASC' },
    });
    const filas = await this.rolPermisoRepo.find({
      relations: ['Rol', 'Permiso'],
    });

    const matriz: Record<string, string[]> = {};
    for (const p of permisos) {
      matriz[p.Codigo] = [];
    }
    for (const fila of filas) {
      const codigo = fila.Permiso?.Codigo;
      const rol = fila.Rol?.Nombre;
      if (!codigo || !rol) continue;
      if (!matriz[codigo]) matriz[codigo] = [];
      if (!matriz[codigo].includes(rol)) matriz[codigo].push(rol);
    }

    return {
      roles: roles.map((r) => r.Nombre),
      permisos: permisos.map((p) => ({ codigo: p.Codigo, nombre: p.Nombre })),
      matriz,
    };
  }

  async guardarMatriz(
    asignaciones: Record<string, string[]>,
  ): Promise<MatrizEditable> {
    if (!asignaciones || typeof asignaciones !== 'object') {
      throw new BadRequestException('Matriz de permisos inválida.');
    }

    const roles = await this.rolesRepo.find({ where: { Activo: true } });
    const permisos = await this.permisosRepo.find({ where: { Activo: true } });
    const rolPorNombre = new Map(roles.map((r) => [r.Nombre, r]));
    const permisoPorCodigo = new Map(permisos.map((p) => [p.Codigo, p]));

    for (const codigo of PERMISOS_PROTEGIDOS_SUPERADMIN) {
      const rolesAsignados = asignaciones[codigo] ?? [];
      if (!rolesAsignados.includes('SuperAdmin')) {
        throw new BadRequestException(
          `SuperAdmin debe conservar el permiso «${codigo}».`,
        );
      }
    }

    const rolesValidos = new Set(roles.map((r) => r.Nombre));
    for (const [codigo, listaRoles] of Object.entries(asignaciones)) {
      if (!permisoPorCodigo.has(codigo)) {
        throw new BadRequestException(`Permiso desconocido: ${codigo}`);
      }
      for (const rol of listaRoles) {
        if (!rolesValidos.has(rol)) {
          throw new BadRequestException(`Rol desconocido: ${rol}`);
        }
      }
    }

    await this.rolPermisoRepo.clear();

    const filas: RolPermiso[] = [];
    for (const [codigo, listaRoles] of Object.entries(asignaciones)) {
      const permiso = permisoPorCodigo.get(codigo);
      if (!permiso) continue;
      const unicos = [...new Set(listaRoles)];
      for (const nombreRol of unicos) {
        const rol = rolPorNombre.get(nombreRol);
        if (!rol) continue;
        filas.push(
          this.rolPermisoRepo.create({
            RolId: rol.Id,
            PermisoId: permiso.Id,
            Rol: rol,
            Permiso: permiso,
          }),
        );
      }
    }
    if (filas.length > 0) {
      await this.rolPermisoRepo.save(filas);
    }

    await this.recargarMatrizEnMemoria();
    return this.obtenerMatrizEditable();
  }

  async rolesConPermiso(codigo: string): Promise<string[]> {
    const permiso = await this.permisosRepo.findOne({
      where: { Codigo: codigo },
    });
    if (!permiso) return [];
    const filas = await this.rolPermisoRepo.find({
      where: { Permiso: { Id: permiso.Id } },
      relations: ['Rol'],
    });
    return filas.map((f) => f.Rol.Nombre);
  }
}
