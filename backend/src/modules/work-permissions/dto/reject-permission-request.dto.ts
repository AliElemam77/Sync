import { IsNotEmpty, IsString } from 'class-validator';

export class RejectPermissionRequestDto {
  @IsString()
  @IsNotEmpty({ message: 'Rejection reason is required' })
  rejectionReason: string;
}
