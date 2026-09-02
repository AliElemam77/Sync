import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class AssignAssetDto {
  @IsUUID('4', { message: 'معرف الموظف مطلوب وغير صالح' })
  @IsNotEmpty({ message: 'يرجى تحديد الموظف المستلم للعهدة' })
  employeeId: string;

  @IsString()
  @IsOptional()
  conditionNotes?: string;
}
