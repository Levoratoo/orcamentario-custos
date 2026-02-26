import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      response.status(status).json({
        code: (payload as any).code || 'HTTP_ERROR',
        message: (payload as any).message || exception.message,
        details: (payload as any).details,
      });
      return;
    }

    response.status(500).json({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Unexpected error',
    });
  }
}
