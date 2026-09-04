import { NestFactory } from '@nestjs/core';
import type { CustomOrigin } from '@nestjs/common/interfaces/external/cors-options.interface';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { CamelCaseInterceptor } from './common/camel-case.interceptor';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { PascalBodyInterceptor } from './common/pascal-body.interceptor';

function origenPermitido(origen?: string): boolean {
  if (!origen) return true;

  const extra =
    process.env.CORS_ORIGINS?.split(',')
      .map((item) => item.trim())
      .filter(Boolean) ?? [];
  const fijos = ['http://localhost:5173', 'http://127.0.0.1:5173', ...extra];
  if (fijos.includes(origen)) return true;

  try {
    const host = new URL(origen).hostname;
    return host === 'netlify.app' || host.endsWith('.netlify.app');
  } catch {
    return false;
  }
}

const validarOrigen: CustomOrigin = (origen, callback) => {
  callback(null, origenPermitido(origen));
};

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  // Las solicitudes de donación envían fotos como data URLs en JSON.
  // El límite por defecto de Express (100kb) rechaza incluso 1–2 imágenes.
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  // Proformas y uploads solo por endpoints autenticados (no static público).
  app.setGlobalPrefix('api');
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.enableCors({
    origin: validarOrigen,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useGlobalInterceptors(
    new PascalBodyInterceptor(),
    new CamelCaseInterceptor(),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: false,
      forbidNonWhitelisted: false,
      skipMissingProperties: true,
    }),
  );

  const jwtSecret = process.env.JWT_SECRET?.trim();
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error('JWT_SECRET debe existir y tener al menos 32 caracteres.');
  }

  const port = Number(process.env.PORT ?? 5220);
  await app.listen(port, '0.0.0.0');
}

bootstrap();
