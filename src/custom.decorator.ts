import { SetMetadata } from "@nestjs/common";

export const RequireLogin = () => SetMetadata('require-login', true);

export const RequirePermission = (...permissions: Array<string>) => SetMetadata('require-permission', permissions);