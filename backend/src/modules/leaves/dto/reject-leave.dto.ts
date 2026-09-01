import { IsNotEmpty, IsString } from 'class-validator';

export class RejectLeaveDto {
  @IsString()
  @IsNotEmpty({ message: 'Rejection reason is required' })
  rejectionReason: string;
}
