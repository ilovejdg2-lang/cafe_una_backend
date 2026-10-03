import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HistoriaCompleta } from '../entities/historia-completa.entity';

const ID_UNICO = 1;
const TIPOS_BLOQUE = ['p', 'h3', 'cita', 'foto', 'mapa', 'compost'] as const;
type TipoBloque = (typeof TIPOS_BLOQUE)[number];

export type HistoriaBloque = {
  tipo: TipoBloque;
  texto: string;
  autor: string;
  src: string;
  pie: string;
};

export type HistoriaCompletaContenido = {
  portada: {
    eyebrow: string;
    titulo: string;
    subtitulo: string;
    autora: string;
    anio: string;
    foto: string;
    mapa: string;
    pieMapa: string;
    cierre: string;
  };
  cifras: { valor: string; texto: string }[];
  hitos: { anio: string; texto: string }[];
  compost: { anio: string; kg: number }[];
  capitulos: { id: string; titulo: string; bloques: HistoriaBloque[] }[];
};

type Dict = Record<string, unknown>;

function obj(valor: unknown): Dict {
  return valor && typeof valor === 'object' && !Array.isArray(valor) ? (valor as Dict) : {};
}

function lista(valor: unknown, max: number): Dict[] {
  return (Array.isArray(valor) ? valor : []).slice(0, max).map(obj);
}

function texto(valor: unknown, max: number): string {
  return String(valor ?? '')
    .trim()
    .slice(0, max);
}

function slug(valor: string, indice: number): string {
  const base = valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base || `capitulo-${indice + 1}`;
}

function sanitizarBloque(item: Dict): HistoriaBloque | null {
  const tipo = String(item.tipo ?? 'p') as TipoBloque;
  if (!TIPOS_BLOQUE.includes(tipo)) return null;
  const bloque: HistoriaBloque = {
    tipo,
    texto: texto(item.texto, 8000),
    autor: texto(item.autor, 300),
    src: texto(item.src, 1000),
    pie: texto(item.pie, 500),
  };
  if ((tipo === 'p' || tipo === 'h3' || tipo === 'cita') && !bloque.texto) return null;
  if (tipo === 'foto' && !bloque.src) return null;
  return bloque;
}

export function sanitizarHistoriaCompleta(body: unknown): HistoriaCompletaContenido {
  const raiz = obj(body);
  const portada = obj(raiz.portada);

  const titulo = texto(portada.titulo, 200);
  if (!titulo) throw new BadRequestException('El título de la historia es obligatorio.');

  const usados = new Set<string>();
  const capitulos = lista(raiz.capitulos, 30)
    .map((capitulo, indice) => {
      const tituloCapitulo = texto(capitulo.titulo, 200);
      let id = slug(texto(capitulo.id, 60) || tituloCapitulo, indice);
      while (usados.has(id)) id = `${id}-${indice + 1}`;
      usados.add(id);
      return {
        id,
        titulo: tituloCapitulo,
        bloques: lista(capitulo.bloques, 200)
          .map(sanitizarBloque)
          .filter((bloque): bloque is HistoriaBloque => bloque !== null),
      };
    })
    .filter((capitulo) => capitulo.titulo);

  return {
    portada: {
      eyebrow: texto(portada.eyebrow, 120),
      titulo,
      subtitulo: texto(portada.subtitulo, 500),
      autora: texto(portada.autora, 200),
      anio: texto(portada.anio, 20),
      foto: texto(portada.foto, 1000),
      mapa: texto(portada.mapa, 1000),
      pieMapa: texto(portada.pieMapa, 500),
      cierre: texto(portada.cierre, 1000),
    },
    cifras: lista(raiz.cifras, 20)
      .map((c) => ({ valor: texto(c.valor, 40), texto: texto(c.texto, 300) }))
      .filter((c) => c.valor),
    hitos: lista(raiz.hitos, 60)
      .map((h) => ({ anio: texto(h.anio, 20), texto: texto(h.texto, 500) }))
      .filter((h) => h.anio && h.texto),
    compost: lista(raiz.compost, 30)
      .map((c) => ({ anio: texto(c.anio, 20), kg: Math.max(0, Number(c.kg) || 0) }))
      .filter((c) => c.anio),
    capitulos,
  };
}

@Injectable()
export class HistoriaCompletaService {
  constructor(
    @InjectRepository(HistoriaCompleta)
    private readonly repo: Repository<HistoriaCompleta>,
  ) {}

  async obtener(): Promise<Dict | null> {
    const fila = await this.repo.findOne({ where: { Id: ID_UNICO } });
    return fila?.Contenido ?? null;
  }

  async guardar(body: unknown): Promise<HistoriaCompletaContenido> {
    const contenido = sanitizarHistoriaCompleta(body);
    await this.repo.save({
      Id: ID_UNICO,
      Contenido: contenido,
      ActualizadoEn: new Date(),
    });
    return contenido;
  }
}
