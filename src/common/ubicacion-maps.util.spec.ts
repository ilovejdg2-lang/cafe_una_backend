import {
  esUrlMapasOWaze,
  estaEnCostaRica,
  extraerCoordenadasDeEnlace,
  extraerCoordenadasDeHtml,
  resolverCoordenadasPropuesta,
  resolverEnlaceMapas,
  validarCoordenadasEntrada,
} from './ubicacion-maps.util';

describe('ubicacion-maps.util', () => {
  it('extrae el pin del lugar (!3d!4d) y no el centro de cámara solo', () => {
    const conPin =
      'https://www.google.com/maps/place/Cafe/@9.9,-84.1,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d9.9281!4d-84.0907';
    expect(extraerCoordenadasDeEnlace(conPin)).toEqual({
      latitud: 9.9281,
      longitud: -84.0907,
    });

    const soloCamara = 'https://www.google.com/maps/@9.9,-84.1,12z';
    expect(extraerCoordenadasDeEnlace(soloCamara)).toBeNull();
  });

  it('acepta q=lat,lng y ll= de Waze', () => {
    expect(
      extraerCoordenadasDeEnlace('https://maps.google.com/?q=9.866,-83.921'),
    ).toEqual({ latitud: 9.866, longitud: -83.921 });
    expect(
      extraerCoordenadasDeEnlace('https://waze.com/ul?ll=10.0167,-84.2116&navigate=yes'),
    ).toEqual({ latitud: 10.0167, longitud: -84.2116 });
  });

  it('lee el destino de una ruta /maps/dir y no el centro de cámara', () => {
    const ruta =
      'https://www.google.com/maps/dir/10.1448997,-85.4528869/Dulce+Cafe/@9.9801614,-85.2669396,8.73z/data=!4m9!4m8!1m1!4e1!1m5!1m1!1s0x0:0x0!2m2!1d-84.0992619!2d10.0135836';
    expect(extraerCoordenadasDeEnlace(ruta)).toEqual({
      latitud: 10.0135836,
      longitud: -84.0992619,
    });
  });

  it('valida el par dentro de Costa Rica', () => {
    expect(validarCoordenadasEntrada('9.93', '-84.08')).toEqual({
      latitud: 9.93,
      longitud: -84.08,
    });
    expect(estaEnCostaRica(40.7, -74)).toBe(false);
    expect(() => validarCoordenadasEntrada('40.7', '-74')).toThrow(/Costa Rica/);
    expect(() => validarCoordenadasEntrada('9.93', '')).toThrow(/juntas/);
    expect(
      extraerCoordenadasDeEnlace('https://maps.google.com/?q=40.7,-74.0'),
    ).toEqual({ latitud: 40.7, longitud: -74 });
    expect(estaEnCostaRica(40.7, -74)).toBe(false);
  });

  it('limpia coordenadas al cambiar el enlace si no hay pin confiable', () => {
    const resultado = resolverCoordenadasPropuesta({
      enlaceUbicacion: 'https://maps.app.goo.gl/cortoSinCoords',
      enlaceAnterior: 'https://www.google.com/maps?q=9.93,-84.08',
      latitudAnterior: 9.93,
      longitudAnterior: -84.08,
    });
    expect(resultado).toBeNull();
  });

  it('conserva coordenadas si el enlace no cambió', () => {
    const enlace = 'https://maps.app.goo.gl/abc';
    expect(
      resolverCoordenadasPropuesta({
        enlaceUbicacion: enlace,
        enlaceAnterior: enlace,
        latitudAnterior: 9.93,
        longitudAnterior: -84.08,
      }),
    ).toEqual({ latitud: 9.93, longitud: -84.08 });
  });

  it('sigue redirecciones solo a dominios de Maps', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        status: 302,
        headers: { get: () => 'https://www.google.com/maps?q=9.7,-84.0' },
        url: 'https://maps.app.goo.gl/abc',
      })
      .mockResolvedValueOnce({
        status: 200,
        headers: { get: () => null },
        url: 'https://www.google.com/maps?q=9.7,-84.0',
      });

    const resultado = await resolverEnlaceMapas(
      'https://maps.app.goo.gl/abc',
      fetchMock as unknown as typeof fetch,
    );
    expect(resultado.coordenadas).toEqual({ latitud: 9.7, longitud: -84 });
  });

  it('rechaza redirecciones a dominios ajenos', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      status: 302,
      headers: { get: () => 'https://evil.example/phish' },
      url: 'https://maps.app.goo.gl/abc',
    });
    await expect(
      resolverEnlaceMapas(
        'https://maps.app.goo.gl/abc',
        fetchMock as unknown as typeof fetch,
      ),
    ).rejects.toThrow(/segura/);
  });

  it('acepta hosts de Maps CR y lee pines del HTML', () => {
    expect(
      esUrlMapasOWaze(new URL('https://maps.google.co.cr/?q=9.9,-84.1')),
    ).toBe(true);
    expect(
      esUrlMapasOWaze(new URL('https://www.google.co.cr/maps/place/X')),
    ).toBe(true);
    expect(esUrlMapasOWaze(new URL('https://ejemplo.com/maps'))).toBe(false);
    expect(
      extraerCoordenadasDeHtml(
        '<html>...<a href="https://www.google.com/maps/place/X/data=!3d9.91!4d-84.05">',
      ),
    ).toEqual({ latitud: 9.91, longitud: -84.05 });
  });

  it('lee coordenadas del HTML cuando la URL final no las trae', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      status: 200,
      headers: { get: () => null },
      url: 'https://www.google.com/maps/place/Heredia',
      text: async () =>
        'noise !2m2!1d-84.1165!2d9.9985 more noise',
    });
    const resultado = await resolverEnlaceMapas(
      'https://maps.app.goo.gl/abc',
      fetchMock as unknown as typeof fetch,
    );
    expect(resultado.coordenadas).toEqual({
      latitud: 9.9985,
      longitud: -84.1165,
    });
  });
});
