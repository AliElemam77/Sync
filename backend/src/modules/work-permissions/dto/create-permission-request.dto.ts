import { IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { MAX_PERMISSION_HOURS } from '../permission-policy';

const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreatePermissionRequestDto {
  @IsDateString()
  @IsNotEmpty()
  date: string;

  @IsOptional()
  @Matches(TIME_OF_DAY, { message: 'startTime must be HH:mm' })
  startTime?: string;

  @IsOptional()
  @Matches(TIME_OF_DAY, { message: 'endTime must be HH:mm' })
  endTime?: string;

  // Whole hours only; recomputed from startTime/endTime when both are given
  @IsInt({ message: 'Permissions are requested in whole hours' })
  @Min(1)
  @Max(MAX_PERMISSION_HOURS)
  hoursRequested: number;

  @IsString()
  @IsNotEmpty({ message: 'Reason is required' })
  reason: string;
}
