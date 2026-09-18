import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { createReadStream, existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join, relative, resolve, sep } from 'path';
import { RequierePermiso } from '../common/requiere-permiso.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermisosGuard } from '../guards/permisos.guard';
import { BODEGA_CENTRAL } from '../services/inventario.service';
import { InventarioService } from '../services/inventario.service';
import { ProductosService } from '../services/productos.service';

const PRODUCTOS_IMAGENES_DIR = join(process.cwd(), 'uploads', 'productos');
const MAX_IMAGEN_BYTES = 10 * 1024 * 1024;
const TIPOS_IMAGEN = new Set(['image/jpeg', 'image/png', 'image/webp']);
const EXTS_IMAGEN = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function asegurarDirectorioImagenes(): void {
  if (!existsSync(PRODUCTOS_IMAGENES_DIR)) {
    mkdirSync(PRODUCTOS_IMAGENES_DIR, { recursive: true });
  }
}

function esImagenProducto(file: {
  mimetype?: string;
  originalname?: string;
}): boolean {
  const mime = (file.mimetype ?? '').toLowerCase();
  const ext = extname(file.originalname ?? '').toLowerCase();
  return TIPOS_IMAGEN.has(mime) || EXTS_IMAGEN.has(ext);
}

function mimePorNombre(filename: string): string {
  const ext = extname(filename).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

@Controller('productos')
export class ProductosController {
  constructor(
    private readonly productosService: ProductosService,
    private readonly inventarioService: InventarioService,
  ) {}

  @Get()
  async obtenerProductos() {
    return this.productosService.obtenerTodosConStockTotal();
  }

  @Get('alertas-stock')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('ver_inventario', 'ver_panel_administrativo')
  listarAlertasStock() {
    return this.productosService.listarAlertasStock();
  }

  @Get('disponibilidad-puntos-venta')
  obtenerDisponibilidadPuntosVenta(@Query('ids') ids?: string) {
    return this.inventarioService.obtenerDisponibilidadPuntosVenta(ids);
  }

  @Post('imagenes')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('crear_productos', 'actualizar_productos')
  @UseInterceptors(
    FileInterceptor('imagen', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          asegurarDirectorioImagenes();
          cb(null, PRODUCTOS_IMAGENES_DIR);
        },
        filename: (_req, file, cb) => {
          const ext = EXTS_IMAGEN.has(extname(file.originalname).toLowerCase())
            ? extname(file.originalname).toLowerCase()
            : '.jpg';
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `producto-${unique}${ext}`);
        },
      }),
      limits: { fileSize: MAX_IMAGEN_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!esImagenProducto(file)) {
          cb(
            new BadRequestException(
              'La imagen debe ser JPG, PNG o WEBP.',
            ) as unknown as Error,
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  subirImagen(
    @UploadedFile()
    file: { filename: string } | undefined,
  ) {
    if (!file?.filename) {
      throw new BadRequestException('Debés adjuntar una imagen.');
    }
    return { url: `/api/productos/imagenes/${file.filename}` };
  }

  @Get('imagenes/:filename')
  servirImagen(@Param('filename') filename: string) {
    if (!/^[A-Za-z0-9._-]+$/.test(filename)) {
      throw new BadRequestException('Nombre de imagen inválido.');
    }
    const root = resolve(PRODUCTOS_IMAGENES_DIR);
    const absolute = resolve(root, filename);
    const rel = relative(root, absolute);
    if (!rel || rel.startsWith('..') || rel.includes(`..${sep}`)) {
      throw new BadRequestException('Ruta de imagen inválida.');
    }
    if (!existsSync(absolute)) {
      throw new NotFoundException('No se encontró la imagen del producto.');
    }
    return new StreamableFile(createReadStream(absolute), {
      type: mimePorNombre(filename),
      disposition: `inline; filename="${filename}"`,
    });
  }

  @Get(':id/stock')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('ver_inventario')
  async obtenerStockDesglosado(@Param('id') id: string) {
    const stock = await this.inventarioService.obtenerStockDesglosadoProducto(id);
    if (!stock) throw new NotFoundException();
    return stock;
  }

  @Get(':id')
  async obtenerProducto(@Param('id') id: string) {
    const producto = await this.productosService.obtenerPorId(id);
    if (!producto) throw new NotFoundException();
    return producto;
  }

  @Post()
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('crear_productos')
  async crearProducto(
    @Body()
    request: {
      Nombre: string;
      Descripcion: string;
      NombreEn?: string;
      DescripcionEn?: string;
      nombreEn?: string;
      descripcionEn?: string;
      Imagen: string;
      PrecioNormal: number;
      Stock: number;
      Estado?: string;
      Peso: string;
      Categoria?: string;
      Subcategoria?: string;
      EsDestacado: boolean;
      StockMinimo?: number;
      stockMinimo?: number;
    },
  ) {
    try {
      return await this.productosService.crear({
        ...request,
        NombreEn: request.NombreEn ?? request.nombreEn,
        DescripcionEn: request.DescripcionEn ?? request.descripcionEn,
        StockMinimo: request.StockMinimo ?? request.stockMinimo,
      });
    } catch (error) {
      throw new BadRequestException({
        message: error instanceof Error ? error.message : 'Error.',
      });
    }
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('actualizar_productos')
  async actualizarProducto(
    @Param('id') id: string,
    @Body()
    cambios: {
      Nombre?: string;
      Descripcion?: string;
      NombreEn?: string;
      DescripcionEn?: string;
      nombreEn?: string;
      descripcionEn?: string;
      Imagen?: string;
      PrecioNormal?: number;
      PrecioConIVA?: number;
      Stock?: number;
      Estado?: string;
      Peso?: string;
      Categoria?: string;
      Subcategoria?: string;
      EsDestacado?: boolean;
      StockMinimo?: number;
      stockMinimo?: number;
    },
  ) {
    try {
      const actualizado = await this.productosService.actualizar(id, {
        ...cambios,
        NombreEn: cambios.NombreEn ?? cambios.nombreEn,
        DescripcionEn: cambios.DescripcionEn ?? cambios.descripcionEn,
        StockMinimo: cambios.StockMinimo ?? cambios.stockMinimo,
      });
      if (!actualizado) throw new NotFoundException();
      return actualizado;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException({
        message: error instanceof Error ? error.message : 'Error.',
      });
    }
  }

  @Put(':id/stock-central')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('actualizar_stock_productos')
  async actualizarStockCentral(
    @Param('id') id: string,
    @Body()
    request: {
      stock?: unknown;
      Stock?: unknown;
      locationCode?: unknown;
      LocationCode?: unknown;
    },
  ) {
    try {
      const requestedLocation =
        request && Object.prototype.hasOwnProperty.call(request, 'locationCode')
          ? request.locationCode
          : request?.LocationCode;
      if (
        requestedLocation !== undefined &&
        requestedLocation !== BODEGA_CENTRAL
      ) {
        throw new BadRequestException(
          'La ruta de stock central solo admite BODEGA_CENTRAL.',
        );
      }

      const stock =
        request && Object.prototype.hasOwnProperty.call(request, 'stock')
          ? request.stock
          : request?.Stock;
      const actualizado = await this.inventarioService.actualizarStockCentral(
        id,
        stock,
      );
      if (!actualizado) throw new NotFoundException();
      return actualizado;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException({
        message: error instanceof Error ? error.message : 'Error.',
      });
    }
  }

  @Post('ajustar-stock')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('actualizar_stock_productos')
  async ajustarStock(@Body() items: { Id: number | string; Units: number }[]) {
    try {
      return await this.productosService.ajustarStock(items);
    } catch (error) {
      throw new BadRequestException({
        message: error instanceof Error ? error.message : 'Error.',
      });
    }
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('inactivar_productos')
  async eliminarProducto(@Param('id') id: string) {
    const deleted = await this.productosService.eliminar(id);
    if (!deleted) throw new NotFoundException();
  }
}
