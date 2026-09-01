import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateTaskCommentDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attachmentUrls?: string[];
}
