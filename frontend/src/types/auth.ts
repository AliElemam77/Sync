export interface Role {
  id: string;
  name: string;
}

export interface UserDepartment {
  id: string;
  name: string;
  code: string;
}

export interface UserPosition {
  id: string;
  name: string;
}

export interface UserEmployeeProfile {
  id: string;
  employeeCode: string;
  fullName: string;
  avatarUrl?: string | null;
  department?: UserDepartment | null;
  position?: UserPosition | null;
}

export interface UserProfile {
  id: string;
  email: string;
  isActive: boolean;
  role: Role;
  permissions: string[];
  createdAt: string;
  employee?: UserEmployeeProfile | null;
}

export interface LoginResponse {
  accessToken: string;
  user: UserProfile;
}

export interface ApiErrorResponse {
  statusCode: number;
  message: string | string[];
  error?: string;
}
