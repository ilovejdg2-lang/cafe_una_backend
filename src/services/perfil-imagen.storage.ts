import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, open, writeFile } from 'fs/promises';
import { join } from 'path';
import sharp from 'sharp';

export const PERFIL_IMAGENES_DIR = Symbol('PERFIL_IMAGENES_DIR');
export const MAX_PROFILE_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_PROFILE_IMAGE_PIXELS = 25_000_000;
const SAFE_NAME =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.webp$/;

@Injectable()
export class PerfilImagenStorage {
  constructor(
    @Optional()
    @Inject(PERFIL_IMAGENES_DIR)
    private readonly directory: string = join(
      process.cwd(),
      'uploads',
      'perfil',
    ),
  ) {}

  async guardar(input: Buffer): Promise<string> {
    if (!input?.length || input.length > MAX_PROFILE_IMAGE_BYTES) {
      throw new BadRequestException('Adjunte una imagen de hasta 10 MB.');
    }
    let output: Buffer;
    try {
      const decoder = sharp(input, {
        limitInputPixels: MAX_PROFILE_IMAGE_PIXELS,
        animated: true,
        failOn: 'warning',
      });
      const metadata = await decoder.metadata();
      if (
        !['jpeg', 'png', 'webp'].includes(metadata.format || '') ||
        (metadata.pages || 1) !== 1
      ) {
        throw new Error('Unsupported image');
      }
      output = await decoder.rotate().webp().toBuffer();
      if (output.length > MAX_PROFILE_IMAGE_BYTES)
        throw new Error('Output exceeds limit');
    } catch {
      throw new BadRequestException(
        'La imagen debe ser JPG, PNG o WEBP válida, de un solo cuadro y hasta 25 millones de píxeles.',
      );
    }
    const name = `${randomUUID()}.webp`;
    try {
      await mkdir(this.directory, { recursive: true });
      await writeFile(join(this.directory, name), output, { flag: 'wx' });
    } catch {
      throw new InternalServerErrorException('No se pudo guardar la imagen.');
    }
    return name;
  }

  async leer(name: string) {
    if (!SAFE_NAME.test(name))
      throw new BadRequestException('Nombre de imagen inválido.');
    let file: Awaited<ReturnType<typeof open>> | undefined;
    try {
      file = await open(join(this.directory, name), 'r');
      if (!(await file.stat()).isFile()) throw new Error('Not a file');
      return file.createReadStream();
    } catch (error) {
      await file?.close();
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new NotFoundException('No se encontró la imagen.');
      }
      throw new InternalServerErrorException('No se pudo leer la imagen.');
    }
  }
}
