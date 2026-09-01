'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  useTasks,
  useDepartmentBacklog,
  useTask,
  useCreateTask,
  useUpdateTask,
  useUpdateTaskStatus,
  useAddComment,
  useDeleteTask,
} from '../../../hooks/use-tasks';
import { useEmployees } from '../../../hooks/use-employees';
import { useOrganizationTree } from '../../../hooks/use-organization';
import { useAuth } from '../../../hooks/use-auth';
import { useSocket } from '../../../providers/socket-provider';
import { uploadImageToImgBB } from '../../../lib/imgbb';
import {
  Plus,
  Inbox,
  User,
  Users,
  Building2,
  Send,
  Globe,
  Trash2,
  Image as ImageIcon,
  AlertTriangle,
  CheckCircle2,
  MessageSquare,
  Clock,
  Sparkles,
  ArrowRight,
  Shield,
  Layers,
  ClipboardList,
  Zap,
  Search,
  Calendar,
  X,
  Eye,
  RotateCcw,
  Check,
} from 'lucide-react';
import {
  Task,
  TaskStatus,
  TaskPriority,
  TaskAssignmentType,
  CreateTaskInput,
} from '../../../types/tasks';

// -----------------------------------------------------------------------------
// FORM VALIDATION SCHEMAS (ZOD)
// -----------------------------------------------------------------------------

const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title is too long'),
  description: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  assignmentType: z.enum(['DEPARTMENT', 'SELF_OR_TEAM']),
  targetId: z.string().min(1, 'Please select a target department or assignee'),
  dueDate: z.string().optional(),
});

type CreateTaskFormData = z.infer<typeof createTaskSchema>;

const revisionSchema = z.object({
  comment: z.string().min(3, 'Please provide at least 3 characters of feedback'),
});

type RevisionFormData = z.infer<typeof revisionSchema>;

const commentSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty'),
});

type CommentFormData = z.infer<typeof commentSchema>;

// -----------------------------------------------------------------------------
// KANBAN COLUMN DEFINITIONS & PRIORITY STYLES
// -----------------------------------------------------------------------------

interface ColumnConfig {
  id: TaskStatus;
  title: string;
  badgeColor: string;
  borderColor: string;
  headerBg: string;
  icon: React.ComponentType<{ className?: string }>;
}

const COLUMNS: ColumnConfig[] = [
  {
    id: 'TODO',
    title: 'To Do',
    badgeColor: 'bg-slate-500/10 text-slate-300 border-slate-700',
    borderColor: 'border-slate-800',
    headerBg: 'bg-slate-900/90',
    icon: ClipboardList,
  },
  {
    id: 'IN_PROGRESS',
    title: 'In Progress',
    badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    borderColor: 'border-blue-500/30',
    headerBg: 'bg-blue-950/30',
    icon: Zap,
  },
  {
    id: 'REVIEW',
    title: 'Under Review',
    badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    borderColor: 'border-purple-500/30',
    headerBg: 'bg-purple-950/30',
    icon: Search,
  },
  {
    id: 'WAITING_FOR_CLIENT',
    title: 'Waiting on Client',
    badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    borderColor: 'border-amber-500/30',
    headerBg: 'bg-amber-950/30',
    icon: Clock,
  },
  {
    id: 'NEEDS_REVISION',
    title: 'Needs Revision',
    badgeColor: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    borderColor: 'border-rose-500/30',
    headerBg: 'bg-rose-950/30',
    icon: AlertTriangle,
  },
  {
    id: 'DONE',
    title: 'Accepted & Done',
    badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    borderColor: 'border-emerald-500/30',
    headerBg: 'bg-emerald-950/30',
    icon: CheckCircle2,
  },
];

const PRIORITY_BADGES: Record<TaskPriority, { bg: string; text: string; border: string }> = {
  LOW: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/20' },
  MEDIUM: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  HIGH: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  URGENT: { bg: 'bg-rose-500/15', text: 'text-rose-400 font-bold animate-pulse', border: 'border-rose-500/30' },
};

// -----------------------------------------------------------------------------
// MAIN PAGE COMPONENT
// -----------------------------------------------------------------------------

