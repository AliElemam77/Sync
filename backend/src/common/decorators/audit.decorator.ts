import { SetMetadata, CustomDecorator } from '@nestjs/common';
import { AUDIT_METADATA_KEY, AuditOptions } from '../constants/auth.constants';

export const Audit = (options: AuditOptions): CustomDecorator =>
  SetMetadata(AUDIT_METADATA_KEY, options);
