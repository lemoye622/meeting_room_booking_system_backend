import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express'; // 注意是从express引入
import { Observable } from 'rxjs';
import { Permission } from './user/entities/permission.entity';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

interface JwtUserData {
  userId: number;
  username: string;
  roles: Array<string>;
  permissions: Array<Permission>;
}

// typescript 里同名 module 和 interface 会自动合并，可以这样扩展类型
declare module 'express' {
  interface Request {
    user: JwtUserData;
  }
}

@Injectable()
export class LoginGuard implements CanActivate {
  @Inject()
  private reflector: Reflector;

  @Inject(JwtService)
  private jwtService: JwtService;

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {

    const req: Request = context.switchToHttp().getRequest();

    // 用 reflector 从目标 controller 和 handler 上拿到 require-login 的 metadata（元数据） 来判断是否需要登录
    // require-login 元数据键名
    const requireLogin = this.reflector.getAllAndOverride('require-login', [
      context.getClass(), // 返回当前处理的类
      context.getHandler(), // 返回当前处理的方法
    ]);
    // 如果没有 metadata，就是不需要登录
    if (!requireLogin) {
      return true;
    }

    const authorization = req.headers.authorization;
    if (!authorization) {
      throw new UnauthorizedException('用户未登录');
    }
    // 取出 authorization 的 header，验证 token 是否有效，token 有效返回 true，无效的话就返回 UnauthorizedException
    try {
      const token = authorization.split(' ')[1];
      const data = this.jwtService.verify<JwtUserData>(token);
      req.user = {
        userId: data.userId,
        username: data.username,
        roles: data.roles,
        permissions: data.permissions,
      };
      return true;
    } catch (e) {
      throw new UnauthorizedException('token 失效，请重新登录');
    }
  }
}
