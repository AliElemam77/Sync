export const IS_PUBLIC_KEY = 'isPublic';
export const PERMISSIONS_KEY = 'permissions';
export const AUDIT_METADATA_KEY = 'auditMetadata';

export interface AuditOptions {
  action: 'LOGIN' | 'LOGOUT' | 'LOGIN_FAILED' | 'CREATE' | 'UPDATE' | 'DELETE' | 'EXPORT';
  entity: string;
  getEntityId?: (req: any, res: any) => string | undefined;
}
