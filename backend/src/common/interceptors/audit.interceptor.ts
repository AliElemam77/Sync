import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AUDIT_METADATA_KEY, AuditOptions } from '../constants/auth.constants';
import { AuditService } from '../../modules/audit/audit.service';
import { AuditAction } from '@prisma/client';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const auditOptions = this.reflector.getAllAndOverride<AuditOptions>(
      AUDIT_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!auditOptions) {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest();
    const { user, ip, headers, body, params } = req;
    const userAgent = headers['user-agent'] || null;
    const clientIp = (headers['x-forwarded-for'] as string)?.split(',')[0] || ip;

    return next.handle().pipe(
      tap(async (responseBody) => {
        const entityId = auditOptions.getEntityId
          ? auditOptions.getEntityId(req, responseBody)
          : params?.id || responseBody?.id || null;

        // Sanitize sensitive fields from body snapshots
        const sanitizedBody = { ...body };
        delete sanitizedBody.password;
        delete sanitizedBody.passwordHash;

        await this.auditService.log({
          userId: user?.id ?? null,
          action: auditOptions.action as AuditAction,
          entity: auditOptions.entity,
          entityId: entityId ? String(entityId) : null,
          metadata: {
            requestBody: sanitizedBody,
            params,
          },
          ipAddress: clientIp,
          userAgent,
        });
      }),
    );
  }
}
