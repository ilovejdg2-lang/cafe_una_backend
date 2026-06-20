import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { CamelCaseInterceptor } from './common/camel-case.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.useGlobalInterceptors(new CamelCaseInterceptor());

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: false,
      forbidNonWhitelisted: false,
      skipMissingProperties: true,
    }),
  );

  const port = Number(process.env.PORT ?? 5220);
  await app.listen(port, '0.0.0.0');
}

bootstrap();
