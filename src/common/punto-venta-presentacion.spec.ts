import { BadRequestException } from '@nestjs/common';
import {
  esUrlGoogleMaps,
  normalizarDireccionPunto,
  normalizarImagenPunto,
  normalizarMapsUrl,
} from './punto-venta-presentacion';

describe('presentación de punto de venta', () => {
  it('acepta enlaces de Google Maps y rechaza otros destinos', () => {
    expect(esUrlGoogleMaps('https://www.google.com/maps/place/Editorial')).toBe(true);
    expect(esUrlGoogleMaps('https://maps.google.com/?q=Campus+Omar+Dengo')).toBe(true);
    expect(esUrlGoogleMaps('https://maps.app.goo.gl/abc123')).toBe(true);
    expect(esUrlGoogleMaps('https://goo.gl/maps/abc')).toBe(true);
    expect(esUrlGoogleMaps('https://www.google.co.cr/maps/search/?api=1&query=Heredia')).toBe(true);
    expect(esUrlGoogleMaps('https://evil.com/maps')).toBe(false);
    expect(esUrlGoogleMaps('https://maps.google.com.evil.com/')).toBe(false);
    expect(esUrlGoogleMaps('http://maps.google.com/?q=Heredia')).toBe(false);
    expect(esUrlGoogleMaps('javascript:alert(1)')).toBe(false);
    expect(esUrlGoogleMaps('https://www.google.com/search?q=maps')).toBe(false);
  });

  it('normaliza dirección, imagen y maps, y permite dejarlos vacíos', () => {
    expect(normalizarDireccionPunto('  Campus Omar Dengo  ')).toBe('Campus Omar Dengo');
    expect(normalizarDireccionPunto('   ')).toBeNull();
    expect(normalizarImagenPunto('/api/inventario/ubicaciones/imagenes/punto-1.jpg')).toBe(
      '/api/inventario/ubicaciones/imagenes/punto-1.jpg',
    );
    expect(normalizarImagenPunto('')).toBeNull();
    expect(normalizarMapsUrl('https://maps.app.goo.gl/abc')).toBe('https://maps.app.goo.gl/abc');
    expect(normalizarMapsUrl(null)).toBeNull();
  });

  it('rechaza imágenes y enlaces inseguros', () => {
    expect(() => normalizarImagenPunto('javascript:alert(1)')).toThrow(BadRequestException);
    expect(() => normalizarImagenPunto('/api/inventario/ubicaciones/imagenes/../secreto.jpg')).toThrow(
      BadRequestException,
    );
    expect(() => normalizarMapsUrl('https://example.com')).toThrow(BadRequestException);
    expect(() => normalizarDireccionPunto('a'.repeat(301))).toThrow(BadRequestException);
  });
});
