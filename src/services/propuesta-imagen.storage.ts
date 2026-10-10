import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { readFile, unlink, writeFile } from 'fs/promises';
import { join } from 'path';

import {
  detectarImagenReal,
  type ImagenDetectada,
} from '../common/propuesta-productor.util';
import { SupabaseStorageService } from './supabase-storage.service';

const DIRECTORIO = join(process.cwd(), 'uploads', 'propuestas');

@Injectable()
export class PropuestaImagenStorage {
  private readonly logger = new Logger(PropuestaImagenStorage.name);

  constructor(private readonly supabase: SupabaseStorageService) {}

  async guardar(buffer: Buffer, detectada: ImagenDetectada): Promise<string> {
    if (!existsSync(DIRECTORIO)) {
      mkdirSync(DIRECTORIO, { recursive: true });
    }
    const nombre = `propuesta-${randomUUID()}${detectada.extension}`;
    const absoluto = join(DIRECTORIO, nombre);
    await writeFile(absoluto, buffer);
    if (this.supabase.estaHabilitado()) {
      const ok = await this.supabase.subirArchivo(
        this.claveNube(nombre),
        buffer,
        detectada.mime,
      );
      if (!ok) {
        await this.borrarLocal(nombre);
        throw new Error('No se pudo guardar la imagen. Intentá de nuevo.');
      }
    }
    return nombre;
  }

  async eliminar(nombre: string): Promise<void> {
    await this.borrarLocal(nombre);
    if (this.supabase.estaHabilitado()) {
      await this.supabase.eliminarArchivo(this.claveNube(nombre));
    }
  }

  async leer(nombre: string): Promise<{ buffer: Buffer; mime: string } | null> {
    if (!this.nombreSeguro(nombre)) return null;
    const absoluto = join(DIRECTORIO, nombre);
    if (existsSync(absoluto)) {
      const buffer = await readFile(absoluto);
      return { buffer, mime: this.mime(nombre) };
    }
    if (this.supabase.estaHabilitado()) {
      const nube = await this.supabase.descargarBuffer(this.claveNube(nombre));
      if (nube) return { buffer: nube, mime: this.mime(nombre) };
    }
    return null;
  }

  validar(buffer: Buffer): ImagenDetectada {
    return detectarImagenReal(buffer);
  }

  private claveNube(nombre: string): string {
    return `propuestas/${nombre}`;
  }

  private nombreSeguro(nombre: string): boolean {
    return /^propuesta-[a-z0-9-]+\.(jpg|png|webp)$/i.test(nombre);
  }

  private mime(nombre: string): string {
    if (nombre.endsWith('.png')) return 'image/png';
    if (nombre.endsWith('.webp')) return 'image/webp';
    return 'image/jpeg';
  }

  private async borrarLocal(nombre: string): Promise<void> {
    if (!this.nombreSeguro(nombre)) return;
    try {
      await unlink(join(DIRECTORIO, nombre));
    } catch (error) {
      this.logger.warn(`No se pudo borrar la imagen local ${nombre}: ${error}`);
    }
  }
}
