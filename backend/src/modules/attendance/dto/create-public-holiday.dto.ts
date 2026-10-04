import { IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePublicHolidayDto {
  @IsDateString()
  startDate: string;

  // Last day of a holiday spanning several days (e.g. a feast); defaults to startDate
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsString()
  @IsNotEmpty({ message: 'Holiday name is required' })
  @MaxLength(100)
  name: string;
}
