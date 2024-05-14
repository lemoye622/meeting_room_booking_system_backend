import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

@Injectable()
export class FormatResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    
    const res = context.switchToHttp().getResponse();

    return next.handle().pipe(
      map((data) => {
        return {
          code: res.statusCode,
          message: 'success',
          data,
        };
      }),
    );
  }
}
