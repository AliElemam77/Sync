import { IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreatePermissionRequestDto {
  @IsDateString()
  @IsNotEmpty()
  date: string;

  @IsOptional()
  @IsString()
  startTime?: string;

  @IsOptional()
  @IsString()
  endTime?: string;

  @IsInt()
  @Min(1)
  @Max(8)
  hoursRequested: number;

  @IsString()
  @IsNotEmpty({ message: 'Reason is required' })
  reason: string;
}
