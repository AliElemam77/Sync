import { IsUUID, IsNotEmpty } from 'class-validator';

export class CreateDirectConversationDto {
  @IsUUID('4', { message: 'معرف المستخدم غير صالح' })
  @IsNotEmpty({ message: 'معرف المستخدم المستهدف مطلوب' })
  targetUserId: string;
}
