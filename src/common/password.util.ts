import { createHash } from 'crypto';
import * as bcrypt from 'bcrypt';

const RONDAS_BCRYPT = 12;

export async function hashearContrasena(textoPlano: string): Promise<string> {
  return bcrypt.hash(textoPlano, RONDAS_BCRYPT);
}

export async function verificarContrasena(
  textoPlano: string,
  hashGuardado: string,
): Promise<boolean> {
  if (!textoPlano || !hashGuardado) return false;
  if (hashGuardado.startsWith('$2')) {
    return bcrypt.compare(textoPlano, hashGuardado);
  }
  const sha = createHash('sha256').update(textoPlano, 'utf8').digest('hex');
  return sha === hashGuardado.toLowerCase() || textoPlano === hashGuardado;
}
