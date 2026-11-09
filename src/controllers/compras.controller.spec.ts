import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  asegurarDirectorioUpload,
  resolverArchivoUpload,
} from '../common/upload-paths';
import { ComprasController } from './compras.controller';

describe('ComprasController comprobantes', () => {
  const usuario = { userId: 7, roles: ['cliente'] };
  const req = { user: usuario, body: {} } as any;
  const archivo = {
    originalname: 'pago.PNG',
    mimetype: 'image/png',
    buffer: Buffer.from('imagen'),
  };

  let compras: {
    registrar: jest.Mock;
    obtenerNombreArchivoComprobante: jest.Mock;
  };
  let storage: {
    estaHabilitado: jest.Mock;
    subirArchivo: jest.Mock;
    descargarBuffer: jest.Mock;
    eliminarArchivo: jest.Mock;
  };
  let controller: ComprasController;

  beforeEach(() => {
    compras = {
      registrar: jest.fn().mockResolvedValue({ id: 1 }),
      obtenerNombreArchivoComprobante: jest.fn(),
    };
    storage = {
      estaHabilitado: jest.fn().mockReturnValue(true),
      subirArchivo: jest.fn().mockResolvedValue(true),
      descargarBuffer: jest.fn(),
      eliminarArchivo: jest.fn().mockResolvedValue(true),
    };
    controller = new ComprasController(compras as any, storage as any);
  });

  describe('registrar', () => {
    it('sube el comprobante al bucket privado antes de registrar la compra', async () => {
      await controller.registrar({}, archivo, req);

      expect(storage.subirArchivo).toHaveBeenCalledTimes(1);
      const [nombre, buffer, mime, bucket] = storage.subirArchivo.mock.calls[0];
      expect(nombre).toMatch(/^comprobante-\d+-\d+\.png$/);
      expect(buffer).toBe(archivo.buffer);
      expect(mime).toBe('image/png');
      expect(bucket).toBe('comprobantes');
      expect(compras.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ comprobanteArchivo: nombre }),
        7,
      );
      expect(storage.subirArchivo.mock.invocationCallOrder[0]).toBeLessThan(
        compras.registrar.mock.invocationCallOrder[0],
      );
    });

    it('falla y no crea la compra si la subida al bucket falla', async () => {
      storage.subirArchivo.mockResolvedValue(false);

      await expect(
        controller.registrar({}, archivo, req),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
      expect(compras.registrar).not.toHaveBeenCalled();
    });

    it('elimina el objeto subido si el registro de la compra falla', async () => {
      const error = new Error('transaccion fallida');
      compras.registrar.mockRejectedValue(error);

      await expect(controller.registrar({}, archivo, req)).rejects.toBe(error);

      const nombre = storage.subirArchivo.mock.calls[0][0];
      expect(storage.eliminarArchivo).toHaveBeenCalledWith(
        nombre,
        'comprobantes',
      );
    });

    it('conserva el error original si la limpieza también falla', async () => {
      const error = new Error('transaccion fallida');
      compras.registrar.mockRejectedValue(error);
      storage.eliminarArchivo.mockRejectedValue(new Error('limpieza'));

      await expect(controller.registrar({}, archivo, req)).rejects.toBe(error);
    });

    it('sin Supabase guarda en disco local y registra el nombre', async () => {
      storage.estaHabilitado.mockReturnValue(false);

      await controller.registrar({}, archivo, req);

      expect(storage.subirArchivo).not.toHaveBeenCalled();
      const nombre = compras.registrar.mock.calls[0][0].comprobanteArchivo;
      expect(nombre).toMatch(/^comprobante-\d+-\d+\.png$/);
      const ruta = resolverArchivoUpload('compras', nombre);
      expect(ruta).not.toBeNull();
      expect(readFileSync(ruta as string).toString()).toBe('imagen');
      rmSync(ruta as string);
    });

    it('sin archivo registra sin comprobante y no toca el storage', async () => {
      await controller.registrar({}, undefined, req);

      expect(storage.subirArchivo).not.toHaveBeenCalled();
      expect(
        compras.registrar.mock.calls[0][0].comprobanteArchivo,
      ).toBeUndefined();
    });
  });

  describe('descargarComprobante', () => {
    it('lee primero el disco local (archivos legados)', async () => {
      const nombre = `comprobante-legado-${Date.now()}.jpg`;
      const ruta = join(asegurarDirectorioUpload('compras'), nombre);
      writeFileSync(ruta, 'legado');
      compras.obtenerNombreArchivoComprobante.mockResolvedValue(nombre);

      try {
        const res = await controller.descargarComprobante('1', req);
        expect(res.getHeaders().disposition).toBe(
          `inline; filename="${nombre}"`,
        );
        expect(storage.descargarBuffer).not.toHaveBeenCalled();
        await new Promise<void>((resolve) => {
          const stream = res.getStream();
          stream.on('error', () => undefined);
          stream.on('close', () => resolve());
          stream.destroy();
        });
      } finally {
        rmSync(ruta, { force: true });
      }
    });

    it('cae al bucket privado si no existe en disco', async () => {
      compras.obtenerNombreArchivoComprobante.mockResolvedValue(
        'comprobante-no-local-1.webp',
      );
      storage.descargarBuffer.mockResolvedValue(Buffer.from('remoto'));

      const res = await controller.descargarComprobante('1', req);

      expect(storage.descargarBuffer).toHaveBeenCalledWith(
        'comprobante-no-local-1.webp',
        'comprobantes',
      );
      expect(res.getHeaders()).toEqual({
        type: 'image/webp',
        disposition: 'inline; filename="comprobante-no-local-1.webp"',
        length: 6,
      });
    });

    it('responde NotFound con el mismo mensaje si no está en ningún lado', async () => {
      compras.obtenerNombreArchivoComprobante.mockResolvedValue('nada.jpg');
      storage.descargarBuffer.mockResolvedValue(null);

      await expect(controller.descargarComprobante('1', req)).rejects.toThrow(
        new NotFoundException('No se encontró el archivo del comprobante.'),
      );
    });

    it('usa solo el nombre base del archivo guardado en la BD', async () => {
      compras.obtenerNombreArchivoComprobante.mockResolvedValue(
        '../../etc/pass.png',
      );
      storage.descargarBuffer.mockResolvedValue(Buffer.from('r'));

      await controller.descargarComprobante('1', req);

      expect(storage.descargarBuffer).toHaveBeenCalledWith(
        'pass.png',
        'comprobantes',
      );
    });

    it('rechaza nombres vacíos sin consultar el bucket', async () => {
      compras.obtenerNombreArchivoComprobante.mockResolvedValue('..');

      await expect(
        controller.descargarComprobante('1', req),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(storage.descargarBuffer).not.toHaveBeenCalled();
    });
  });
});
