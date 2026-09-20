import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Query,
  Req,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { createReadStream } from 'fs';
import { JwtUsuario } from '../common/permisos';
import { RequierePermiso } from '../common/requiere-permiso.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermisosGuard } from '../guards/permisos.guard';
import { FacturasService } from '../services/facturas.service';

@Controller('facturas')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class FacturasController {
  constructor(private readonly facturasService: FacturasService) {}

  @Get('mias')
  @RequierePermiso('ver_historial_compras_propio')
  async listarMias(
    @Req() req: Request & { user: JwtUsuario },
    @Query() query: Record<string, string | undefined>,
  ) {
    if (req.user?.userId == null) {
      throw new BadRequestException('Debés iniciar sesión para consultar tus facturas.');
    }
    return this.facturasService.listarMias(req.user.userId, query);
  }

  @Get('compra/:compraId/pdf')
  @RequierePermiso(
    'ver_historial_compras_propio',
    'ver_historial_compras_clientes',
    'ver_ventas',
  )
  async descargarPdfPorCompra(
    @Param('compraId') compraId: string,
    @Req() req: Request & { user: JwtUsuario },
  ): Promise<StreamableFile> {
    const cid = Number(compraId);
    const factura = await this.facturasService.obtenerPorCompraId(cid);
    this.validarAccesoFactura(factura, req.user);

    const { filePath, filename } =
      await this.facturasService.obtenerRutaArchivoPdf(cid);

    return new StreamableFile(createReadStream(filePath), {
      type: 'application/pdf',
      disposition: `inline; filename="${filename}"`,
    });
  }

  @Get('compra/:compraId')
  @RequierePermiso(
    'ver_historial_compras_propio',
    'ver_historial_compras_clientes',
    'ver_ventas',
  )
  async obtenerPorCompra(
    @Param('compraId') compraId: string,
    @Req() req: Request & { user: JwtUsuario },
  ) {
    const factura = await this.facturasService.obtenerPorCompraId(Number(compraId));
    this.validarAccesoFactura(factura, req.user);
    return factura;
  }

  @Get(':id/pdf')
  @RequierePermiso(
    'ver_historial_compras_propio',
    'ver_historial_compras_clientes',
    'ver_ventas',
  )
  async descargarPdf(
    @Param('id') id: string,
    @Req() req: Request & { user: JwtUsuario },
  ): Promise<StreamableFile> {
    const factura = await this.facturasService.obtenerPorId(id);
    this.validarAccesoFactura(factura, req.user);

    const { filePath, filename } =
      await this.facturasService.obtenerRutaArchivoPdf(id);

    return new StreamableFile(createReadStream(filePath), {
      type: 'application/pdf',
      disposition: `inline; filename="${filename}"`,
    });
  }

  @Get(':id')
  @RequierePermiso(
    'ver_historial_compras_propio',
    'ver_historial_compras_clientes',
    'ver_ventas',
  )
  async obtenerPorId(
    @Param('id') id: string,
    @Req() req: Request & { user: JwtUsuario },
  ) {
    const factura = await this.facturasService.obtenerPorId(id);
    this.validarAccesoFactura(factura, req.user);
    return factura;
  }

  @Get()
  @RequierePermiso('ver_historial_compras_clientes', 'ver_ventas')
  async listarTodas(
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.facturasService.listarTodas(query);
  }

  private validarAccesoFactura(
    factura: { UsuarioId: number | null; Compra?: { UsuarioId: number | null } | null },
    user?: JwtUsuario,
  ): void {
    if (!user) {
      throw new ForbiddenException('No autorizado.');
    }
    const roles = (user.roles ?? []).map((r) => String(r).toLowerCase());
    const esStaff =
      roles.includes('superadmin') ||
      roles.includes('admin') ||
      roles.includes('vendedor');

    if (esStaff) return;

    const propietarioId = factura.UsuarioId ?? factura.Compra?.UsuarioId ?? null;
    if (propietarioId !== user.userId) {
      throw new ForbiddenException('No tenés permiso para ver esta factura.');
    }
  }
}
