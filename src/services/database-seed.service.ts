import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { hashearContrasena } from '../common/password.util';
import { EnlaceSitio } from '../entities/enlace-sitio.entity';
import { GaleriaInstitucionalItem } from '../entities/galeria-institucional-item.entity';
import { HeroPrincipal } from '../entities/hero-principal.entity';
import { InformacionFooter } from '../entities/informacion-footer.entity';
import { InformacionNavbar } from '../entities/informacion-navbar.entity';
import { Producto } from '../entities/producto.entity';
import { TarjetaInicio } from '../entities/tarjeta-inicio.entity';
import { TextoInstitucional } from '../entities/texto-institucional.entity';
import { Usuario } from '../entities/usuario.entity';
import { USUARIOS_VIEJOS } from './usuarios-seed.data';

const HERO_BG =
  'https://scontent.fsjo10-1.fna.fbcdn.net/v/t39.30808-6/728555734_1705286574533827_8444639169449344865_n.jpg?stp=dst-jpg_tt6&cstp=mx1440x1440&ctp=s1440x1440&_nc_cat=102&ccb=1-7&_nc_sid=127cfc&_nc_ohc=MkaXM3pLHWEQ7kNvwH3EtSU&_nc_oc=AdozuZXrU3ctXcd_a_STnl1g-ov6l-EAV3_Xhl_19SVttyDYv6eHVz8TNTxNyQbKNGM&_nc_zt=23&_nc_ht=scontent.fsjo10-1.fna&_nc_gid=FMzouMkLSzaE09g646mBGg&_nc_ss=7b2a8&oh=00_AQFaV6_DqsU0EDPXnet4BrJ-FRMp24Zn3MTo72eFL09y9g&oe=6A713262';

const MAPS_URL =
  'https://www.google.com/maps/place/Finca+Experimental+Santa+Luc%C3%ADa+-+Universidad+Nacional/@10.0232398,-84.11705,17z/data=!4m14!1m7!3m6!1s0x8fa0faa5f69f073d:0x656b2da8f85723be!2sFinca+Experimental+Santa+Luc%C3%ADa+-+Universidad+Nacional!8m2!3d10.0232346!4d-84.1121791!16s%2Fg%2F1pp2tywc7!3m5!1s0x8fa0faa5f69f073d:0x656b2da8f85723be!8m2!3d10.0232346!4d-84.1121791!16s%2Fg%2F1pp2tywc7?entry=ttu';

const LOGO_ROJO = 'https://i.ibb.co/VpkqtVrY/LOGOTIPO-CAFE-UNA-CAFE-ROJO-2.webp';
const LOGO_CLARO = 'https://i.ibb.co/cstTcyr/LOGOTIPO-CAFE-UNA-BLANCO-ROJO-2.webp';

