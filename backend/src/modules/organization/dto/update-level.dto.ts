import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateLevelDto {
  @IsString()
  @IsOptional()
  @MaxLength(50)
  name?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  rank?: number;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;
}
