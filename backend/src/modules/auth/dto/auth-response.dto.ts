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
}

export class LoginResponseDto {
  accessToken!: string;
  user!: UserProfileDto;
}
