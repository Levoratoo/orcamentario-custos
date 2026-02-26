import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const response = context.switchToHttp().getResponse();
    if (!response.getHeader('x-request-id')) {
      const request = context.switchToHttp().getRequest();
      if (request?.id) {
        response.setHeader('x-request-id', request.id);
      }
    }
    return next.handle();
  }
}
