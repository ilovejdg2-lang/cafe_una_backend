import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';
import { asegurarDirectorioUpload } from '../common/upload-paths';
import { Factura } from '../entities/factura.entity';

export const FACTURAS_SUBDIR = 'facturas';

export type ResultadoGeneracionPdf = {
  filename: string;
  filePath: string;
  url: string;
  buffer: Buffer;
};

@Injectable()
export class FacturaPdfService {
  private readonly logger = new Logger(FacturaPdfService.name);

  async generarPdfFactura(factura: Factura): Promise<ResultadoGeneracionPdf> {
    const dir = asegurarDirectorioUpload(FACTURAS_SUBDIR);
    const safeConsecutivo = (factura.NumeroConsecutivo || factura.Id || 'FAC')
      .replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `factura-${safeConsecutivo}.pdf`;
    const filePath = path.join(dir, filename);

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'LETTER',
          margin: 40,
          info: {
            Title: `Factura ${factura.NumeroConsecutivo || factura.Id}`,
            Author: 'Café UNA - Universidad Nacional',
            Subject: 'Factura electrónica de compra',
          },
        });

        const buffers: Buffer[] = [];
        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', (err) => reject(err));

        this.construirContenidoPdf(doc, factura);
        doc.end();
      } catch (err) {
        reject(err);
      }
    });

    // Guardar en disco
    await fs.promises.writeFile(filePath, buffer);
    this.logger.log(`PDF de factura guardado en: ${filePath}`);

    const url = `/facturas/${factura.Id}/pdf`;
    return {
      filename,
      filePath,
      url,
      buffer,
    };
  }

  private construirContenidoPdf(doc: PDFKit.PDFDocument, factura: Factura): void {
    const primaryColor = '#0D1B3E';
    const accentColor = '#C41E3A';
    const textColor = '#2D3748';
    const lightBg = '#F7FAFC';
    const borderColor = '#E2E8F0';

    // 1. Encabezado / Logo institucional
    doc.fillColor(primaryColor).fontSize(22).font('Helvetica-Bold')
      .text('CAFÉ UNA', 40, 40);

    doc.fillColor(accentColor).fontSize(10).font('Helvetica-Bold')
      .text('UNIVERSIDAD NACIONAL DE COSTA RICA', 40, 66);

    doc.fillColor('#718096').fontSize(9).font('Helvetica')
      .text('Finca Experimental Santa Lucía · Barva de Heredia', 40, 80)
      .text('Cédula Jurídica: 4-000-042150 | Tel: (506) 2277-3000', 40, 93)
      .text('Correo: contacto@cafeuna.ac.cr | Web: www.cafeuna.ac.cr', 40, 106);

    // Caja superior derecha: Datos de Factura
    const boxX = 350;
    const boxY = 40;
    const boxW = 220;
    const boxH = 78;

    doc.rect(boxX, boxY, boxW, boxH).fillAndStroke(lightBg, borderColor);

    doc.fillColor(primaryColor).fontSize(11).font('Helvetica-Bold')
      .text('FACTURA DE COMPRA', boxX + 12, boxY + 10);

    doc.fillColor(accentColor).fontSize(12).font('Helvetica-Bold')
      .text(factura.NumeroConsecutivo || factura.Id, boxX + 12, boxY + 26);

    const fechaFmt = factura.FechaEmision
      ? new Date(factura.FechaEmision).toLocaleString('es-CR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })
      : new Date().toLocaleDateString('es-CR');

    doc.fillColor(textColor).fontSize(9).font('Helvetica')
      .text(`Fecha: ${fechaFmt}`, boxX + 12, boxY + 45)
      .text(`Estado: ${factura.Estado || 'Emitida'}`, boxX + 12, boxY + 58);

    // Línea separadora decorativa
    doc.rect(40, 126, 530, 2).fill(accentColor);

    // 2. Información del Cliente y de la Orden
    const clienteY = 140;
    doc.rect(40, clienteY, 530, 52).fillAndStroke(lightBg, borderColor);

    const compra = factura.Compra;
    const clienteNombre = compra?.ClienteNombre || 'Cliente General';
    const clienteCorreo = compra?.ClienteCorreo || 'No especificado';
    const numeroOrden = compra?.Numero || 'N/A';
    const metodoPago = compra?.MetodoPago || 'Comprobante / Transferencia';

    doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold')
      .text('DATOS DEL CLIENTE', 52, clienteY + 8);
    doc.fillColor(textColor).fontSize(9).font('Helvetica')
      .text(`Nombre: ${clienteNombre}`, 52, clienteY + 22)
      .text(`Correo: ${clienteCorreo}`, 52, clienteY + 36);

    doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold')
      .text('DETALLE DEL PEDIDO', 320, clienteY + 8);
    doc.fillColor(textColor).fontSize(9).font('Helvetica')
      .text(`N° de Pedido: ${numeroOrden}`, 320, clienteY + 22)
      .text(`Método de Pago: ${metodoPago}`, 320, clienteY + 36);

    // 3. Tabla de Artículos
    let tableY = 208;
    const colX = { desc: 40, cant: 320, precio: 390, subtotal: 480 };
    const colW = { desc: 270, cant: 60, precio: 80, subtotal: 90 };

    // Encabezado de la tabla
    doc.rect(40, tableY, 530, 22).fill(primaryColor);
    doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold')
      .text('DESCRIPCIÓN DEL PRODUCTO', colX.desc + 8, tableY + 6)
      .text('CANT.', colX.cant, tableY + 6, { width: colW.cant, align: 'center' })
      .text('PRECIO UNIT.', colX.precio, tableY + 6, { width: colW.precio, align: 'right' })
      .text('SUBTOTAL', colX.subtotal - 8, tableY + 6, { width: colW.subtotal, align: 'right' });

    tableY += 22;

    const items = factura.Items || [];
    let isEven = false;

    for (const item of items) {
      if (tableY > 660) {
        doc.addPage();
        tableY = 40;
      }

      const rowH = 20;
      if (isEven) {
        doc.rect(40, tableY, 530, rowH).fill(lightBg);
      }
      isEven = !isEven;

      const precio = Number(item.PrecioUnitario || 0);
      const sub = Number(item.Subtotal || 0);

      doc.fillColor(textColor).fontSize(9).font('Helvetica')
        .text(item.Descripcion || 'Artículo de compra', colX.desc + 8, tableY + 5, {
          width: colW.desc,
          ellipsis: true,
        })
        .text(String(item.Cantidad || 1), colX.cant, tableY + 5, {
          width: colW.cant,
          align: 'center',
        })
        .text(`CRC ${precio.toLocaleString('es-CR', { minimumFractionDigits: 2 })}`, colX.precio, tableY + 5, {
          width: colW.precio,
          align: 'right',
        })
        .text(`CRC ${sub.toLocaleString('es-CR', { minimumFractionDigits: 2 })}`, colX.subtotal - 8, tableY + 5, {
          width: colW.subtotal,
          align: 'right',
        });

      doc.rect(40, tableY + rowH - 1, 530, 0.5).fill(borderColor);
      tableY += rowH;
    }

    // 4. Bloque de Totales
    tableY += 15;
    const totalsX = 330;
    const totalsW = 240;
    const totalsY = tableY;

    doc.rect(totalsX, totalsY, totalsW, 70).fillAndStroke(lightBg, borderColor);

    const subtotal = Number(factura.Subtotal || 0);
    const impuestos = Number(factura.Impuestos || 0);
    const total = Number(factura.Total || 0);

    doc.fillColor(textColor).fontSize(9).font('Helvetica')
      .text('Subtotal:', totalsX + 12, totalsY + 10)
      .text(`CRC ${subtotal.toLocaleString('es-CR', { minimumFractionDigits: 2 })}`, totalsX + 100, totalsY + 10, {
        width: 125,
        align: 'right',
      });

    doc.text('I.V.A. (13%):', totalsX + 12, totalsY + 26)
      .text(`CRC ${impuestos.toLocaleString('es-CR', { minimumFractionDigits: 2 })}`, totalsX + 100, totalsY + 26, {
        width: 125,
        align: 'right',
      });

    doc.rect(totalsX + 10, totalsY + 42, totalsW - 20, 1).fill(primaryColor);

    doc.fillColor(primaryColor).fontSize(12).font('Helvetica-Bold')
      .text('TOTAL:', totalsX + 12, totalsY + 48);

    doc.fillColor(accentColor).fontSize(12).font('Helvetica-Bold')
      .text(`CRC ${total.toLocaleString('es-CR', { minimumFractionDigits: 2 })}`, totalsX + 90, totalsY + 48, {
        width: 135,
        align: 'right',
      });

    // 5. Pie de página legal
    const footerY = 700;
    doc.rect(40, footerY, 530, 1).fill(borderColor);
    doc.fillColor('#718096').fontSize(8).font('Helvetica')
      .text(
        'Este documento es un comprobante oficial de compra emitido por Café UNA en el marco del programa de extensión universitaria.',
        40,
        footerY + 8,
        { width: 530, align: 'center' },
      )
      .text(
        '¡Gracias por contribuir con la Finca Experimental Santa Lucía y la educación superior pública!',
        40,
        footerY + 20,
        { width: 530, align: 'center' },
      );
  }
}
