import { IsDateString, IsOptional, IsUUID, Matches } from 'class-validator';

const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;

/** HR correction of one employee's day (e.g. a forgotten check-in); times are company time */
export class RecordAttendanceDto {
  @IsUUID()
  employeeId: string;

  @IsDateString()
  date: string;

  @Matches(TIME_OF_DAY, { message: 'checkInTime must be HH:mm' })
  checkInTime: string;

  @IsOptional()
  @Matches(TIME_OF_DAY, { message: 'checkOutTime must be HH:mm' })
  checkOutTime?: string;
}
