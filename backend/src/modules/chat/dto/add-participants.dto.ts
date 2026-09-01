import { IsArray, IsUUID, ArrayMinSize } from 'class-validator';

export class AddParticipantsDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'يجب تحديد مستخدم واحد على الأقل' })
  @IsUUID('4', { each: true, message: 'معرفات المستخدمين يجب أن تكون UUID صالحة' })
  userIds: string[];
}
