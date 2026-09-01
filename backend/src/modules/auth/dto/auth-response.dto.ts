export interface UserDepartmentDto {
  id: string;
  name: string;
  code: string;
}

export interface UserPositionDto {
  id: string;
  name: string;
}

export interface UserEmployeeDto {
  id: string;
  employeeCode: string;
  fullName: string;
  avatarUrl?: string | null;
  department?: UserDepartmentDto | null;
  position?: UserPositionDto | null;
}

export interface UserProfileDto {
  id: string;
  email: string;
  isActive: boolean;
  role: {
    id: string;
    name: string;
  };
  permissions: string[];
  createdAt: Date;
  employee?: UserEmployeeDto | null;
}

export class LoginResponseDto {
  accessToken!: string;
  user!: UserProfileDto;
}
