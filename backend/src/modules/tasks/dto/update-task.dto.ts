import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { TaskStatus, TaskPriority, TaskAssignmentType } from '@prisma/client';

export class UpdateTaskDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;

  @IsEnum(TaskAssignmentType)
  @IsOptional()
  assignmentType?: TaskAssignmentType;

  @IsString()
  @IsOptional()
  dueDate?: string;

  @IsUUID('4')
  @IsOptional()
  assigneeId?: string;

  @IsUUID('4')
  @IsOptional()
  targetDepartmentId?: string;

  @IsNumber()
  @IsOptional()
  order?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attachmentUrls?: string[];
}
