import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { TaskStatus, TaskPriority, TaskAssignmentType } from '@prisma/client';

export class QueryTasksDto {
  @IsUUID('4')
  @IsOptional()
  assigneeId?: string;

  @IsUUID('4')
  @IsOptional()
  targetDepartmentId?: string;

  @IsUUID('4')
  @IsOptional()
  creatorId?: string;

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
  search?: string;
}