export default function TasksKanbanPage() {
  const { user, hasPermission } = useAuth();
  const isAdmin = ['SUPER_ADMIN', 'HR_MANAGER'].includes(user?.role?.name || '');
  const isTeamLeader =
    user?.role?.name === 'TEAM_LEADER' ||
    user?.permissions?.includes('org.manage');
  const isTeamLeaderOrAdmin = isAdmin || isTeamLeader;
  const canCreate = hasPermission('tasks.create') || isAdmin || !!user;

  // Current Employee Profile reference
  const { data: employeesResponse } = useEmployees({ limit: 100 });
  const employees = employeesResponse?.data || [];
  const currentEmployee = useMemo(() => {
    return employees.find((emp) => emp.userId === user?.id);
  }, [employees, user?.id]);

  // Filters State (Default regular employees to 'MINE' so they only see their own tasks)
  const [search, setSearch] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedPriority, setSelectedPriority] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'ALL' | 'MINE' | 'MY_DEPT' | 'CREATED_BY_ME'>(
    isAdmin ? 'ALL' : 'MINE',
  );

  // Modals & Panels State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isBacklogDrawerOpen, setIsBacklogDrawerOpen] = useState(false);
  const [revisionModalTask, setRevisionModalTask] = useState<Task | null>(null);
  const [revisionAttachmentUrls, setRevisionAttachmentUrls] = useState<string[]>([]);
  const [isUploadingRevisionImg, setIsUploadingRevisionImg] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activePreviewImage, setActivePreviewImage] = useState<string | null>(null);

  const { selectedTaskIdFromNotification, setSelectedTaskIdFromNotification } = useSocket();

  useEffect(() => {
    if (selectedTaskIdFromNotification) {
      setSelectedTaskId(selectedTaskIdFromNotification);
      setSelectedTaskIdFromNotification(null);
    }
  }, [selectedTaskIdFromNotification, setSelectedTaskIdFromNotification]);

  // Revision Form with react-hook-form & zod
  const {
    register: registerRevision,
    handleSubmit: handleRevisionSubmit,
    reset: resetRevisionForm,
    formState: { errors: revisionErrors, isSubmitting: isRevisionSubmitting },
  } = useForm<RevisionFormData>({
    resolver: zodResolver(revisionSchema),
    defaultValues: { comment: '' },
  });

  // Queries & Mutations
  const { data: tasks = [], isLoading, isError } = useTasks({
    search: search.trim() || undefined,
    targetDepartmentId: selectedDepartment || undefined,
    priority: (selectedPriority as TaskPriority) || undefined,
  });

  const { data: backlogTasks = [] } = useDepartmentBacklog();
  const { data: orgTree = [] } = useOrganizationTree();

  const createTaskMutation = useCreateTask();
  const updateTaskMutation = useUpdateTask();
  const updateStatusMutation = useUpdateTaskStatus();
  const addCommentMutation = useAddComment();
  const deleteTaskMutation = useDeleteTask();

  // Group tasks by column based on filter mode
  const tasksByColumn = useMemo(() => {
    let filtered = [...tasks];

    if (filterMode === 'MINE' && currentEmployee) {
      filtered = filtered.filter((t) => t.assigneeId === currentEmployee.id);
    } else if (filterMode === 'MY_DEPT' && currentEmployee) {
      filtered = filtered.filter(
        (t) =>
          t.targetDepartmentId === currentEmployee.departmentId ||
          t.assignee?.department?.id === currentEmployee.departmentId,
      );
    } else if (filterMode === 'CREATED_BY_ME' && currentEmployee) {
      filtered = filtered.filter((t) => t.creatorId === currentEmployee.id);
    }

    const grouped: Record<TaskStatus, Task[]> = {
      TODO: [],
      IN_PROGRESS: [],
      REVIEW: [],
      WAITING_FOR_CLIENT: [],
      NEEDS_REVISION: [],
      DONE: [],
    };

    filtered.forEach((task) => {
      if (grouped[task.status]) {
        grouped[task.status].push(task);
      } else {
        grouped.TODO.push(task);
      }
    });

    Object.keys(grouped).forEach((col) => {
      grouped[col as TaskStatus].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    });

    return grouped;
  }, [tasks, filterMode, currentEmployee]);

  // Handle Drag & Drop with state machine validation
  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }

    const targetStatus = destination.droppableId as TaskStatus;
    const targetTask = tasks.find((t) => t.id === draggableId);
    if (!targetTask) return;

    // Check if dragging to NEEDS_REVISION -> Requires revision comment prompt
    if (targetStatus === 'NEEDS_REVISION') {
      setRevisionModalTask(targetTask);
      resetRevisionForm({ comment: '' });
      setRevisionAttachmentUrls([]);
      return;
    }

    setErrorMessage(null);
    try {
      await updateStatusMutation.mutateAsync({
        id: draggableId,
        data: {
          status: targetStatus,
          order: destination.index,
        },
      });
    } catch (err: any) {
      setErrorMessage(
        err?.response?.data?.message || 'Unauthorized status transition. Reverting position.',
      );
    }
  };

  const onConfirmRevision = async (data: RevisionFormData) => {
    if (!revisionModalTask) return;

    try {
      await updateStatusMutation.mutateAsync({
        id: revisionModalTask.id,
        data: {
          status: 'NEEDS_REVISION',
          comment: data.comment.trim(),
          attachmentUrls: revisionAttachmentUrls,
        },
      });
      setRevisionModalTask(null);
      resetRevisionForm();
      setRevisionAttachmentUrls([]);
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || 'Failed to request revision.');
    }
  };

  const handleRevisionImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingRevisionImg(true);
    try {
      const file = files[0];
      const url = await uploadImageToImgBB(file);
      setRevisionAttachmentUrls((prev) => [...prev, url]);
    } catch (err: any) {
      alert(err.message || 'Image upload failed');
    } finally {
      setIsUploadingRevisionImg(false);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header & Cross-Dept Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center space-x-2 text-xs text-slate-400 mb-1">
            <span>Workforce Operations</span>
            <span>/</span>
            <span className="text-white font-medium">Cross-Department Routing</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Tasks & State Machine Kanban</span>
            <span className="text-xs bg-indigo-500/10 text-indigo-400 px-2.5 py-0.5 rounded-full border border-indigo-500/20 font-mono">
              PHASE 04
            </span>
          </h1>
        </div>

        <div className="flex items-center space-x-3 self-start sm:self-auto">
          {/* Department Backlog Drawer Trigger (Team Leader & Admin Only) */}
          {isTeamLeaderOrAdmin && (
            <button
              onClick={() => setIsBacklogDrawerOpen(true)}
              className="relative inline-flex items-center space-x-2 rounded-xl border border-slate-700 bg-slate-800/90 px-3.5 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition-all"
            >
              <Inbox className="h-3.5 w-3.5 text-amber-400" />
              <span>Dept Backlog</span>
              {backlogTasks.length > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-black">
                  {backlogTasks.length}
                </span>
              )}
            </button>
          )}

          {/* Create Task Button */}
          {canCreate && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center space-x-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>Create Task</span>
            </button>
          )}
        </div>
      </div>

      {/* Global Error Banner */}
      {errorMessage && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-400 flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-rose-300 hover:text-white p-1">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 bg-slate-900/40 p-4 rounded-xl border border-slate-800 backdrop-blur-sm items-center">
        {/* Search */}
        <div className="sm:col-span-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search task title, requester, or assignee..."
            className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        {/* Filter by Department */}
        <div className="sm:col-span-3">
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
          >
            <option value="">All Target Departments</option>
            {orgTree.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name} ({dept.code})
              </option>
            ))}
          </select>
        </div>

        {/* Filter by Priority */}
        <div className="sm:col-span-2">
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
          >
            <option value="">All Priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>

        {/* Scope Filter Segment (Agent sees My Tasks & Requested only; Team Leader/Admin sees Dept & All) */}
        <div className="sm:col-span-3 flex rounded-lg border border-slate-700 bg-slate-800/80 p-1">
          <button
            type="button"
            onClick={() => setFilterMode('MINE')}
            className={`flex-1 rounded py-1 text-[10px] font-semibold transition-all ${
              filterMode === 'MINE' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="inline-flex items-center gap-1">
              <User className="h-3 w-3" />
              <span>My Tasks</span>
            </span>
          </button>

          {isTeamLeaderOrAdmin && (
            <button
              type="button"
              onClick={() => setFilterMode('MY_DEPT')}
              className={`flex-1 rounded py-1 text-[10px] font-semibold transition-all ${
                filterMode === 'MY_DEPT' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                <span>Dept</span>
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setFilterMode('CREATED_BY_ME')}
            className={`flex-1 rounded py-1 text-[10px] font-semibold transition-all ${
              filterMode === 'CREATED_BY_ME' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="inline-flex items-center gap-1">
              <Send className="h-3 w-3" />
              <span>Requested</span>
            </span>
          </button>

          {isTeamLeaderOrAdmin && (
            <button
              type="button"
              onClick={() => setFilterMode('ALL')}
              className={`flex-1 rounded py-1 text-[10px] font-semibold transition-all ${
                filterMode === 'ALL' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="inline-flex items-center gap-1">
                <Globe className="h-3 w-3" />
                <span>All</span>
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center space-y-2">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
            <p className="text-xs text-slate-400">Loading Kanban state machine...</p>
          </div>
        </div>
      )}

      {/* 6-COLUMN KANBAN BOARD */}
      {!isLoading && !isError && (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 items-start overflow-x-auto">
            {COLUMNS.map((column) => {
              const columnTasks = tasksByColumn[column.id] || [];

              return (
                <div
                  key={column.id}
                  className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm overflow-hidden shadow-xl"
                >
                  {/* Column Header */}
                  <div className={`p-3 border-b border-slate-800 ${column.headerBg} flex items-center justify-between`}>
                    <div className="flex items-center space-x-1.5 truncate">
                      <column.icon className="h-3.5 w-3.5 shrink-0" />
                      <h2 className="text-[11px] font-bold text-white uppercase tracking-wider truncate">
                        {column.title}
                      </h2>
                    </div>
                    <span
                      className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full border ${column.badgeColor}`}
                    >
                      {columnTasks.length}
                    </span>
                  </div>

                  {/* Droppable Area */}
                  <Droppable droppableId={column.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`p-2.5 space-y-2.5 min-h-[460px] transition-colors ${
                          snapshot.isDraggingOver ? 'bg-indigo-950/20' : ''
                        }`}
                      >
                        {columnTasks.length === 0 ? (
                          <div className="h-32 flex items-center justify-center border-2 border-dashed border-slate-800/80 rounded-xl text-[10px] text-slate-600 italic">
                            Empty
                          </div>
                        ) : (
                          columnTasks.map((task, index) => (
                            <Draggable key={task.id} draggableId={task.id} index={index}>
                              {(dragProvided, dragSnapshot) => (
                                <div
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  {...dragProvided.dragHandleProps}
                                  onClick={() => setSelectedTaskId(task.id)}
                                  className={`group relative rounded-xl border border-slate-800 bg-slate-800/90 p-3 shadow-md hover:border-indigo-500/50 hover:shadow-indigo-500/10 cursor-pointer transition-all ${
                                    dragSnapshot.isDragging
                                      ? 'border-indigo-500 shadow-2xl shadow-indigo-500/25 scale-102 bg-slate-800 z-50'
                                      : ''
                                  }`}
                                >
                                  {/* Top Badges: Priority & Routing */}
                                  <div className="flex items-center justify-between mb-2">
                                    <span
                                      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[8px] font-semibold border ${
                                        PRIORITY_BADGES[task.priority].bg
                                      } ${PRIORITY_BADGES[task.priority].text} ${
                                        PRIORITY_BADGES[task.priority].border
                                      }`}
                                    >
                                      {task.priority}
                                    </span>

                                    {task.targetDepartment && (
                                      <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 text-[8px] font-mono text-indigo-300 border border-indigo-500/20">
                                        → {task.targetDepartment.code}
                                      </span>
                                    )}
                                  </div>

                                  {/* Task Title */}
                                  <h3 className="text-xs font-semibold text-white group-hover:text-indigo-300 transition-colors line-clamp-2">
                                    {task.title}
                                  </h3>

                                  {/* Attachment image thumbnail if present */}
                                  {task.attachmentUrls && task.attachmentUrls.length > 0 && (
                                    <div className="mt-2 flex items-center gap-1.5 overflow-hidden rounded-lg bg-slate-900/60 p-1 border border-slate-700/60">
                                      <img
                                        src={task.attachmentUrls[0]}
                                        alt="Task preview"
                                        className="h-9 w-full object-cover rounded"
                                      />
                                      {task.attachmentUrls.length > 1 && (
                                        <span className="text-[8px] font-bold text-slate-400 px-1">
                                          +{task.attachmentUrls.length - 1}
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  {/* Cross-Department Note or Comments Count */}
                                  <div className="mt-2 flex items-center justify-between text-[9px] text-slate-400">
                                    <span className="truncate max-w-[90px]">
                                      Req: {task.creator?.fullName?.split(' ')[0] || 'Admin'}
                                    </span>

                                    {task.comments?.length > 0 && (
                                      <span className="flex items-center space-x-1 text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                                        <MessageSquare className="h-2.5 w-2.5" />
                                        <span>{task.comments.length}</span>
                                      </span>
                                    )}
                                  </div>

                                  {/* Footer: Due Date & Assignee */}
                                  <div className="mt-2.5 pt-2 border-t border-slate-700/60 flex items-center justify-between text-[9px]">
                                    {task.dueDate ? (
                                      <div
                                        className={`flex items-center space-x-1 ${
                                          new Date(task.dueDate) < new Date() && task.status !== 'DONE'
                                            ? 'text-rose-400 font-semibold'
                                            : 'text-slate-400'
                                        }`}
                                      >
                                        <Calendar className="h-2.5 w-2.5" />
                                        <span>
                                          {new Date(task.dueDate).toLocaleDateString(undefined, {
                                            month: 'short',
                                            day: 'numeric',
                                          })}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-slate-600">No deadline</span>
                                    )}

                                    {task.assignee ? (
                                      <div
                                        className="flex items-center space-x-1 bg-slate-900/80 px-1.5 py-0.5 rounded-full border border-slate-700"
                                        title={`Assignee: ${task.assignee.fullName}`}
                                      >
                                        <div className="h-3.5 w-3.5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[7px] font-bold">
                                          {task.assignee.fullName.charAt(0)}
                                        </div>
                                        <span className="text-slate-300 truncate max-w-[65px]">
                                          {task.assignee.fullName.split(' ')[0]}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-[8px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                        Unassigned
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))
                        )}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      )}

      {/* CREATE TASK MODAL (REACT-HOOK-FORM + ZOD + IMGBB) */}
      {isCreateModalOpen && (
        <CreateTaskModal
          departments={orgTree}
          employees={employees}
          currentEmployee={currentEmployee}
          user={user}
          isAdmin={isAdmin}
          onClose={() => setIsCreateModalOpen(false)}
          onSave={async (data) => {
            await createTaskMutation.mutateAsync(data);
            setIsCreateModalOpen(false);
          }}
        />
      )}

      {/* TASK DETAILS & WORKFLOW ACTION PANEL (LIVE COMMENTS & IMGBB) */}
      {selectedTaskId && (
        <TaskDetailsModal
          taskId={selectedTaskId}
          employees={employees}
          currentEmployee={currentEmployee}
          user={user}
          isAdmin={isAdmin}
          onClose={() => setSelectedTaskId(null)}
          onStatusChange={async (status, comment, attachmentUrls) => {
            await updateStatusMutation.mutateAsync({
              id: selectedTaskId,
              data: { status, comment, attachmentUrls },
            });
            setSelectedTaskId(null);
          }}
          onAssigneeChange={async (assigneeId) => {
            await updateTaskMutation.mutateAsync({
              id: selectedTaskId,
              data: { assigneeId },
            });
          }}
          onAddComment={async (content, attachmentUrls) => {
            await addCommentMutation.mutateAsync({
              taskId: selectedTaskId,
              data: { content, attachmentUrls },
            });
          }}
          onDelete={async () => {
            if (confirm('Delete this task permanently?')) {
              await deleteTaskMutation.mutateAsync(selectedTaskId);
              setSelectedTaskId(null);
            }
          }}
          onPreviewImage={(url) => setActivePreviewImage(url)}
        />
      )}

      {/* REVISION EXPLANATION MODAL (REACT-HOOK-FORM + MANDATORY COMMENT + IMGBB) */}
      {revisionModalTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-400" />
                <span>Request Revisions</span>
                <span className="text-xs text-rose-400 font-mono">NEEDS_REVISION</span>
              </h3>
              <button
                onClick={() => setRevisionModalTask(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Please state why the work is being returned for revision. You can also attach screenshots.
            </p>

            <form onSubmit={handleRevisionSubmit(onConfirmRevision)} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Revision Details <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={3}
                  {...registerRevision('comment')}
                  placeholder="e.g. Button alignment is off on mobile view and colors don't match..."
                  className={`w-full rounded-lg border bg-slate-800/90 p-3 text-xs text-white placeholder-slate-500 focus:outline-none ${
                    revisionErrors.comment ? 'border-rose-500 focus:border-rose-500' : 'border-slate-700 focus:border-rose-500'
                  }`}
                />
                {revisionErrors.comment && (
                  <p className="text-[10px] text-rose-400 mt-1">{revisionErrors.comment.message}</p>
                )}
              </div>

              {/* ImgBB Attachment upload in Revision */}
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1.5">
                  Attach Issue Screenshot (ImgBB)
                </label>
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700">
                    <ImageIcon className="h-4 w-4 text-slate-300" />
                    <span>Upload Image</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleRevisionImageUpload}
                      className="hidden"
                    />
                  </label>
                  {isUploadingRevisionImg && (
                    <span className="text-[10px] text-indigo-400 animate-pulse">Uploading to ImgBB...</span>
                  )}
                </div>

                {revisionAttachmentUrls.length > 0 && (
                  <div className="mt-2 flex gap-2 overflow-x-auto py-1">
                    {revisionAttachmentUrls.map((url, idx) => (
                      <div key={idx} className="relative group">
                        <img src={url} alt="Attachment" className="h-12 w-12 object-cover rounded-lg border border-slate-700" />
                        <button
                          type="button"
                          onClick={() => setRevisionAttachmentUrls(prev => prev.filter((_, i) => i !== idx))}
                          className="absolute -top-1 -right-1 bg-rose-600 text-white rounded-full h-4 w-4 flex items-center justify-center shadow"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setRevisionModalTask(null)}
                  className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRevisionSubmitting || updateStatusMutation.isPending}
                  className="rounded-xl bg-rose-600 px-5 py-2 text-xs font-semibold text-white shadow hover:bg-rose-500 disabled:opacity-50"
                >
                  Submit & Reject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LIGHTBOX FULL IMAGE PREVIEW */}
      {activePreviewImage && (
        <div
          onClick={() => setActivePreviewImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 cursor-zoom-out"
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={activePreviewImage}
              alt="Full Preview"
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
            />
            <button
              onClick={() => setActivePreviewImage(null)}
              className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-slate-900/80 text-white px-3 py-1.5 text-xs hover:bg-slate-800 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              <span>Close</span>
            </button>
          </div>
        </div>
      )}

      {/* DEPARTMENT BACKLOG DRAWER */}
      {isBacklogDrawerOpen && isTeamLeaderOrAdmin && (
        <DepartmentBacklogDrawer
          backlogTasks={backlogTasks}
          employees={employees}
          currentEmployee={currentEmployee}
          onClose={() => setIsBacklogDrawerOpen(false)}
          onAssignTask={async (taskId, assigneeId) => {
            await updateTaskMutation.mutateAsync({
              id: taskId,
              data: { assigneeId },
            });
          }}
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// CREATE TASK MODAL (REACT-HOOK-FORM + ZOD RESOLVER + IMGBB)
// -----------------------------------------------------------------------------

interface CreateTaskModalProps {
  departments: any[];
  employees: any[];
  currentEmployee?: any;
  user?: any;
  isAdmin: boolean;
  onClose: () => void;
  onSave: (data: CreateTaskInput) => Promise<void>;
}

function CreateTaskModal({
  departments,
  employees,
  currentEmployee,
  user,
  isAdmin,
  onClose,
  onSave,
}: CreateTaskModalProps) {
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isTeamLeader =
    user?.role?.name === 'TEAM_LEADER' || user?.permissions?.includes('org.manage');
  const isTeamLeaderOrAdmin = isAdmin || isTeamLeader;

  const defaultAssignmentType: TaskAssignmentType = 'SELF_OR_TEAM';
  const defaultTargetId = currentEmployee?.id || employees[0]?.id || '';

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateTaskFormData>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      title: '',
      description: '',
      priority: 'MEDIUM',
      assignmentType: defaultAssignmentType,
      targetId: defaultTargetId,
      dueDate: '',
    },
  });

  const assignmentType = watch('assignmentType');

  const selectableEmployees = useMemo(() => {
    if (isAdmin) return employees;
    if (isTeamLeader && currentEmployee) {
      return employees.filter((e) => e.departmentId === currentEmployee.departmentId);
    }
    // Regular Agent: only allowed to assign to themselves
    return currentEmployee ? [currentEmployee] : [];
  }, [employees, currentEmployee, isAdmin, isTeamLeader]);

  const availableDepartments = useMemo(() => {
    if (isAdmin || isTeamLeader) return departments;
    if (currentEmployee?.departmentId) {
      return departments.filter((d) => d.id !== currentEmployee.departmentId);
    }
    return departments;
  }, [departments, currentEmployee?.departmentId, isAdmin, isTeamLeader]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const url = await uploadImageToImgBB(file);
        setAttachmentUrls((prev) => [...prev, url]);
      }
    } catch (err: any) {
      setSubmitError(err.message || 'Image upload to ImgBB failed');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachmentUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: CreateTaskFormData) => {
    setSubmitError(null);
    try {
      await onSave({
        title: data.title.trim(),
        description: data.description?.trim() || undefined,
        priority: data.priority,
        assignmentType: data.assignmentType,
        targetId: data.targetId,
        dueDate: data.dueDate || undefined,
        attachmentUrls,
      });
    } catch (err: any) {
      setSubmitError(err?.response?.data?.message || 'Failed to create task.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg max-h-[92vh] flex flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Plus className="h-4 w-4 text-indigo-400" />
            <span>Create Workflow Task</span>
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {submitError && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
              {submitError}
            </div>
          )}

          <form id="create-task-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Assignment Routing Mode Toggle */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Task Assignment Type
              </label>
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-800/80 p-1 border border-slate-700">
                <button
                  type="button"
                  onClick={() => {
                    setValue('assignmentType', 'SELF_OR_TEAM');
                    setValue('targetId', currentEmployee?.id || employees[0]?.id || '');
                  }}
                  className={`py-2 rounded-lg text-xs font-semibold transition-all ${
                    assignmentType === 'SELF_OR_TEAM'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {isTeamLeaderOrAdmin ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      <span>Assign to Self / Team</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5" />
                      <span>Assign to Myself</span>
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setValue('assignmentType', 'DEPARTMENT');
                    setValue('targetId', availableDepartments[0]?.id || '');
                  }}
                  className={`py-2 rounded-lg text-xs font-semibold transition-all ${
                    assignmentType === 'DEPARTMENT'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" />
                    <span>Assign to Department</span>
                  </span>
                </button>
              </div>
            </div>

            {/* Dynamic Target Selector */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                {assignmentType === 'DEPARTMENT'
                  ? 'Target Department'
                  : isTeamLeaderOrAdmin
                  ? 'Assignee (Self or Team Member)'
                  : 'Assignee'} <span className="text-red-400">*</span>
              </label>
              {assignmentType === 'DEPARTMENT' ? (
                <select
                  {...register('targetId')}
                  className={`w-full rounded-lg border bg-slate-800/90 px-3.5 py-2 text-xs text-white focus:outline-none ${
                    errors.targetId ? 'border-red-500 focus:border-red-500' : 'border-slate-700 focus:border-indigo-500'
                  }`}
                >
                  <option value="">Select target department...</option>
                  {availableDepartments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name} ({dept.code})
                    </option>
                  ))}
                </select>
              ) : isTeamLeaderOrAdmin ? (
                <select
                  {...register('targetId')}
                  className={`w-full rounded-lg border bg-slate-800/90 px-3.5 py-2 text-xs text-white focus:outline-none ${
                    errors.targetId ? 'border-red-500 focus:border-red-500' : 'border-slate-700 focus:border-indigo-500'
                  }`}
                >
                  <option value="">Select assignee...</option>
                  {selectableEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} ({emp.employeeCode}) {emp.id === currentEmployee?.id ? '(You)' : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/90 px-3.5 py-2.5 text-xs text-white">
                  <div className="flex items-center space-x-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-medium">{currentEmployee?.fullName || 'You'}</span>
                    <span className="text-slate-400 font-mono text-[11px]">({currentEmployee?.employeeCode || 'Self'})</span>
                  </div>
                  <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 font-medium">
                    Self Assignment
                  </span>
                  <input type="hidden" {...register('targetId')} value={currentEmployee?.id || ''} />
                </div>
              )}
              {errors.targetId && (
                <p className="text-[10px] text-red-400 mt-1">{errors.targetId.message}</p>
              )}
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                {...register('title')}
                placeholder="e.g. Design Mobile Checkout Flow..."
                className={`w-full rounded-lg border bg-slate-800/90 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none ${
                  errors.title ? 'border-red-500 focus:border-red-500' : 'border-slate-700 focus:border-indigo-500'
                }`}
              />
              {errors.title && (
                <p className="text-[10px] text-red-400 mt-1">{errors.title.message}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Description</label>
              <textarea
                rows={3}
                {...register('description')}
                placeholder="Deliverables, requirements, and reference URLs..."
                className="w-full rounded-lg border border-slate-700 bg-slate-800/90 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {/* ImgBB Images Upload */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  Task Reference Images (ImgBB)
                </label>
                {isUploading && (
                  <span className="text-[10px] text-indigo-400 animate-pulse font-mono">
                    Uploading to ImgBB...
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl border border-dashed border-indigo-500/40 bg-indigo-500/5 px-4 py-2.5 text-xs font-medium text-indigo-300 hover:bg-indigo-500/10 transition-all">
                  <ImageIcon className="h-4 w-4" />
                  <span>Select Images</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
                <span className="text-[10px] text-slate-500">Supports PNG, JPG, WebP</span>
              </div>

              {/* Uploaded Thumbnails */}
              {attachmentUrls.length > 0 && (
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {attachmentUrls.map((url, idx) => (
                    <div key={idx} className="relative group rounded-lg overflow-hidden border border-slate-700 bg-slate-800 aspect-video">
                      <img src={url} alt="Uploaded attachment" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeAttachment(idx)}
                        className="absolute top-1 right-1 bg-rose-600/90 hover:bg-rose-500 text-white rounded-full p-1 text-[9px] shadow flex items-center justify-center"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Priority & Due Date Row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Priority</label>
                <select
                  {...register('priority')}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/90 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Due Date</label>
                <input
                  type="date"
                  {...register('dueDate')}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/90 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            form="create-task-form"
            type="submit"
            disabled={isSubmitting || isUploading}
            className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 disabled:opacity-50"
          >
            {isSubmitting ? 'Creating...' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// TASK DETAILS & WORKFLOW ACCEPTANCE PANEL (REACT-HOOK-FORM + IMGBB)
// -----------------------------------------------------------------------------

interface TaskDetailsModalProps {
  taskId: string;
  employees: any[];
  currentEmployee?: any;
  user?: any;
  isAdmin: boolean;
  onClose: () => void;
  onStatusChange: (status: TaskStatus, comment?: string, attachmentUrls?: string[]) => Promise<void>;
  onAssigneeChange: (assigneeId: string) => Promise<void>;
  onAddComment: (content: string, attachmentUrls?: string[]) => Promise<void>;
  onDelete: () => Promise<void>;
  onPreviewImage: (url: string) => void;
}

function TaskDetailsModal({
  taskId,
  employees,
  currentEmployee,
  user,
  isAdmin,
  onClose,
  onStatusChange,
  onAssigneeChange,
  onAddComment,
  onDelete,
  onPreviewImage,
}: TaskDetailsModalProps) {
  // Live query subscription for instantaneous updates
  const { data: task, isLoading } = useTask(taskId);

  const [commentAttachmentUrls, setCommentAttachmentUrls] = useState<string[]>([]);
  const [isUploadingCommentImg, setIsUploadingCommentImg] = useState(false);

  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectComment, setRejectComment] = useState('');
  const [rejectAttachmentUrls, setRejectAttachmentUrls] = useState<string[]>([]);
  const [isUploadingRejectImg, setIsUploadingRejectImg] = useState(false);

  const [selectedAssignee, setSelectedAssignee] = useState<string>('');

  // Comment form using react-hook-form
  const {
    register: registerComment,
    handleSubmit: handleCommentSubmit,
    reset: resetCommentForm,
    watch: watchComment,
  } = useForm<CommentFormData>({
    resolver: zodResolver(commentSchema),
    defaultValues: { content: '' },
  });

  const commentValue = watchComment('content');

  // Update selectedAssignee when task loads
  useEffect(() => {
    if (task?.assigneeId) {
      setSelectedAssignee(task.assigneeId);
    }
  }, [task?.assigneeId]);

  const isCreator = currentEmployee?.id === task?.creatorId || isAdmin;
  const isLeader =
    user?.role?.name === 'TEAM_LEADER' ||
    user?.permissions?.includes('org.manage');

  const isTargetLeader =
    isLeader &&
    currentEmployee &&
    task?.targetDepartmentId &&
    currentEmployee.departmentId === task.targetDepartmentId;

  const canReassign = isTargetLeader || isAdmin;

  // Filter employees strictly to members of the target/leader department
  const assignableEmployees = useMemo(() => {
    if (isAdmin) return employees;
    const targetDeptId = task?.targetDepartmentId || currentEmployee?.departmentId;
    if (targetDeptId) {
      return employees.filter((e) => e.departmentId === targetDeptId);
    }
    return employees;
  }, [employees, task?.targetDepartmentId, currentEmployee?.departmentId, isAdmin]);

  // Handle Comment Image Upload
  const handleCommentImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingCommentImg(true);
    try {
      const file = files[0];
      const url = await uploadImageToImgBB(file);
      setCommentAttachmentUrls((prev) => [...prev, url]);
    } catch (err: any) {
      alert(err.message || 'Image upload failed');
    } finally {
      setIsUploadingCommentImg(false);
      e.target.value = '';
    }
  };

  // Handle Post Comment
  const onPostComment = async (data: CommentFormData) => {
    if (!data.content?.trim() && commentAttachmentUrls.length === 0) return;

    const content = data.content?.trim() || 'Attached an image:';
    const attachments = [...commentAttachmentUrls];
    
    resetCommentForm();
    setCommentAttachmentUrls([]);

    await onAddComment(content, attachments);
  };

  if (isLoading || !task) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center text-xs text-slate-400">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent mx-auto mb-2" />
          Loading task details...
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div>
            <div className="flex items-center space-x-2 text-[10px] text-slate-400 mb-1">
              <span>Status:</span>
              <span className="font-mono text-indigo-400 font-bold">{task.status}</span>
              {task.targetDepartment && (
                <>
                  <span>•</span>
                  <span>Target: {task.targetDepartment.name}</span>
                </>
              )}
            </div>
            <h2 className="text-base font-bold text-white">{task.title}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Creator State Machine Action Bar */}
          {isCreator && ['REVIEW', 'WAITING_FOR_CLIENT'].includes(task.status) && (
            <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 space-y-3">
              <div>
                <h4 className="text-xs font-bold text-indigo-300">Creator Decision Required</h4>
                <p className="text-[11px] text-slate-300">
                  This task has been submitted for evaluation. You can accept it or request revisions.
                </p>
              </div>

              {!isRejecting ? (
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => onStatusChange('DONE')}
                    className="inline-flex items-center space-x-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-emerald-500 transition-all"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Accept & Mark Done</span>
                  </button>

                  <button
                    onClick={() => setIsRejecting(true)}
                    className="inline-flex items-center space-x-1.5 rounded-lg bg-rose-600/80 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500 transition-all"
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span>Reject with Feedback</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5 pt-2 border-t border-indigo-500/20">
                  <textarea
                    rows={2}
                    value={rejectComment}
                    onChange={(e) => setRejectComment(e.target.value)}
                    placeholder="Provide mandatory feedback explaining the required fixes..."
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-xs text-white focus:border-rose-500 focus:outline-none"
                  />

                  {/* Reject image upload */}
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-slate-700">
                      <ImageIcon className="h-3.5 w-3.5" />
                      <span>Attach Screenshot (ImgBB)</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          setIsUploadingRejectImg(true);
                          try {
                            const u = await uploadImageToImgBB(f);
                            setRejectAttachmentUrls((p) => [...p, u]);
                          } finally {
                            setIsUploadingRejectImg(false);
                            e.target.value = '';
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                    {isUploadingRejectImg && (
                      <span className="text-[10px] text-indigo-400 animate-pulse">Uploading...</span>
                    )}
                  </div>

                  {rejectAttachmentUrls.length > 0 && (
                    <div className="flex gap-2">
                      {rejectAttachmentUrls.map((url, i) => (
                        <img
                          key={i}
                          src={url}
                          alt="Reject attachment"
                          className="h-10 w-10 object-cover rounded border border-slate-700"
                        />
                      ))}
                    </div>
                  )}

                  <div className="flex items-center space-x-2 pt-1">
                    <button
                      onClick={() => onStatusChange('NEEDS_REVISION', rejectComment, rejectAttachmentUrls)}
                      disabled={!rejectComment.trim()}
                      className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Submit Rejection
                    </button>
                    <button
                      onClick={() => setIsRejecting(false)}
                      className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quick Info Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-850 p-4 rounded-xl border border-slate-800 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-medium">Requester</span>
              <span className="text-white font-semibold">{task.creator?.fullName || 'Admin'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-medium">Priority</span>
              <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${PRIORITY_BADGES[task.priority].text}`}>
                {task.priority}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-medium">Due Date</span>
              <span className="text-slate-200">
                {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No deadline'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-medium">Assignee</span>
              {canReassign ? (
                <select
                  value={selectedAssignee}
                  onChange={(e) => {
                    setSelectedAssignee(e.target.value);
                    onAssigneeChange(e.target.value);
                  }}
                  className="mt-0.5 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-white focus:outline-none"
                >
                  <option value="">Unassigned</option>
                  {assignableEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} ({emp.employeeCode})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="mt-0.5 flex items-center space-x-1 text-slate-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span className="font-semibold">{task.assignee?.fullName || 'Unassigned'}</span>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Description</h4>
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-800/40 text-xs text-slate-200 whitespace-pre-wrap">
              {task.description || 'No description provided.'}
            </div>
          </div>

          {/* Task Attachments Gallery */}
          {task.attachmentUrls && task.attachmentUrls.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Attached Images ({task.attachmentUrls.length})
              </h4>
              <div className="grid grid-cols-3 gap-2">
                {task.attachmentUrls.map((url, idx) => (
                  <div
                    key={idx}
                    onClick={() => onPreviewImage(url)}
                    className="relative group rounded-xl overflow-hidden border border-slate-700 bg-slate-800 aspect-video cursor-zoom-in hover:border-indigo-500 transition-all"
                  >
                    <img src={url} alt={`Task attachment ${idx + 1}`} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-medium transition-opacity">
                      <span className="inline-flex items-center gap-1">
                        <Eye className="h-3.5 w-3.5" />
                        <span>View</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Live Comments & Revision Timeline */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Comments & Revision Log ({task.comments?.length || 0})
            </h4>

            <div className="space-y-2.5 max-h-64 overflow-y-auto">
              {(!task.comments || task.comments.length === 0) ? (
                <p className="text-xs text-slate-500 italic p-3 text-center border border-dashed border-slate-800 rounded-lg">
                  No discussion comments yet.
                </p>
              ) : (
                task.comments.map((c) => (
                  <div key={c.id} className="p-3 rounded-lg border border-slate-800 bg-slate-800/70 text-xs space-y-2">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-bold text-indigo-400">{c.author.fullName}</span>
                      <span className="text-slate-500">
                        {new Date(c.createdAt).toLocaleDateString()} {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-slate-200 whitespace-pre-wrap">{c.content}</p>

                    {/* Comment image attachments if any */}
                    {c.attachmentUrls && c.attachmentUrls.length > 0 && (
                      <div className="flex gap-2 pt-1">
                        {c.attachmentUrls.map((imgUrl, i) => (
                          <img
                            key={i}
                            src={imgUrl}
                            alt="Comment attachment"
                            onClick={() => onPreviewImage(imgUrl)}
                            className="h-16 w-24 object-cover rounded-lg border border-slate-700 cursor-zoom-in hover:opacity-90"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Comment Form with react-hook-form + ImgBB upload */}
            <form onSubmit={handleCommentSubmit(onPostComment)} className="space-y-2 pt-2">
              <div className="flex space-x-2">
                <input
                  type="text"
                  {...registerComment('content')}
                  placeholder="Post a comment or update..."
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-800/90 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                />

                {/* ImgBB upload button */}
                <label
                  className="cursor-pointer inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-300 hover:bg-slate-700 hover:text-white"
                  title="Attach image to comment (ImgBB)"
                >
                  <ImageIcon className="h-4 w-4" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleCommentImageUpload}
                    className="hidden"
                  />
                </label>

                <button
                  type="submit"
                  disabled={(!commentValue?.trim() && commentAttachmentUrls.length === 0) || isUploadingCommentImg}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  Send
                </button>
              </div>

              {/* Uploading indicator or Preview */}
              {isUploadingCommentImg && (
                <p className="text-[10px] text-indigo-400 font-mono animate-pulse">Uploading image to ImgBB...</p>
              )}

              {commentAttachmentUrls.length > 0 && (
                <div className="flex gap-2 items-center">
                  {commentAttachmentUrls.map((url, idx) => (
                    <div key={idx} className="relative group">
                      <img src={url} alt="Comment preview" className="h-12 w-12 object-cover rounded-lg border border-slate-700" />
                      <button
                        type="button"
                        onClick={() => setCommentAttachmentUrls(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute -top-1 -right-1 bg-rose-600 text-white rounded-full h-4 w-4 flex items-center justify-center shadow"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          {(isAdmin || (isCreator && task.status === 'TODO')) ? (
            <button
              onClick={onDelete}
              className="inline-flex items-center space-x-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition-all"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete Task</span>
            </button>
          ) : (
            <div />
          )}

          <button
            onClick={onClose}
            className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// DEPARTMENT BACKLOG DRAWER (TEAM LEADER TASK DISTRIBUTION)
// -----------------------------------------------------------------------------

interface DepartmentBacklogDrawerProps {
  backlogTasks: Task[];
  employees: any[];
  currentEmployee?: any;
  onClose: () => void;
  onAssignTask: (taskId: string, assigneeId: string) => Promise<void>;
}

function DepartmentBacklogDrawer({
  backlogTasks,
  employees,
  currentEmployee,
  onClose,
  onAssignTask,
}: DepartmentBacklogDrawerProps) {
  const teamMembers = useMemo(() => {
    if (!currentEmployee) return employees;
    return employees.filter((e) => e.departmentId === currentEmployee.departmentId);
  }, [employees, currentEmployee]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md h-full bg-slate-900 border-l border-slate-800 p-6 flex flex-col space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Inbox className="h-4 w-4 text-amber-400" />
              <span>Department Backlog</span>
            </h3>
            <p className="text-xs text-slate-400">
              Cross-department requests waiting for team leader distribution.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3">
          {backlogTasks.length === 0 ? (
            <div className="py-20 text-center text-xs text-slate-500 italic">
              No unassigned tasks in your department backlog.
            </div>
          ) : (
            backlogTasks.map((t) => (
              <div
                key={t.id}
                className="rounded-xl border border-slate-800 bg-slate-800/80 p-4 space-y-2.5 shadow-md"
              >
                <div className="flex items-center justify-between text-[10px]">
                  <span className={`px-2 py-0.5 rounded font-bold border ${PRIORITY_BADGES[t.priority].bg} ${PRIORITY_BADGES[t.priority].text} ${PRIORITY_BADGES[t.priority].border}`}>
                    {t.priority}
                  </span>
                  <span className="text-indigo-400 font-mono">From: {t.creator?.fullName}</span>
                </div>

                <h4 className="text-xs font-bold text-white">{t.title}</h4>
                {t.description && <p className="text-[11px] text-slate-400 line-clamp-2">{t.description}</p>}

                {/* Team Leader Distribution Selector */}
                <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-medium">Assign to Member:</span>
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) {
                        onAssignTask(t.id, e.target.value);
                      }
                    }}
                    className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white focus:outline-none"
                  >
                    <option value="" disabled>Select member...</option>
                    {teamMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.fullName} ({m.employeeCode})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
