import { IsBoolean, IsOptional } from 'class-validator';

export class CheckInDto {
  // The employee confirmed working on their shift's weekly day off (e.g. Saturday for LS)
  @IsOptional()
  @IsBoolean()
  confirmDayOff?: boolean;
}
