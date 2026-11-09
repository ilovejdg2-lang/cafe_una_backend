import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import { DocumentosController } from './documentos.controller';
import { DocumentosService } from '../services/documentos.service';

describe('DocumentosController.visualizarDocumento', () => {
  it('permite mostrar el documento en el visor del sitio', async () => {
    const service = {
      descargar: jest.fn().mockResolvedValue({
        stream: {},
        nombreOriginal: 'minuta.pdf',
        mimeType: 'application/pdf',
      }),
    } as unknown as DocumentosService;
    const controller = new DocumentosController(service, {} as JwtService);
    const res = { set: jest.fn(), removeHeader: jest.fn() };

    await controller.visualizarDocumento(
      '1',
      { ip: '127.0.0.1', headers: {} } as unknown as Request,
      undefined,
      undefined,
      res as unknown as Response,
    );

    expect(res.removeHeader).toHaveBeenCalledWith('X-Frame-Options');
    const cabeceras = (res.set.mock.calls[0] as [Record<string, string>])[0];
    expect(cabeceras['Content-Security-Policy']).toContain(
      'frame-ancestors',
    );
    expect(cabeceras['Content-Security-Policy']).toContain(
      'https://cafeunaing.netlify.app',
    );
  });
});
