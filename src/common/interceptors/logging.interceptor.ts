import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { PinoLogger } from 'nestjs-pino';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(LoggingInterceptor.name);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, originalUrl } = request;
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        this.logger.debug(
          { method, url: originalUrl, durationMs: Date.now() - start },
          'request completed',
        );
      }),
    );
  }
}
