import type { Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as nodemailer from 'nodemailer';
import * as os from 'os';
import * as path from 'path';
import type { ConfigService } from '@nestjs/config';
import type { DataSource } from 'typeorm';
import { EmailService, LOGO_PLACEHOLDER } from './email.service';

jest.mock('nodemailer');

const API_KEY = 'xkeysib-secret-key-123';

function crearServicio(env: Record<string, string>, logoUrl?: string) {
  const config = { get: (k: string) => env[k] } as unknown as ConfigService;
  const dataSource = {
    query: jest.fn().mockResolvedValue(logoUrl ? [{ LogoUrl: logoUrl }] : []),
  } as unknown as DataSource;
  return new EmailService(config, dataSource);
}

type Llamada = [
  string,
  {
    method: string;
    headers: Record<string, string>;
    signal: unknown;
    body: string;
  },
];
type Cuerpo = { htmlContent: string; attachment?: unknown[] };

describe('EmailService.enviar', () => {
  const envBase = {
    SMTP_HOST: 'smtp.test',
    SMTP_USER: 'user@test.com',
    SMTP_FROM: 'noreply@cafeuna.test',
    SMTP_FROM_NAME: 'Café UNA',
  };
  let fetchMock: jest.Mock;
  let sendMail: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      text: () => Promise.resolve('{"messageId":"<1@x>"}'),
    });
    (global as { fetch: unknown }).fetch = fetchMock;
    sendMail = jest.fn().mockResolvedValue({});
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });
  });

  it('usa la API de Brevo cuando BREVO_API_KEY existe', async () => {
    const svc = crearServicio({ ...envBase, BREVO_API_KEY: API_KEY });
    const ok = await svc.enviar('a@b.com', 'Asunto', '<p>Hola</p>', 'Hola');

    expect(ok).toBe(true);
    expect(sendMail).not.toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0] as Llamada;
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(init.method).toBe('POST');
    expect(init.headers['api-key']).toBe(API_KEY);
    expect(init.headers['content-type']).toBe('application/json');
    expect(init.signal).toBeDefined();
    expect(JSON.parse(init.body) as unknown).toEqual({
      sender: { name: 'Café UNA', email: 'noreply@cafeuna.test' },
      to: [{ email: 'a@b.com' }],
      subject: 'Asunto',
      htmlContent: '<p>Hola</p>',
      textContent: 'Hola',
    });
  });

  it('usa SMTP cuando BREVO_API_KEY no existe', async () => {
    const svc = crearServicio(envBase);
    const ok = await svc.enviar('a@b.com', 'Asunto', '<p>Hola</p>');

    expect(ok).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it('con Brevo, sin remitente configurado, devuelve false sin llamar a la API', async () => {
    const svc = crearServicio({ BREVO_API_KEY: API_KEY });
    expect(await svc.enviar('a@b.com', 's', '<p>x</p>')).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('convierte adjuntos Buffer, string y path a base64', async () => {
    const tmp = path.join(os.tmpdir(), `brevo-test-${Date.now()}.pdf`);
    await fs.writeFile(tmp, 'desde-archivo');
    try {
      const svc = crearServicio({ ...envBase, BREVO_API_KEY: API_KEY });
      await svc.enviar('a@b.com', 's', '<p>x</p>', undefined, [
        { filename: 'a.pdf', content: Buffer.from('buffer') },
        { filename: 'b.txt', content: 'texto' },
        { filename: 'c.pdf', path: tmp },
      ]);
      const body = JSON.parse(
        (fetchMock.mock.calls[0] as Llamada)[1].body,
      ) as Cuerpo;
      expect(body.attachment).toEqual([
        { name: 'a.pdf', content: Buffer.from('buffer').toString('base64') },
        { name: 'b.txt', content: Buffer.from('texto').toString('base64') },
        {
          name: 'c.pdf',
          content: Buffer.from('desde-archivo').toString('base64'),
        },
      ]);
    } finally {
      await fs.rm(tmp, { force: true });
    }
  });

  it('usa la URL pública del logo y no deja cid ni adjunto de logo', async () => {
    const svc = crearServicio(
      { ...envBase, BREVO_API_KEY: API_KEY },
      'https://cdn.test/logo.png',
    );
    await svc.enviar('a@b.com', 's', `<img src="${LOGO_PLACEHOLDER}" />`);
    const body = JSON.parse(
      (fetchMock.mock.calls[0] as Llamada)[1].body,
    ) as Cuerpo;
    expect(body.htmlContent).toContain('src="https://cdn.test/logo.png"');
    expect(body.htmlContent).not.toContain('cid:');
    expect(body.attachment).toBeUndefined();
  });

  it('con logo WebP convierte a PNG inline (cid + contentId)', async () => {
    const png1x1 = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes('logo.webp')) {
        return {
          ok: true,
          arrayBuffer: async () =>
            png1x1.buffer.slice(png1x1.byteOffset, png1x1.byteOffset + png1x1.byteLength),
        };
      }
      return {
        ok: true,
        status: 201,
        text: () => Promise.resolve('{"messageId":"<1@x>"}'),
      };
    });
    const svc = crearServicio(
      { ...envBase, BREVO_API_KEY: API_KEY },
      'https://cdn.test/logo.webp',
    );
    await svc.enviar('a@b.com', 's', `<img src="${LOGO_PLACEHOLDER}" />`);
    const brevoCall = fetchMock.mock.calls.find(
      (call) => String(call[0]).includes('api.brevo.com'),
    ) as Llamada;
    const body = JSON.parse(brevoCall[1].body) as Cuerpo;
    expect(body.htmlContent).toContain('cid:logo-cafe-una');
    expect(body.htmlContent).not.toContain('logo.webp');
    expect(body.attachment).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'logo-cafe-una.png',
          contentId: 'logo-cafe-una',
        }),
      ]),
    );
  });

  it('si el WebP no se puede convertir, usa texto de respaldo', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes('logo.webp')) {
        return { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) };
      }
      return {
        ok: true,
        status: 201,
        text: () => Promise.resolve('{"messageId":"<1@x>"}'),
      };
    });
    const svc = crearServicio(
      { ...envBase, BREVO_API_KEY: API_KEY },
      'https://cdn.test/logo.webp',
    );
    await svc.enviar('a@b.com', 's', `<img src="${LOGO_PLACEHOLDER}" />`);
    const brevoCall = fetchMock.mock.calls.find(
      (call) => String(call[0]).includes('api.brevo.com'),
    ) as Llamada;
    const body = JSON.parse(brevoCall[1].body) as Cuerpo;
    expect(body.htmlContent).toContain('Café UNA');
    expect(body.htmlContent).not.toContain('logo.webp');
    expect(body.attachment).toBeUndefined();
  });

  it('sin logo configurado usa el texto de respaldo', async () => {
    const svc = crearServicio({ ...envBase, BREVO_API_KEY: API_KEY });
    await svc.enviar('a@b.com', 's', `<img src="${LOGO_PLACEHOLDER}" />`);
    const body = JSON.parse(
      (fetchMock.mock.calls[0] as Llamada)[1].body,
    ) as Cuerpo;
    expect(body.htmlContent).toContain('Café UNA');
    expect(body.htmlContent).not.toContain(LOGO_PLACEHOLDER);
  });

  it('respuesta no 2xx devuelve false y no filtra la clave', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      text: () =>
        Promise.resolve('{"code":"unauthorized","message":"Key not found"}'),
    });
    const svc = crearServicio({ ...envBase, BREVO_API_KEY: API_KEY });
    const errorSpy = jest
      .spyOn((svc as unknown as { logger: Logger }).logger, 'error')
      .mockImplementation();

    expect(await svc.enviar('a@b.com', 's', '<p>x</p>')).toBe(false);
    const logged = JSON.stringify(errorSpy.mock.calls);
    expect(logged).toContain('401');
    expect(logged).toContain('Key not found');
    expect(logged).not.toContain(API_KEY);
  });

  it('error de red o timeout devuelve false y no filtra la clave', async () => {
    fetchMock.mockRejectedValue(new Error(`timeout con ${API_KEY}`));
    const svc = crearServicio({ ...envBase, BREVO_API_KEY: API_KEY });
    const errorSpy = jest
      .spyOn((svc as unknown as { logger: Logger }).logger, 'error')
      .mockImplementation();

    expect(await svc.enviar('a@b.com', 's', '<p>x</p>')).toBe(false);
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(API_KEY);
  });
});
