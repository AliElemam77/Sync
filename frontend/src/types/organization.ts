export interface Level {
  id: string;
  name: string;
  rank: number;
  description?: string | null;
  positionId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Position {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  departmentId: string;
  levels: Level[];
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  isActive: boolean;
  headId?: string | null;
  /** Commission per accepted task (Decimal, serialized as a string) */
  commissionPerTask?: string | number;
  head?: {
    id: string;
    fullName: string;
    employeeCode: string;
    avatarUrl?: string | null;
    position?: {
      id: string;
      name: string;
    };
  } | null;
  positions: Position[];
  _count?: {
    employees?: number;
    positions?: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateDepartmentInput {
  name: string;
  code: string;
  description?: string;
  headId?: string | null;
}

export interface UpdateDepartmentInput {
  name?: string;
  description?: string;
  isActive?: boolean;
  headId?: string | null;
  /** Management only */
  commissionPerTask?: number;
}

export interface CreatePositionInput {
  name: string;
  departmentId: string;
  description?: string;
}

export interface CreateLevelInput {
  name: string;
  positionId: string;
  rank?: number;
  description?: string;
}
