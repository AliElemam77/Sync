import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export enum ManagementAction {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  COMPLETE = 'COMPLETE',
}

export enum RequestCategory {
  LEAVE = 'LEAVE',
  PERMISSION = 'PERMISSION',
  TASK = 'TASK',
}

export class ManagementOverrideDto {
  @IsUUID('4', { message: 'المعرف يجب أن يكون UUID صالح' })
  @IsNotEmpty({ message: 'معرف الطلب مطلوب' })
  id: string;

  @IsEnum(RequestCategory, { message: 'تصنيف الطلب غير صالح' })
  @IsNotEmpty({ message: 'تصنيف الطلب مطلوب' })
  category: RequestCategory;

  @IsEnum(ManagementAction, { message: 'الإجراء الإداري غير صالح' })
  @IsNotEmpty({ message: 'الإجراء الإداري مطلوب' })
  action: ManagementAction;

  @IsString()
  @IsOptional()
  reason?: string;
}
