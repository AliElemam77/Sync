export interface Role {
  id: string;
  name: string;
}

export interface UserProfile {
  id: string;
  email: string;
  isActive: boolean;
  role: Role;
  permissions: string[];
  createdAt: string;
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
