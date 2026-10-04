export type TaskStatus =
  | 'TODO'
  | 'IN_PROGRESS'
  | 'REVIEW'
  | 'WAITING_FOR_CLIENT'
  | 'NEEDS_REVISION'
  | 'DONE';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type TaskAssignmentType = 'DEPARTMENT' | 'SELF_OR_TEAM';

export interface TaskEmployeeRef {
  id: string;
  employeeCode: string;
  fullName: string;
  avatarUrl?: string | null;
  department?: {
    id: string;
    name: string;
    code: string;
  };
  position?: {
    id: string;
    name: string;
  };
  userId?: string;
}

export interface TaskDepartmentRef {
  id: string;
  name: string;
  code: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  authorId: string;
  author: {
    id: string;
    employeeCode: string;
    fullName: string;
    avatarUrl?: string | null;
  };
  content: string;
  attachmentUrls?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignmentType: TaskAssignmentType;
  dueDate?: string | null;
  order: number;
  
  creatorId: string;
  creator: TaskEmployeeRef;
  
  targetDepartmentId?: string | null;
  targetDepartment?: TaskDepartmentRef | null;
  
  assigneeId?: string | null;
  assignee?: TaskEmployeeRef | null;
  
  attachmentUrls?: string[];
  // Full thread on single-task responses; list responses carry only _count
  comments?: TaskComment[];
  _count?: { comments: number };

  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: TaskPriority;
  assignmentType: TaskAssignmentType;
  targetId: string;
  dueDate?: string;
  status?: TaskStatus;
  order?: number;
  attachmentUrls?: string[];
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignmentType?: TaskAssignmentType;
  dueDate?: string;
  assigneeId?: string;
  targetDepartmentId?: string;
  order?: number;
  attachmentUrls?: string[];
}

export interface UpdateTaskStatusInput {
  status: TaskStatus;
  comment?: string;
  attachmentUrls?: string[];
  order?: number;
}

export interface CreateTaskCommentInput {
  content: string;
  attachmentUrls?: string[];
}

export interface QueryTasksInput {
  assigneeId?: string;
  targetDepartmentId?: string;
  creatorId?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignmentType?: TaskAssignmentType;
  search?: string;
}
