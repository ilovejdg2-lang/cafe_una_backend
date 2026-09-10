import { ConfigService } from '@nestjs/config';

/** Sede fija de visitas y recepción presencial de donaciones. */
export const SEDE_FINCA_NOMBRE_DEFAULT = 'Finca Experimental Santa Lucía';

/** Misma URL que la sección homeLocation del CMS / seed. */
export const SEDE_FINCA_MAPS_URL_DEFAULT =
  'https://www.google.com/maps/place/Finca+Experimental+Santa+Luc%C3%ADa+-+Universidad+Nacional/@10.0232398,-84.11705,17z/data=!4m14!1m7!3m6!1s0x8fa0faa5f69f073d:0x656b2da8f85723be!2sFinca+Experimental+Santa+Luc%C3%ADa+-+Universidad+Nacional!8m2!3d10.0232346!4d-84.1121791!16s%2Fg%2F1pp2tywc7!3m5!1s0x8fa0faa5f69f073d:0x656b2da8f85723be!8m2!3d10.0232346!4d-84.1121791!16s%2Fg%2F1pp2tywc7?entry=ttu';

export type SedeFinca = {
  nombre: string;
  mapsUrl: string;
};

export function resolverSedeFinca(config: ConfigService): SedeFinca {
  const nombre =
    config.get<string>('SEDE_FINCA_NOMBRE')?.trim() || SEDE_FINCA_NOMBRE_DEFAULT;
  const mapsUrl =
    config.get<string>('SEDE_FINCA_MAPS_URL')?.trim() ||
    SEDE_FINCA_MAPS_URL_DEFAULT;
  return { nombre, mapsUrl };
}
