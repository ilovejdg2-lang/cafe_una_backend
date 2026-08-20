import {
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  RemoveEvent,
  UpdateEvent,
} from 'typeorm';
import { getAuditoriaUserId } from './auditoria-context';

@EventSubscriber()
export class AuditoriaSubscriber implements EntitySubscriberInterface {
  beforeInsert(event: InsertEvent<unknown>): Promise<void> {
    return this.aplicarUsuario(event);
  }

  beforeUpdate(event: UpdateEvent<unknown>): Promise<void> {
    return this.aplicarUsuario(event);
  }

  beforeRemove(event: RemoveEvent<unknown>): Promise<void> {
    return this.aplicarUsuario(event);
  }

  private aplicarUsuario(event: {
    queryRunner?: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
  }): Promise<void> {
    const queryRunner = event.queryRunner;
    if (!queryRunner) return Promise.resolve();
    return queryRunner
      .query('SET @auditoria_usuario_id = ?', [getAuditoriaUserId()])
      .then(() => undefined);
  }
}