@Injectable()
export class DatabaseSeedService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseSeedService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit(): Promise<void> {
    await this.sembrarDatosViejos();
  }

  private async sembrarDatosViejos(): Promise<void> {
    await this.sembrarUsuarios();
    await this.sembrarHero();
    await this.sembrarTextos();
    await this.sembrarTarjetas();
    await this.sembrarNavbarFooter();
    await this.sembrarEnlaces();
    await this.sembrarProductos();
    await this.sembrarGaleria();
    this.logger.log('Datos viejos de Café UNA restaurados.');
  }

  private async sembrarUsuarios(): Promise<void> {
    const repo = this.dataSource.getRepository(Usuario);
    await repo.createQueryBuilder().delete().from(Usuario).execute();

    const hashes = new Map<string, string>();
    for (const cuenta of USUARIOS_VIEJOS) {
      if (!hashes.has(cuenta.password)) {
        hashes.set(cuenta.password, await hashearContrasena(cuenta.password));
      }
    }

    for (const cuenta of USUARIOS_VIEJOS) {
      await repo.save(
        repo.create({
          Id: cuenta.id,
          Nombre: cuenta.nombre,
          Correo: cuenta.correo,
          PasswordHash: hashes.get(cuenta.password)!,
          Estado: cuenta.estado,
          Roles: [...cuenta.roles],
          FotoPerfilUrl: cuenta.fotoPerfilUrl,
          FotoBannerUrl: cuenta.fotoBannerUrl,
          FotoPerfilPosicion: cuenta.fotoPerfilPosicion,
          FotoBannerPosicion: cuenta.fotoBannerPosicion,
        }),
      );
    }

    await this.dataSource.query('ALTER TABLE usuarios AUTO_INCREMENT = 15');
  }

  private async sembrarHero(): Promise<void> {
    const repo = this.dataSource.getRepository(HeroPrincipal);
    let hero = await repo.findOne({ where: { Id: 1 } });
    if (!hero) hero = repo.create({ Id: 1 });
    hero.Eyebrow = 'Artesanal & orgánico';
    hero.Title = 'El mejor café para el universitario';
    hero.Subtitle = 'Ven a deleitarte con este café tan espectacular';
    hero.PrimaryButtonText = 'Ver productos';
    hero.PrimaryButtonUrl = '/productos';
    hero.ButtonText = 'Conócenos';
    hero.ButtonUrl = '/AboutUs';
    hero.BackgroundImage = HERO_BG;
    await repo.save(hero);
  }

  private async sembrarTextos(): Promise<void> {
    const repo = this.dataSource.getRepository(TextoInstitucional);
    const textos: Partial<TextoInstitucional>[] = [
      {
        Clave: 'historia',
        Title: 'Historia',
        Description:
          'Café UNA, más de una década de tradición, calidad y sostenibilidad. ¡Disfruta el auténtico sabor de Costa Rica!\nEste café es producido por la Escuela de Ciencias Agrarias de la Universidad Nacional (ECA-UNA). Tiene un empaque diseñado por Arturo Rodríguez Segura, egresado de la Escuela de Arte y Comunicación Visual. Este diseño representa a Heredia como ciudad universitaria, con sus verdes montañas y cafetales, donde se produce el aromático café por manos de estudiantes, docentes y personas trabajadoras del campo, con un alto contenido de responsabilidad ambiental y social.',
      },
      {
        Clave: 'mission',
        Title: 'Misión',
        Description: 'Lograr que la gente se enamore del café',
      },
      {
        Clave: 'vision',
        Title: 'Visión',
        Description: 'Tenemos la visión de que en unos años esto triunfará',
      },
      {
        Clave: 'homeSpotlight',
        Title: 'Conocé más sobre Café UNA',
        Description:
          'Descubrí nuestra historia, propósito y el impacto que construimos junto a productores locales y la comunidad universitaria.',
        Image:
          'https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=900&q=80',
        LinkUrl: '/AboutUs',
        LinkText: 'Conoce nuestra historia completa',
      },
      {
        Clave: 'homeFeatured',
        Title: 'Descubrí nuestra selección de cafés',
        Description:
          'Explorá todos nuestros productos y elegí el café que mejor encaje con tu gusto, tu rutina y tu forma de disfrutarlo.',
        LinkUrl: '/productos',
        LinkText: 'Conoce nuestro catalogo',
      },
      {
        Clave: 'homeIniciativas',
        Eyebrow: 'Participá con nosotros',
        Title: 'Cada aporte, visita o colaboración deja una huella especial.',
        Description:
          'Elegí cómo querés involucrarte con el Café UNA y completá el formulario correspondiente.',
      },
      {
        Clave: 'homeLocation',
        Eyebrow: 'Nuestra ubicacion',
        Title: 'Visitanos en la Finca Experimental Santa Lucia',
        Description:
          'Estamos en Heredia, Barva. Abrilo en Google Maps para ver la ruta y llegar con facilidad.',
        LinkUrl: MAPS_URL,
        LinkText: 'Ver en Google Maps',
      },
    ];

    for (const texto of textos) {
      let actual = await repo.findOne({ where: { Clave: texto.Clave } });
      if (!actual) actual = repo.create({ Clave: texto.Clave });
      actual.Eyebrow = texto.Eyebrow ?? null;
      actual.Title = texto.Title ?? '';
      actual.Description = texto.Description ?? '';
      actual.Image = texto.Image ?? null;
      actual.LinkUrl = texto.LinkUrl ?? null;
      actual.LinkText = texto.LinkText ?? null;
      await repo.save(actual);
    }
  }

  private async sembrarTarjetas(): Promise<void> {
    const repo = this.dataSource.getRepository(TarjetaInicio);
    const tarjetas: Partial<TarjetaInicio>[] = [
      {
        Clave: 'donaciones',
        Etiqueta: 'Donaciones',
        Titulo: 'Cada aporte transforma una vida',
        Descripcion:
          'Tu contribución financia iniciativas sostenibles, investigaciones y programas de bienestar que impactan a toda la comunidad universitaria.',
        Ruta: null,
        TextoBoton: 'Formulario',
        Orden: 1,
      },
      {
        Clave: 'visitas',
        Etiqueta: 'Visitas',
        Titulo: 'Conocé el corazón del proyecto',
        Descripcion:
          'Agendá una visita guiada a nuestras instalaciones y viví de cerca la experiencia del Café UNA, sus cultivos y su gente.',
        Ruta: null,
        TextoBoton: 'Formulario',
        Orden: 2,
      },
      {
        Clave: 'voluntariado',
        Etiqueta: 'Voluntariado',
        Titulo: 'Sumá tu energía a nuestra misión',
        Descripcion:
          'Formá parte del equipo de voluntarios que sostiene las actividades del Café UNA. Tu tiempo y dedicación dejan huella.',
        Ruta: '/voluntariado/solicitar',
        TextoBoton: 'Formulario',
        Orden: 3,
      },
    ];

    for (const tarjeta of tarjetas) {
      let actual = await repo.findOne({ where: { Clave: tarjeta.Clave } });
      if (!actual) actual = repo.create({ Clave: tarjeta.Clave });
      Object.assign(actual, tarjeta);
      await repo.save(actual);
    }
  }

  private async sembrarNavbarFooter(): Promise<void> {
    const navbarRepo = this.dataSource.getRepository(InformacionNavbar);
    let navbar = await navbarRepo.findOne({ where: { Id: 1 } });
    if (!navbar) navbar = navbarRepo.create({ Id: 1 });
    navbar.LogoUrl = LOGO_ROJO;
    navbar.LogoClaroUrl = LOGO_CLARO;
    await navbarRepo.save(navbar);

    const footerRepo = this.dataSource.getRepository(InformacionFooter);
    let footer = await footerRepo.findOne({ where: { Id: 1 } });
    if (!footer) footer = footerRepo.create({ Id: 1 });
    footer.LogoUrl = LOGO_ROJO;
    footer.LogoClaroUrl = LOGO_CLARO;
    footer.FraseMarca = 'Un despertar al placer sensorial';
    footer.Telefono = '84848693';
    footer.Correo = 'cafeuna@una.cr';
    footer.FacebookUrl = 'https://www.facebook.com/profile.php?id=100051575025767';
    footer.InstagramUrl =
      'https://www.instagram.com/cafeuna_?igsh=MXdjZnNheWl0ajU1ZQ==';
    footer.MapsUrl = MAPS_URL;
    footer.TextoCopyright = '© 2026 Cafe UNA. Todos los derechos reservados.';
    await footerRepo.save(footer);
  }

  private async sembrarEnlaces(): Promise<void> {
    const repo = this.dataSource.getRepository(EnlaceSitio);
    await repo.clear();
    await repo.save([
      repo.create({
        Etiqueta: 'Sobre nosotros',
        Ruta: '/AboutUs',
        Seccion: 'Navbar',
        Orden: 1,
        AbrirEnNuevaPestana: false,
      }),
      repo.create({
        Etiqueta: 'Productos',
        Ruta: '/productos',
        Seccion: 'Navbar',
        Orden: 2,
        AbrirEnNuevaPestana: false,
      }),
      repo.create({
        Etiqueta: 'Voluntariado',
        Ruta: '/voluntariado/solicitar',
        Seccion: 'Navbar',
        Orden: 3,
        AbrirEnNuevaPestana: false,
      }),
      repo.create({
        Etiqueta: 'Nuestra Historia',
        Ruta: '/AboutUs',
        Seccion: 'FooterExplorar',
        Orden: 1,
        AbrirEnNuevaPestana: false,
      }),
      repo.create({
        Etiqueta: 'Tienda Online',
        Ruta: '/productos',
        Seccion: 'FooterExplorar',
        Orden: 2,
        AbrirEnNuevaPestana: false,
      }),
      repo.create({
        Etiqueta: 'Voluntariado',
        Ruta: '/voluntariado/solicitar',
        Seccion: 'FooterExplorar',
        Orden: 3,
        AbrirEnNuevaPestana: false,
      }),
      repo.create({
        Etiqueta: 'Mi Cuenta',
        Ruta: '/login',
        Seccion: 'FooterExplorar',
        Orden: 4,
        AbrirEnNuevaPestana: false,
      }),
    ]);
  }

  private async sembrarProductos(): Promise<void> {
    const repo = this.dataSource.getRepository(Producto);
    await repo.clear();
    await repo.save([
      repo.create({
        Nombre: 'Cafe de prueba',
        Descripcion: 'Descripcion de prueba',
        Imagen:
          'https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=900&q=80',
        PrecioNormal: '5000.00',
        PrecioConIVA: '5650.00',
        Stock: 0,
        Estado: 'Habilitado',
        Peso: '500g',
        EsDestacado: false,
      }),
      repo.create({
        Nombre: 'cafe otro',
        Descripcion: 'lorem ipsum blablablabla',
        Imagen:
          'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80',
        PrecioNormal: '3000.00',
        PrecioConIVA: '3390.00',
        Stock: 9,
        Estado: 'Habilitado',
        Peso: '1 kg',
        EsDestacado: true,
      }),
      repo.create({
        Nombre: 'Cafe Tarrazu Premium',
        Descripcion:
          'Granos seleccionados de la zona de Los Santos, con notas de chocolate y caramelo. Tostado medio para resaltar su dulzura natural.',
        Imagen:
          'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=900&q=80',
        PrecioNormal: '5200.00',
        PrecioConIVA: '5876.00',
        Stock: 19,
        Estado: 'Habilitado',
        Peso: '250g',
        EsDestacado: true,
      }),
      repo.create({
        Nombre: 'Cafe Especialidad Altura',
        Descripcion:
          'Mezcla de especialidad ideal para metodos de filtrado. Perfil aromatico con notas citricas y un cuerpo suave en taza.',
        Imagen:
          'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=900&q=80',
        PrecioNormal: '4800.00',
        PrecioConIVA: '5424.00',
        Stock: 19,
        Estado: 'Habilitado',
        Peso: '250g',
        EsDestacado: true,
      }),
      repo.create({
        Nombre: 'Cafecito tostado',
        Descripcion: 'rico café',
        Imagen: '',
        PrecioNormal: '1000.00',
        PrecioConIVA: '1130.00',
        Stock: 99,
        Estado: 'Habilitado',
        Peso: '1kg',
        EsDestacado: false,
      }),
    ]);
  }

  private async sembrarGaleria(): Promise<void> {
    const repo = this.dataSource.getRepository(GaleriaInstitucionalItem);
    await repo.clear();
    await repo.save([
      repo.create({
        Title: 'feria',
        Image:
          'https://scontent.fsjo10-1.fna.fbcdn.net/v/t39.30808-6/652974090_1611139800615172_3886803742183756023_n.jpg?stp=dst-jpg_tt6&cstp=mx1440x1440&ctp=s1440x1440&_nc_cat=104&ccb=1-7&_nc_sid=127cfc&_nc_ohc=Szpd9aGM8IEQ7kNvwFFjBRr&_nc_oc=Ado-5IgY9ZXTX4h6RDPqfk-URjjoQmyMq_P_pWA-1xX9Bj0fVU5_5fhklYSijjlstdA&_nc_zt=23&_nc_ht=scontent.fsjo10-1.fna&_nc_gid=jZvPimBGMpHsMM18ZbpTZg&_nc_ss=7b2a8&oh=00_Af89xwzFGFesnHPM_L67ND8XrMCMJTGq93TVuSfUHRoN0A&oe=6A362C39',
        Orden: 1,
      }),
      repo.create({
        Title: 'Visita de campus liberia al café',
        Image:
          'https://scontent.fsjo10-1.fna.fbcdn.net/v/t39.30808-6/690649547_1658089395920212_2229734757066436813_n.jpg?stp=dst-jpg_tt6&cstp=mx1440x1080&ctp=s720x720&_nc_cat=101&ccb=1-7&_nc_sid=127cfc&_nc_ohc=WhJZZU2XJ-MQ7kNvwE6R1GI&_nc_oc=Adq6ZYNfOEjQXP6chnrc-EKIse4x6anjuQJGAg-jFnh9jTI9sqi_7iXCMlNNKbivHQM&_nc_zt=23&_nc_ht=scontent.fsjo10-1.fna&_nc_gid=01LKRVXwncSiZGAEHDVKuw&_nc_ss=7b2a8&oh=00_Af9HhrJtitw0ZNygS5a8Ab46CqWw4aeivNcM8VKqU8r2OA&oe=6A363AA0',
        Orden: 2,
      }),
      repo.create({
        Title: 'ventaCafé',
        Image:
          'https://scontent.fsjo10-1.fna.fbcdn.net/v/t39.30808-6/698817610_1666124371783381_1715357787503233593_n.jpg?stp=dst-jpg_tt6&cstp=mx1440x1440&ctp=s590x590&_nc_cat=111&ccb=1-7&_nc_sid=127cfc&_nc_ohc=joP6XPI5OiwQ7kNvwG9eBOV&_nc_oc=AdqR45eO8SE1ju44ggw42CAvyFMhbBTxI5cffyMUmgFyiEsy64cv204hdKLS2jIQVGM&_nc_zt=23&_nc_ht=scontent.fsjo10-1.fna&_nc_gid=01LKRVXwncSiZGAEHDVKuw&_nc_ss=7b2a8&oh=00_Af9NI7tMFSgrfbjkLUXwg0_qxzmJ3EdXI20fUaAbOwpf4w&oe=6A363249',
        Orden: 2,
      }),
      repo.create({
        Title: 'dia del agricultor',
        Image:
          'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR1MIldYwITnsAXTuB_YeJErC3f83AyH1JxPA&s',
        Orden: 2,
      }),
      repo.create({
        Title: 'Desgustacion',
        Image:
          'https://scontent.fsjo10-1.fna.fbcdn.net/v/t39.30808-6/490534960_1315729483489540_678424477100206776_n.jpg?stp=dst-jpg_tt6&cstp=mx1152x2048&ctp=s590x590&_nc_cat=106&ccb=1-7&_nc_sid=833d8c&_nc_ohc=ohiBDBzQ-wcQ7kNvwHbnZBi&_nc_oc=AdoR5_S2ikRY0FNaJ8dPNnC3zIs5k8XeR4J-_3rmrt9sZKjeellajKZxccLqBMZfrw8&_nc_zt=23&_nc_ht=scontent.fsjo10-1.fna&_nc_gid=e4xW7DNJ-V6Sd2vCbefR1A&_nc_ss=7b2a8&oh=00_Af_74pVpUN7Rgy_fJ3xOfJmuOrtyfoW53WKFZOsROPOtVA&oe=6A3650EB',
        Orden: 3,
      }),
      repo.create({
        Title: 'Cromas',
        Image:
          'https://scontent.fsjo10-1.fna.fbcdn.net/v/t39.30808-6/489623307_1309989837396838_2438682786355722787_n.jpg?stp=dst-jpg_tt6&cstp=mx492x540&ctp=s492x540&_nc_cat=102&ccb=1-7&_nc_sid=127cfc&_nc_ohc=G8r13-91b9QQ7kNvwH2LOTc&_nc_oc=Adqmzwau6N0OMbPSZdGXNvCimx0jMb22iuUJqY2BHv3bQXmQzXvn8d7O-7OUptIMsO4&_nc_zt=23&_nc_ht=scontent.fsjo10-1.fna&_nc_gid=7-tkDNym620aq8zCK1wPaQ&_nc_ss=7b2a8&oh=00_Af9f5jK05OgD1vaV1_hVw4fqm8F4QPeQumaugSjb-eZ6nw&oe=6A365974',
        Orden: 4,
      }),
    ]);
  }
}
