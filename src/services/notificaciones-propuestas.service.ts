import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { Notificacion } from '../entities/notificacion.entity';
import { PropuestaProductor } from '../entities/propuesta-productor.entity';
import { Usuario } from '../entities/usuario.entity';
import { tieneAlgunPermiso } from '../common/permisos';

const PERMISO_REVISION = 'administrar_solicitudes_productores';

@Injectable()
export class NotificacionesPropuestasService {
  constructor(
    @InjectRepository(Notificacion)
    private readonly repo: Repository<Notificacion>,
  ) {}

  async listarPropias(usuarioId: number) {
    const filas = await this.repo.find({
      where: { UsuarioId: usuarioId, Leida: false },
      order: { CreadoEn: 'DESC' },
      take: 30,
    });
    return {
      noLeidas: filas.length,
      data: filas.map((fila) => this.mapear(fila)),
    };
  }

  async marcarLeida(usuarioId: number, id: number) {
    const fila = await this.repo.findOne({ where: { Id: id, UsuarioId: usuarioId } });
    if (!fila) {
      throw new NotFoundException('No se encontró la notificación.');
    }
    if (!fila.Leida) {
      fila.Leida = true;
      await this.repo.save(fila);
    }
    return this.mapear(fila);
  }

  async crearRecepcion(
    manager: EntityManager,
    propuesta: PropuestaProductor,
  ): Promise<void> {
    const repo = manager.getRepository(Notificacion);
    const id = String(propuesta.Id);
    await this.insertarSiNoExiste(repo, {
      UsuarioId: propuesta.UsuarioId,
      Tipo: 'propuesta_recibida',
      Titulo: 'Recibimos tu propuesta',
      Mensaje: `${propuesta.NombreEmprendimiento} quedó pendiente de revisión.`,
      Enlace: `/perfil/propuestas/${id}`,
      ClaveUnica: `propuesta:${id}:recepcion:${propuesta.UsuarioId}`,
      ReferenciaId: id,
    });

    const usuarios = await manager.getRepository(Usuario).find();
    for (const usuario of usuarios) {
      if ((usuario.Estado || '').toLowerCase() !== 'activo') continue;
      if (!tieneAlgunPermiso(usuario.Roles, [PERMISO_REVISION])) continue;
      await this.insertarSiNoExiste(repo, {
        UsuarioId: usuario.Id,
        Tipo: 'propuesta_nueva',
        Titulo: 'Nueva propuesta de productor',
        Mensaje: `${propuesta.NombreEmprendimiento} espera revisión.`,
        Enlace: `/admin/propuestas/${id}`,
        ClaveUnica: `propuesta:${id}:admin:${usuario.Id}`,
        ReferenciaId: id,
      });
    }
  }

  async crearResultado(
    manager: EntityManager,
    propuesta: PropuestaProductor,
  ): Promise<void> {
    const repo = manager.getRepository(Notificacion);
    const id = String(propuesta.Id);
    await repo
      .createQueryBuilder()
      .update(Notificacion)
      .set({ Leida: true })
      .where('"ClaveUnica" LIKE :clave', { clave: `propuesta:${id}:admin:%` })
      .execute();
    const aprobada = propuesta.Estado === 'Aprobada';
    await this.insertarSiNoExiste(repo, {
      UsuarioId: propuesta.UsuarioId,
      Tipo: aprobada ? 'propuesta_aprobada' : 'propuesta_rechazada',
      Titulo: aprobada ? 'Tu propuesta fue aprobada' : 'Tu propuesta fue rechazada',
      Mensaje: aprobada
        ? `${propuesta.NombreEmprendimiento} fue aprobada para su publicación.`
        : `${propuesta.NombreEmprendimiento} fue rechazada. Podés ver el motivo en el detalle.`,
      Enlace: `/perfil/propuestas/${id}`,
      ClaveUnica: `propuesta:${id}:resultado:${propuesta.UsuarioId}`,
      ReferenciaId: id,
    });
  }

  private async insertarSiNoExiste(
    repo: Repository<Notificacion>,
    datos: Omit<Notificacion, 'Id' | 'Leida' | 'CreadoEn'>,
  ): Promise<void> {
    const existe = await repo.findOne({ where: { ClaveUnica: datos.ClaveUnica } });
    if (existe) return;
    await repo.save(
      repo.create({
        ...datos,
        Leida: false,
      }),
    );
  }

  private mapear(fila: Notificacion) {
    return {
      id: fila.Id,
      tipo: fila.Tipo,
      titulo: fila.Titulo,
      mensaje: fila.Mensaje,
      enlace: fila.Enlace,
      leida: fila.Leida,
      referenciaId: fila.ReferenciaId,
      creadoEn: fila.CreadoEn,
    };
  }
}
