import type { Request, Response } from 'express';
import type { JwtUsuario } from '../common/permisos';
import { FacturasService } from '../services/facturas.service';
import { FacturasController } from './facturas.controller';

describe('FacturasController.descargarPdf', () => {
  it('permite mostrar el PDF en el visor del sitio', async () => {
    const service = {
      obtenerPorId: jest.fn().mockResolvedValue({ UsuarioId: 1 }),
      obtenerRutaArchivoPdf: jest
        .fn()
        .mockResolvedValue({ filePath: __filename, filename: 'f.pdf' }),
    } as unknown as FacturasService;
    const controller = new FacturasController(service);
    const res = { set: jest.fn(), removeHeader: jest.fn() };

    const archivo = await controller.descargarPdf(
      '1',
      { user: { userId: 1, roles: ['SuperAdmin'] } } as Request & {
        user: JwtUsuario;
      },
      res as unknown as Response,
    );
    archivo.getStream().destroy();

    expect(res.removeHeader).toHaveBeenCalledWith('X-Frame-Options');
    expect(res.set).toHaveBeenCalledWith({
      'Content-Security-Policy': expect.stringContaining(
        'https://cafeunaing.netlify.app',
      ) as string,
    });
  });
});
