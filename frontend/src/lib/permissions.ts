export interface UserDirectoryScope {
  isCompanyWide: boolean;
  isHead: boolean;
  isTeamLeader: boolean;
  isAgent: boolean;
  scopeLabel: string;
  scopeBadge: string;
  canManage: boolean;
}

export function getUserDirectoryScope(user: any): UserDirectoryScope {
  if (!user) {
    return {
      isCompanyWide: false,
      isHead: false,
      isTeamLeader: false,
      isAgent: true,
      scopeLabel: 'زملائي في الفريق',
      scopeBadge: 'فريق العمل',
      canManage: false,
    };
  }

  const roleName =
    typeof user.role === 'string'
      ? user.role.toUpperCase()
      : user.role?.name?.toUpperCase() || '';

  const isSuperAdminOrExecutive = [
    'SUPER_ADMIN',
    'ADMIN',
    'HR_MANAGER',
    'GENERAL_MANAGER',
    'EXECUTIVE_MANAGER',
    'DIRECTOR',
  ].includes(roleName);

  const deptCode = user.employee?.department?.code?.toUpperCase() || '';
  const deptName = user.employee?.department?.name?.toLowerCase() || '';

  const isHR =
    ['HR', 'HRD', 'HUMAN_RESOURCES'].includes(deptCode) ||
    deptName.includes('موارد بشرية') ||
    deptName.includes('hr');

  const isMgmt =
    ['MGMT', 'MGT', 'CORP', 'ADMIN', 'EXEC', 'HQ', 'BOARD'].includes(deptCode) ||
    deptName.includes('إدارة عامة') ||
    deptName.includes('management') ||
    deptName.includes('executive');

  if (isSuperAdminOrExecutive || isHR || isMgmt) {
    return {
      isCompanyWide: true,
      isHead: false,
      isTeamLeader: false,
      isAgent: false,
      scopeLabel: 'سجل الكوادر العام (كافة الأقسام)',
      scopeBadge: 'إدارة شاملة',
      canManage: true,
    };
  }

  const posName = user.employee?.position?.name?.toLowerCase() || '';

  const isHead =
    roleName.includes('HEAD') ||
    posName.includes('head') ||
    posName.includes('رئيس') ||
    posName.includes('مدير إدارة');

  if (isHead) {
    return {
      isCompanyWide: false,
      isHead: true,
      isTeamLeader: false,
      isAgent: false,
      scopeLabel: 'فريق العمل والأقسام التابعة',
      scopeBadge: 'رئيس إدارة / قطاع',
      canManage: false,
    };
  }

  const isTeamLeader =
    roleName.includes('LEADER') ||
    roleName.includes('TEAM_LEADER') ||
    posName.includes('leader') ||
    posName.includes('قائد') ||
    posName.includes('مشرف');

  if (isTeamLeader) {
    return {
      isCompanyWide: false,
      isHead: false,
      isTeamLeader: true,
      isAgent: false,
      scopeLabel: 'أعضاء الفريق (تحت إشرافك)',
      scopeBadge: 'قائد فريق',
      canManage: false,
    };
  }

  return {
    isCompanyWide: false,
    isHead: false,
    isTeamLeader: false,
    isAgent: true,
    scopeLabel: 'زملائي في الفريق',
    scopeBadge: 'زملاء الفريق',
    canManage: false,
  };
}

export function canAccessEmployees(user: any): boolean {
  // All authenticated users can view their corresponding directory scope
  return !!user;
}
