import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreatePositionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsUUID('4', { message: 'departmentId must be a valid UUID' })
  @IsNotEmpty()
  departmentId!: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;
}
