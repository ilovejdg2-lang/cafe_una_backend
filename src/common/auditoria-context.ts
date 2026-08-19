import { AsyncLocalStorage } from 'node:async_hooks';

type AuditoriaContext = {
  userId: number | null;
};

export const auditoriaContext = new AsyncLocalStorage<AuditoriaContext>();

export function getAuditoriaUserId(): number | null {
  return auditoriaContext.getStore()?.userId ?? null;
}
