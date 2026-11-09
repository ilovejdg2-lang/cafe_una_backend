import { SupabaseStorageService } from './supabase-storage.service';

const upload = jest.fn();
const download = jest.fn();
const remove = jest.fn();
const from = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ storage: { from } })),
}));

describe('SupabaseStorageService bucket opcional', () => {
  const env = { ...process.env };
  let service: SupabaseStorageService;

  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SECRET_KEY = 'secret';
    process.env.SUPABASE_STORAGE_BUCKET = 'documentos';
    from.mockReset().mockReturnValue({ upload, download, remove });
    upload.mockReset().mockResolvedValue({ error: null });
    remove.mockReset().mockResolvedValue({ error: null });
    download.mockReset().mockResolvedValue({
      data: { arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2]).buffer) },
      error: null,
    });
    service = new SupabaseStorageService();
  });

  afterAll(() => {
    process.env = env;
  });

  it('subirArchivo usa el bucket por defecto sin el parámetro', async () => {
    await service.subirArchivo('a.png', Buffer.from('x'), 'image/png');
    expect(from).toHaveBeenCalledWith('documentos');
  });

  it('subirArchivo usa el bucket indicado', async () => {
    await expect(
      service.subirArchivo(
        'a.png',
        Buffer.from('x'),
        'image/png',
        'comprobantes',
      ),
    ).resolves.toBe(true);
    expect(from).toHaveBeenCalledWith('comprobantes');
  });

  it('descargarBuffer usa el bucket indicado', async () => {
    await service.descargarBuffer('a.png', 'comprobantes');
    expect(from).toHaveBeenCalledWith('comprobantes');
  });

  it('descargarBuffer usa el bucket por defecto sin el parámetro', async () => {
    await service.descargarBuffer('a.png');
    expect(from).toHaveBeenCalledWith('documentos');
  });

  it('eliminarArchivo usa el bucket indicado', async () => {
    await service.eliminarArchivo('a.png', 'comprobantes');
    expect(from).toHaveBeenCalledWith('comprobantes');
  });
});
