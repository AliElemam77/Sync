import { SetMetadata, CustomDecorator } from '@nestjs/common';
import { PERMISSIONS_KEY } from '../constants/auth.constants';

export const RequirePermissions = (...permissions: string[]): CustomDecorator =>
  SetMetadata(PERMISSIONS_KEY, permissions);
