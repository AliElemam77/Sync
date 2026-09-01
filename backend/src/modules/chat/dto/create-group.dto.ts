import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsArray,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ConversationType } from '@prisma/client';

export class CreateGroupDto {
  @IsString()
  @IsNotEmpty({ message: 'اسم المجموعة مطلوب' })
  @MaxLength(150, { message: 'اسم المجموعة يجب ألا يتجاوز 150 حرفاً' })
  title: string;

  @IsEnum(ConversationType, { message: 'نوع المجموعة غير صالح' })
  type: ConversationType; // WORK_GROUP or PUBLIC_GROUP

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsUUID('4', { message: 'معرف القسم غير صالح' })
  departmentId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true, message: 'معرفات الأعضاء يجب أن تكون UUID صالحة' })
  participantUserIds?: string[];
}
