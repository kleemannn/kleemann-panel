import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Http');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = isHttp ? exception.getResponse() : { message: 'Internal server error' };

    const reason = extractReason(payload);
    const suffix = reason ? ` — ${reason}` : '';
    if (status >= 500) {
      this.logger.error(
        `${req.method} ${req.url} → ${status}${suffix}`,
        (exception as Error)?.stack ?? String(exception),
      );
    } else {
      this.logger.warn(`${req.method} ${req.url} → ${status}${suffix}`);
    }

    res.status(status).json(
      typeof payload === 'string'
        ? { statusCode: status, message: payload }
        : { statusCode: status, ...(payload as object) },
    );
  }
}

function extractReason(payload: unknown): string | null {
  if (typeof payload === 'string') return payload;
  if (payload && typeof payload === 'object') {
    const m = (payload as { message?: unknown }).message;
    if (typeof m === 'string') return m;
    if (Array.isArray(m)) return m.join(', ');
  }
  return null;
}
