import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Observable } from 'rxjs';

@Injectable()
export class PermissionGuard implements CanActivate {
  @Inject(Reflector)
  private reflector: Reflector;
  
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    
    const req: Request = context.switchToHttp().getRequest();
    if (!req.user) {
      return true;
    }

    const permissions = req.user.permissions;
    const requirePermissions  = this.reflector.getAllAndOverride('require-permission', [
      context.getClass(),
      context.getHandler()
    ])
    if (!requirePermissions ) {
      return true;
    }

    // 对于需要的每个权限，检查下用户是否拥有，没有的话就返回 401，提示没权限, 否则就放行，返回 true
    // const found = requirePermissions.some(x => permissions.find(y => y.code === x));
    // 优化查找权限代码
    // Set的has方法在平均情况下是O(1)时间复杂度，比Array.prototype.find的O(n)要高效
    const permissionCodes = new Set(permissions.map(item => item.code));
    const found = requirePermissions.every(permission => permissionCodes.has(permission));
    if (!found) {
      throw new UnauthorizedException('您没有访问该接口的权限');
    }

    return true;
  }
}
