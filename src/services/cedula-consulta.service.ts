import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface CedulaConsultaResponse {
  Cedula: string;
  Nombre: string;
}

@Injectable()
export class CedulaConsultaService {
  private readonly logger = new Logger(CedulaConsultaService.name);

  constructor(private readonly config: ConfigService) {}

  async consultar(numero: string): Promise<CedulaConsultaResponse | null> {
    const cedula = this.normalizarCedula(numero);
    if (!cedula) {
      throw new Error('Ingrese una cédula válida de 9 dígitos.');
    }

    const provider = (this.config.get<string>('CEDULA_PROVIDER') ?? 'GoMeta').trim();

    switch (provider.toLowerCase()) {
      case 'gometa':
        return this.consultarGoMeta(cedula);
      case 'none':
      case '':
        throw new Error(
          'La consulta de cédula no está configurada. Agregue CedulaConsulta en appsettings.',
        );
      default:
        throw new Error(`Proveedor de cédula desconocido: ${provider}.`);
    }
  }

  private normalizarCedula(numero: string): string | null {
    const soloDigitos = (numero ?? '').replace(/\D/g, '');
    return soloDigitos.length === 9 ? soloDigitos : null;
  }

  private async consultarGoMeta(cedula: string): Promise<CedulaConsultaResponse | null> {
    const baseUrl = (
      this.config.get<string>('CEDULA_GOMETA_URL') ??
      'https://apis.gometa.org/cedulas'
    ).replace(/\/$/, '');

    const url = `${baseUrl}/${encodeURIComponent(cedula)}`;

    try {
      const response = await axios.get(url, {
        headers: { Accept: 'application/json' },
        validateStatus: () => true,
      });

      if (response.status === 429) {
        throw new Error(
          'Demasiadas consultas de cédula. Espere unos minutos e intente de nuevo.',
        );
      }
      if (response.status === 404) return null;
      if (response.status < 200 || response.status >= 300) {
        this.logger.warn(`GoMeta respondió ${response.status}: ${JSON.stringify(response.data)}`);
        throw new Error('No se pudo consultar la cédula en este momento.');
      }

      return this.mapearRespuestaGoMeta(response.data, cedula);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Demasiadas consultas')) {
        throw error;
      }
      if (axios.isAxiosError(error)) {
        throw new Error('No se pudo consultar la cédula en este momento.');
      }
      throw error;
    }
  }

  private mapearRespuestaGoMeta(
    root: Record<string, unknown>,
    cedula: string,
  ): CedulaConsultaResponse | null {
    const resultcount = root['resultcount'];
    if (typeof resultcount === 'number' && resultcount === 0) return null;

    const results = root['results'];
    if (!Array.isArray(results) || results.length === 0) {
      const nombreRaiz = this.obtenerTexto(root, 'nombre');
      if (!nombreRaiz) return null;
      return {
        Cedula: this.obtenerTexto(root, 'cedula') ?? cedula,
        Nombre: this.formatearNombreDesdeApellidosPrimero(nombreRaiz),
      };
    }

    const persona = this.seleccionarPersonaFisicaGoMeta(results, cedula);
    if (!persona) return null;

    let nombre = this.construirNombre(
      this.obtenerTexto(persona, 'firstname') ??
        this.obtenerTexto(persona, 'firstname1'),
      this.obtenerTexto(persona, 'lastname1'),
      this.obtenerTexto(persona, 'lastname2'),
    );

    if (!nombre) {
      const nombreCompleto =
        this.obtenerTexto(persona, 'fullname') ?? this.obtenerTexto(root, 'nombre');
      if (!nombreCompleto) return null;
      nombre = this.formatearNombreDesdeApellidosPrimero(nombreCompleto);
    }

    return {
      Cedula: this.obtenerTexto(persona, 'cedula') ?? this.obtenerTexto(root, 'cedula') ?? cedula,
      Nombre: nombre,
    };
  }

  private seleccionarPersonaFisicaGoMeta(
    results: unknown[],
    cedula: string,
  ): Record<string, unknown> | null {
    let coincidenciaExacta: Record<string, unknown> | null = null;
    let primeraFisica: Record<string, unknown> | null = null;

    for (const item of results) {
      if (!item || typeof item !== 'object') continue;
      const record = item as Record<string, unknown>;
      const tipo = this.obtenerTexto(record, 'guess_type') ?? this.obtenerTexto(record, 'type');
      const esFisica =
        tipo?.toUpperCase() === 'FISICA' || tipo?.toUpperCase() === 'F';

      if (!esFisica) continue;
      if (!primeraFisica) primeraFisica = record;

      const cedulaResultado = this.obtenerTexto(record, 'cedula');
      if (cedulaResultado === cedula) {
        coincidenciaExacta = record;
        break;
      }
    }

    return coincidenciaExacta ?? primeraFisica;
  }

  private formatearNombreDesdeApellidosPrimero(valor: string): string {
    const partes = valor.trim().split(/\s+/);
    if (partes.length <= 2) return this.formatearNombre(valor);
    const apellidos = partes.slice(0, 2);
    const nombres = partes.slice(2);
    return this.construirNombre(nombres.join(' '), apellidos[0], apellidos[1]);
  }

  private obtenerTexto(element: Record<string, unknown>, propertyName: string): string | null {
    const value = element[propertyName];
    if (value == null) return null;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed ? trimmed : null;
    }
    if (typeof value === 'number') return String(value);
    return null;
  }

  private construirNombre(
    nombre?: string | null,
    apellido1?: string | null,
    apellido2?: string | null,
  ): string {
    return [nombre, apellido1, apellido2]
      .filter((p) => p?.trim())
      .map((p) => this.formatearNombre(p!))
      .join(' ');
  }

  private formatearNombre(valor: string): string {
    return valor
      .trim()
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
