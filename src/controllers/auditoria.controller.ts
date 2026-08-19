import { Controller, Get, UseGuards } from '@nestjs/common';
import { RequierePermiso } from '../common/requiere-permiso.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermisosGuard } from '../guards/permisos.guard';
import { AuditoriaService } from '../services/auditoria.service';

@Controller('auditoria')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class AuditoriaController {
  constructor(private readonly auditoriaService: AuditoriaService) {}

  @Get()
  @RequierePermiso('ver_auditoria')
  obtenerAuditoria() {
    return this.auditoriaService.obtenerTodas();
  }
}
