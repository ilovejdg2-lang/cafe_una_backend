import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      response
        .status(status)
        .json(typeof body === 'object' ? body : { message: body });
      return;
    }

    const message =
      exception instanceof Error ? exception.message : 'Error inesperado.';
    const status = message.toLowerCase().includes('no encontrado')
      ? HttpStatus.NOT_FOUND
      : HttpStatus.BAD_REQUEST;

    response.status(status).json({ message });
  }
}
