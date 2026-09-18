import { existsSync, mkdirSync } from 'fs';
import { basename, join, relative, resolve, sep } from 'path';

export function nombreArchivoSeguro(filename: string): string {
  const raw = String(filename || '')
    .trim()
    .replace(/\\/g, '/');
  const base = basename(raw);
  if (!base || base === '.' || base === '..') return '';
  return base;
}

export function directorioUpload(subdir: string): string {
  return join(__dirname, '..', '..', 'uploads', subdir);
}

export function asegurarDirectorioUpload(subdir: string): string {
  const dir = directorioUpload(subdir);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function resolverArchivoUpload(
  subdir: string,
  filename: string,
): string | null {
  const safe = nombreArchivoSeguro(filename);
  if (!safe) return null;

  const dirs = [
    directorioUpload(subdir),
    join(process.cwd(), 'uploads', subdir),
    join(process.cwd(), 'cafe_una_backend', 'uploads', subdir),
  ];
  const seen = new Set<string>();

  for (const dir of dirs) {
    const root = resolve(dir);
    if (seen.has(root)) continue;
    seen.add(root);
    const absolute = resolve(root, safe);
    const rel = relative(root, absolute);
    if (!rel || rel.startsWith('..') || rel.includes(`..${sep}`)) continue;
    if (existsSync(absolute)) return absolute;
  }

  return null;
}
