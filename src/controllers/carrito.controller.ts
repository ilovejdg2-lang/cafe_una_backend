import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtUsuario } from '../common/permisos';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CarritoService } from '../services/carrito.service';

/** CLI-P08: carrito guardado por cuenta; solo el dueño del JWT lo lee o reemplaza. */
@Controller('carrito')
@UseGuards(JwtAuthGuard)
export class CarritoController {
  constructor(private readonly carritoService: CarritoService) {}

  @Get()
  listar(@Req() req: Request & { user: JwtUsuario }) {
    return this.carritoService.listar(req.user.userId);
  }

  @Put()
  reemplazar(
    @Req() req: Request & { user: JwtUsuario },
    @Body() body: unknown,
  ) {
    return this.carritoService.reemplazar(req.user.userId, body);
  }
}
