import { join } from 'path';
import { directorioUpload, nombreArchivoSeguro } from './upload-paths';

describe('upload-paths', () => {
  it('usa solo el nombre de archivo, aunque venga una ruta completa', () => {
    expect(nombreArchivoSeguro('uploads/compras/comprobante-1.jpg')).toBe(
      'comprobante-1.jpg',
    );
    expect(nombreArchivoSeguro('C:\\tmp\\comprobante-1.jpg')).toBe(
      'comprobante-1.jpg',
    );
    expect(nombreArchivoSeguro('../comprobante-1.jpg')).toBe('comprobante-1.jpg');
    expect(nombreArchivoSeguro('')).toBe('');
  });

  it('resuelve uploads dentro del paquete del backend', () => {
    expect(directorioUpload('compras')).toBe(
      join(__dirname, '..', '..', 'uploads', 'compras'),
    );
  });
});
