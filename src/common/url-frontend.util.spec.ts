import {
  FRONTEND_URL_PRODUCCION,
  baseUrlFrontend,
} from './url-frontend.util';

describe('url-frontend.util', () => {
  it('usa Netlify por defecto', () => {
    expect(baseUrlFrontend()).toBe(FRONTEND_URL_PRODUCCION);
    expect(baseUrlFrontend({ get: () => undefined })).toBe(
      FRONTEND_URL_PRODUCCION,
    );
  });

  it('respeta FRONTEND_URL público y rechaza localhost', () => {
    expect(
      baseUrlFrontend({
        get: (k) =>
          k === 'FRONTEND_URL' ? 'https://cafeunaing.netlify.app/' : undefined,
      }),
    ).toBe('https://cafeunaing.netlify.app');
    expect(
      baseUrlFrontend({
        get: (k) =>
          k === 'FRONTEND_URL' ? 'http://localhost:5173' : undefined,
      }),
    ).toBe(FRONTEND_URL_PRODUCCION);
  });
});
