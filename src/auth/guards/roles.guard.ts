import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!roles || roles.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const role = req.user?.role;
    if (!role) throw new ForbiddenException('Forbidden');

    const rolesLower = roles.map(r => String(r).toLowerCase());
    if (!rolesLower.includes(String(role).toLowerCase())) throw new ForbiddenException('Forbidden');
    
    return true;
  }
}
