import {
  ExecutionContext,
  SetMetadata,
  createParamDecorator,
} from '@nestjs/common';
import { Request } from 'express';

export const RequireLogin = () => SetMetadata('require-login', true);

export const RequirePermission = (...permissions: Array<string>) => SetMetadata('require-permission', permissions);

// 自定义参数装饰器
// UserInfo 装饰器是用来取 user 信息传入 handler 的
// 传入属性名的时候，返回对应的属性值，否则返回全部的 user 信息
export const UserInfo = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (!req.user) {
      return null;
    }
    return data ? req.user[data] : req.user;
  },
);
