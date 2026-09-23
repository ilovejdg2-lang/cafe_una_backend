import { Injectable, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseStorageService {
  private readonly logger = new Logger(SupabaseStorageService.name);
  private supabase: SupabaseClient | null = null;
  private readonly bucket: string;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const key =
      process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_PUBLISHABLE_KEY;
    this.bucket = process.env.SUPABASE_STORAGE_BUCKET || 'documentos';

    if (url && key) {
      try {
        this.supabase = createClient(url, key, {
          auth: { persistSession: false },
        });
        this.logger.log(
          `Supabase Storage inicializado para el bucket: "${this.bucket}"`,
        );
      } catch (err: any) {
        this.logger.error(
          `Error al inicializar cliente de Supabase Storage: ${err?.message}`,
        );
      }
    } else {
      this.logger.warn(
        'Supabase Storage no configurado: faltan SUPABASE_URL o SUPABASE_SECRET_KEY en .env',
      );
    }
  }

  /**
   * Indica si el servicio de Supabase Storage está activo y configurado
   */
  estaHabilitado(): boolean {
    return this.supabase !== null;
  }

  /**
   * Sube un archivo a Supabase Storage
   */
  async subirArchivo(
    nombreArchivo: string,
    contenido: Buffer,
    mimeType = 'application/octet-stream',
  ): Promise<boolean> {
    if (!this.supabase) return false;

    try {
      const { error } = await this.supabase.storage
        .from(this.bucket)
        .upload(nombreArchivo, contenido, {
          contentType: mimeType,
          upsert: true,
        });

      if (error) {
        this.logger.error(
          `Error al subir archivo "${nombreArchivo}" a Supabase: ${error.message}`,
        );
        return false;
      }

      this.logger.log(`Archivo "${nombreArchivo}" subido a Supabase Storage con éxito.`);
      return true;
    } catch (err: any) {
      this.logger.error(
        `Excepción al subir "${nombreArchivo}" a Supabase: ${err?.message}`,
      );
      return false;
    }
  }

  /**
   * Descarga un archivo desde Supabase Storage como Buffer
   */
  async descargarBuffer(nombreArchivo: string): Promise<Buffer | null> {
    if (!this.supabase) return null;

    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucket)
        .download(nombreArchivo);

      if (error || !data) {
        return null;
      }

      const arrayBuffer = await data.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (err: any) {
      this.logger.error(
        `Excepción al descargar "${nombreArchivo}" de Supabase: ${err?.message}`,
      );
      return null;
    }
  }

  /**
   * Obtiene la URL pública directa (CDN) de un archivo en Supabase
   */
  obtenerUrlPublica(nombreArchivo: string): string | null {
    if (!this.supabase) return null;

    const { data } = this.supabase.storage
      .from(this.bucket)
      .getPublicUrl(nombreArchivo);

    return data?.publicUrl || null;
  }

  /**
   * Genera una URL firmada con vencimiento para archivos privados
   */
  async generarUrlFirmada(nombreArchivo: string, segundos = 900): Promise<string | null> {
    if (!this.supabase) return null;

    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucket)
        .createSignedUrl(nombreArchivo, segundos);

      if (error || !data?.signedUrl) {
        return null;
      }
      return data.signedUrl;
    } catch {
      return null;
    }
  }

  /**
   * Elimina un archivo de Supabase Storage
   */
  async eliminarArchivo(nombreArchivo: string): Promise<boolean> {
    if (!this.supabase) return false;

    try {
      const { error } = await this.supabase.storage
        .from(this.bucket)
        .remove([nombreArchivo]);

      if (error) {
        this.logger.error(
          `Error al eliminar "${nombreArchivo}" de Supabase: ${error.message}`,
        );
        return false;
      }
      return true;
    } catch (err: any) {
      this.logger.error(
        `Excepción al eliminar "${nombreArchivo}" de Supabase: ${err?.message}`,
      );
      return false;
    }
  }
}
