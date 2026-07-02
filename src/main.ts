import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AppConfig } from './config/config.type';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const configService = app.get(ConfigService<AppConfig, true>);
  const apiPrefix = configService.get('app.apiPrefix', { infer: true });
  const port = configService.get('app.port', { infer: true });
  const corsOrigin = configService.get('app.corsOrigin', { infer: true });

  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.enableCors({ origin: corsOrigin, credentials: true });
  app.setGlobalPrefix(apiPrefix);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Mayan Transfer Experts API')
    .setDescription('API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document);

  await app.listen(port);
}

void bootstrap();
