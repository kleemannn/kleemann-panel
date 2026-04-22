import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Role } from '@prisma/client';

export interface JwtUser {
  sub: string;         // reseller.id
  telegramId: string;  // stringified bigint
  role: Role;
}

export const CurrentUser = createParamDecorator<unknown, ExecutionContext, JwtUser>(
  (_data, ctx) => ctx.switchToHttp().getRequest().user as JwtUser,
);
