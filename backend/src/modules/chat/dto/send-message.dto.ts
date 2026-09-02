import {
  IsUUID,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
} from 'class-validator';
import { MessageType } from '@prisma/client';

export class SendMessageDto {
  @IsUUID('4', { message: 'معرف المحادثة غير صالح' })
  @IsNotEmpty({ message: 'معرف المحادثة مطلوب' })
  conversationId: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsEnum(MessageType, { message: 'نوع الرسالة غير صالح' })
  type?: MessageType = MessageType.TEXT;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentUrls?: string[] = [];

  @IsOptional()
  @IsUUID('4', { message: 'معرف الرسالة المقتبسة غير صالح' })
  replyToId?: string;
}
