import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { existsSync } from 'fs';
import { join } from 'path';
import PDFDocument from 'pdfkit';

const NOMBRE_IMAGEN = 'kit-basico-agronomo.jpg';

@Injectable()
export class VisitasInstructivoPdfService {
  async generarPdfInstructivo(): Promise<Buffer> {
    const rutaImagen = this.resolverRutaImagen();
    if (!rutaImagen) {
      throw new InternalServerErrorException(
        'No se encontró la imagen del instructivo de visitas.',
      );
    }

    return new Promise<Buffer>((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'LETTER',
          margin: 48,
          info: {
            Title: 'Instructivo y Recomendaciones Generales de Visita',
            Author: 'Café UNA - Universidad Nacional de Costa Rica',
            Subject: 'Kit básico de agrónomo y recomendaciones para visitas a finca',
          },
        });

        const buffers: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', (err: Error) => reject(err));

        this.dibujarImagen(doc, rutaImagen);
        doc.addPage();
        this.construirContenido(doc);
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  private dibujarImagen(doc: PDFKit.PDFDocument, rutaImagen: string): void {
    const margen = 24;
    const anchoUtil = doc.page.width - margen * 2;
    const altoUtil = doc.page.height - margen * 2;

    doc.image(rutaImagen, margen, margen, {
      fit: [anchoUtil, altoUtil],
      align: 'center',
      valign: 'center',
    });
  }

  private construirContenido(doc: PDFKit.PDFDocument): void {
    const primaryColor = '#0F172A';
    const accentColor = '#047857';
    const textColor = '#334155';
    const mutedColor = '#64748B';
    const borderColor = '#E2E8F0';

    doc
      .rect(48, 48, 516, 75)
      .fillAndStroke('#F8FAFC', borderColor);

    doc
      .fillColor(accentColor)
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('PROYECTO CAFÉ UNA - UNIVERSIDAD NACIONAL', 64, 62);

    doc
      .fillColor(primaryColor)
      .fontSize(16)
      .font('Helvetica-Bold')
      .text('Instructivo y Recomendaciones Generales de Visita', 64, 78);

    doc
      .fillColor(mutedColor)
      .fontSize(9)
      .font('Helvetica')
      .text(
        'Finca Experimental Santa Lucía | Santa Lucía de Barva, Heredia, Costa Rica',
        64,
        100,
      );

    let y = 145;

    doc
      .fillColor(primaryColor)
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('¡Bienvenidos a la experiencia de campo en Café UNA!', 48, y);

    y += 20;
    doc
      .fillColor(textColor)
      .fontSize(9.5)
      .font('Helvetica')
      .text(
        'Con el objetivo de garantizar una visita segura, enriquecedora y en armonía con las labores agrícolas y de investigación de nuestra finca, solicitamos a todos los participantes tomar en cuenta las siguientes directrices obligatorias antes y durante el recorrido:',
        48,
        y,
        { width: 516, lineGap: 3 },
      );

    y += 50;

    const recomendaciones = [
      {
        titulo: '1. Calzado Cerrado Obligatorio',
        descripcion:
          'Es indispensable el uso de calzado cerrado con suela antideslizante (tenis deportivas, botas de senderismo o botas de hule). Está estrictamente prohibido el ingreso con sandalias, tacones o calzado descubierto por razones de seguridad en terrenos agrícolas irregulares y húmedos.',
      },
      {
        titulo: '2. Hidratación y Vestimenta Cómoda',
        descripcion:
          'El recorrido se realiza en senderos al aire libre y parcelas de cultivo. Se aconseja vestir ropa cómoda y fresca (pantalón largo ligero preferible). Se recomienda llevar botella o termo reutilizable con agua; la finca cuenta con puntos para recarga de agua potable.',
      },
      {
        titulo: '3. Protección Solar y Repelente de Insectos',
        descripcion:
          'Aplicar protector solar y repelente contra insectos antes de iniciar el trayecto. Es altamente recomendable el uso de sombrero, gorra o pañuelo para protegerse de la radiación solar durante la caminata.',
      },
      {
        titulo: '4. Zonas de Parqueo y Logística de Acceso',
        descripcion:
          'La finca cuenta con área de estacionamiento debidamente señalizada para vehículos livianos y espacio reservado para maniobras y desembarque de buses o microbuses. Por favor seguir las instrucciones del personal de seguridad y parqueo al ingresar.',
      },
      {
        titulo: '5. Cuidado del Entorno y Normas de Seguridad',
        descripcion:
          'Permanecer siempre junto al grupo y con el personal facilitador. No cortar hojas ni frutos de café sin autorización. Depositar cualquier residuo en las estaciones de reciclaje y respetar la flora y fauna local.',
      },
    ];

    for (const item of recomendaciones) {
      doc
        .rect(48, y, 516, 56)
        .fillAndStroke('#FFFFFF', borderColor);

      doc
        .fillColor(accentColor)
        .fontSize(10.5)
        .font('Helvetica-Bold')
        .text(item.titulo, 64, y + 10);

      doc
        .fillColor(textColor)
        .fontSize(8.5)
        .font('Helvetica')
        .text(item.descripcion, 64, y + 25, { width: 484, lineGap: 2 });

      y += 66;
    }

    y += 10;
    doc
      .rect(48, y, 516, 44)
      .fillAndStroke('#F1F5F9', '#CBD5E1');

    doc
      .fillColor(primaryColor)
      .fontSize(9)
      .font('Helvetica-Bold')
      .text('Contacto y Coordinación de Visitas:', 64, y + 9);

    doc
      .fillColor(mutedColor)
      .fontSize(8)
      .font('Helvetica')
      .text(
        'Teléfono: +506 2277-3000 | Correo: visitas@cafeuna.ac.cr | Web: https://cafeuna.ac.cr',
        64,
        y + 24,
      );
  }

  private resolverRutaImagen(): string | null {
    const candidatas = [
      join(process.cwd(), 'assets', 'visitas', NOMBRE_IMAGEN),
      join(__dirname, '..', '..', 'assets', 'visitas', NOMBRE_IMAGEN),
      join(__dirname, '..', 'assets', 'visitas', NOMBRE_IMAGEN),
    ];
    return candidatas.find((ruta) => existsSync(ruta)) || null;
  }
}
