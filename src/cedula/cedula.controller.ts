import {
  BadRequestException,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CedulaConsultaService } from './cedula-consulta.service';

@Controller('cedula')
export class CedulaController {
  constructor(private readonly cedulaConsultaService: CedulaConsultaService) {}

  @Get(':numero')
  async consultar(@Param('numero') numero: string) {
    try {
      const resultado = await this.cedulaConsultaService.consultar(numero);
      if (!resultado) {
        throw new NotFoundException({
          message: 'No se encontraron datos para esa cédula.',
        });
      }
      return resultado;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ServiceUnavailableException ||
        error instanceof HttpException
      ) {
        throw error;
      }
      if (error instanceof Error) {
        if (
          error.message.includes('Espere') ||
          error.message.includes('Demasiadas consultas')
        ) {
          throw new HttpException({ message: error.message }, HttpStatus.TOO_MANY_REQUESTS);
        }
        if (error.message.includes('9 dígitos')) {
          throw new BadRequestException({ message: error.message });
        }
        throw new ServiceUnavailableException({ message: error.message });
      }
      throw error;
    }
  }
}
