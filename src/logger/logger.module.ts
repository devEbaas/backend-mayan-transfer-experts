import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { AppConfig } from '../config/config.type';

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => {
        const isProduction =
          configService.get('app.nodeEnv', { infer: true }) === 'production';

        return {
          pinoHttp: {
            level: configService.get('log.level', { infer: true }),
            genReqId: (req: { headers: Record<string, unknown> }) =>
              (req.headers['x-request-id'] as string) ?? randomUUID(),
            transport: isProduction
              ? undefined
              : { target: 'pino-pretty', options: { singleLine: true } },
            autoLogging: true,
          },
        };
      },
    }),
  ],
})
export class LoggerModule {}
