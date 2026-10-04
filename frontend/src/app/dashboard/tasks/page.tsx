'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  useTasks,
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
  FiPlus,
  FiInbox,
  FiUser,
  FiUsers,
  FiSend,
  FiGlobe,
  FiTrash2,
  FiImage,
  FiAlertCircle,
  FiCheckCircle,
  FiMessageSquare,
  FiClock,
  FiCheck,
  FiLayers,
  FiList,
  FiZap,
  FiSearch,
  FiCalendar,
  FiX,
  FiEye,
  FiRotateCcw,
  FiFilter,
} from 'react-icons/fi';
import { BiBuildingHouse } from 'react-icons/bi';
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
  title: z.string().min(1, 'عنوان المهمة مطلوب').max(255, 'العنوان طويل جداً'),
  description: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  assignmentType: z.enum(['DEPARTMENT', 'SELF_OR_TEAM']),
  targetId: z.string().min(1, 'يرجى تحديد القسم أو الموظف المعني'),
  dueDate: z.string().optional(),
});

type CreateTaskFormData = z.infer<typeof createTaskSchema>;

const revisionSchema = z.object({
  comment: z.string().min(3, 'يرجى تقديم 3 أحرف على الأقل لشرح سبب التعديل'),
});

type RevisionFormData = z.infer<typeof revisionSchema>;

const commentSchema = z.object({
  content: z.string().min(1, 'لا يمكن إرسال تعليق فارغ'),
});

type CommentFormData = z.infer<typeof commentSchema>;

// -----------------------------------------------------------------------------
// KANBAN COLUMN DEFINITIONS & PRIORITY STYLES
// -----------------------------------------------------------------------------

interface ColumnConfig {
  id: TaskStatus;
  title: string;
  badgeColor: string;
  headerBg: string;
  icon: React.ComponentType<{ className?: string }>;
}

const COLUMNS: ColumnConfig[] = [
  {
    id: 'TODO',
    title: 'قيد الانتظار',
    badgeColor: 'bg-surface-raised text-foreground-muted border-border',
    headerBg: 'bg-surface-raised/60',
    icon: FiList,
  },
  {
    id: 'IN_PROGRESS',
    title: 'قيد التنفيذ',
    badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    headerBg: 'bg-blue-500/5',
    icon: FiZap,
  },
  {
    id: 'REVIEW',
    title: 'تحت المراجعة والتدقيق',
    badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    headerBg: 'bg-purple-500/5',
    icon: FiSearch,
  },
  {
    id: 'WAITING_FOR_CLIENT',
    title: 'بانتظار العميل',
    badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    headerBg: 'bg-amber-500/5',
    icon: FiClock,
  },
  {
    id: 'NEEDS_REVISION',
    title: 'تتطلب تعديلات',
    badgeColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    headerBg: 'bg-rose-500/5',
    icon: FiAlertCircle,
  },
  {
    id: 'DONE',
    title: 'مكتملة ومعتمدة',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    headerBg: 'bg-emerald-500/5',
    icon: FiCheckCircle,
  },
];

// Task weights a Team Leader can choose (1 = normal task, 2 = heavy task); must match the API
const TASK_WEIGHTS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

const PRIORITY_BADGES: Record<TaskPriority, { bg: string; text: string; border: string; label: string }> = {
  LOW: { bg: 'bg-surface-raised', text: 'text-foreground-muted', border: 'border-border', label: 'منخفضة' },
  MEDIUM: { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/20', label: 'متوسطة' },
  HIGH: { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/20', label: 'مرتفعة' },
  URGENT: { bg: 'bg-rose-500/15', text: 'text-rose-600 dark:text-rose-400 font-bold animate-pulse', border: 'border-rose-500/30', label: 'عاجلة جداً' },
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

  // Filters State
  const [search, setSearch] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedPriority, setSelectedPriority] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'ALL' | 'MINE' | 'MY_DEPT' | 'CREATED_BY_ME'>(
    isAdmin ? 'ALL' : 'MINE',
  );

  // Modals & Panels State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
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
      }
    });

    // Sort tasks in each column by order ASC, then by createdAt DESC
    (Object.keys(grouped) as TaskStatus[]).forEach((status) => {
      grouped[status].sort((a, b) => {
        const orderA = a.order ?? 0;
        const orderB = b.order ?? 0;
        if (orderA !== orderB) return orderA - orderB;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    });

    return grouped;
  }, [tasks, filterMode, currentEmployee]);

  // Drag and Drop Handler (Supports column transitions and in-column reordering)
  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const sourceStatus = source.droppableId as TaskStatus;
    const destStatus = destination.droppableId as TaskStatus;
    const task = tasks.find((t) => t.id === draggableId);
    if (!task) return;

    // Trigger Revision Modal if moving to NEEDS_REVISION from another column
    if (destStatus === 'NEEDS_REVISION' && sourceStatus !== 'NEEDS_REVISION') {
      setRevisionModalTask(task);
      resetRevisionForm();
      setRevisionAttachmentUrls([]);
      return;
    }

    // Determine destination column items
    const destColumnItems = [...(tasksByColumn[destStatus] || [])];
    if (sourceStatus === destStatus) {
      const [moved] = destColumnItems.splice(source.index, 1);
      destColumnItems.splice(destination.index, 0, moved);
    } else {
      destColumnItems.splice(destination.index, 0, { ...task, status: destStatus });
    }

    // Calculate new clean order value
    let newOrder = 0;
    if (destColumnItems.length <= 1) {
      newOrder = 0;
    } else if (destination.index === 0) {
      const nextOrder = destColumnItems[1]?.order ?? 10;
      newOrder = nextOrder - 10;
    } else if (destination.index === destColumnItems.length - 1) {
      const prevOrder = destColumnItems[destColumnItems.length - 2]?.order ?? 0;
      newOrder = prevOrder + 10;
    } else {
      const prevOrder = destColumnItems[destination.index - 1]?.order ?? 0;
      const nextOrder = destColumnItems[destination.index + 1]?.order ?? (prevOrder + 20);
      newOrder = Math.round((prevOrder + nextOrder) / 2);
      if (newOrder === prevOrder || newOrder === nextOrder) {
        newOrder = prevOrder + 1;
      }
    }

    try {
      await updateStatusMutation.mutateAsync({
        id: draggableId,
        data: {
          status: destStatus,
          order: newOrder,
        },
      });
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || 'فشل تحديث أو إعادة ترتيب المهمة.');
    }
  };

  // Submit Revision
  const onConfirmRevision = async (data: RevisionFormData) => {
    if (!revisionModalTask) return;
    try {
      await updateStatusMutation.mutateAsync({
        id: revisionModalTask.id,
        data: {
          status: 'NEEDS_REVISION',
          comment: data.comment,
          attachmentUrls: revisionAttachmentUrls,
        },
      });
      setRevisionModalTask(null);
      setRevisionAttachmentUrls([]);
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || 'فشل إرسال طلب التعديل');
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
      alert(err.message || 'فشل رفع الصورة');
    } finally {
      setIsUploadingRevisionImg(false);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/20 pb-5">
        <div>
          <div className="flex items-center space-x-2 text-xs text-foreground-muted mb-1">
            <span>إدارة العمليات</span>
            <span>/</span>
            <span className="text-foreground font-medium">لوحة كانبان التفاعلية</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-3">
            <span>إدارة المهام وكانبان</span>
            <span className="text-xs font-mono font-bold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full border border-primary/20">
              {tasks.length} مهام
            </span>
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {canCreate && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary hover:bg-primary-hover px-5 py-2.5 text-xs font-black text-primary-foreground shadow-md shadow-primary/25 active:scale-95 transition-all"
            >
              <FiPlus className="h-4 w-4" />
              <span>إنشاء مهمة جديدة</span>
            </button>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-500 dark:text-rose-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FiAlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="p-1 hover:text-rose-600">
            <FiX className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 bg-card/70 border border-card-border p-4 rounded-3xl backdrop-blur-xl shadow-xs items-center">
        {/* Search */}
        <div className="sm:col-span-4 relative">
          <FiSearch className="absolute start-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-subtle" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالعنوان، مقدم الطلب، أو الموظف المعين..."
            className="w-full rounded-2xl border border-border bg-surface ps-10 pe-4 py-2.5 text-xs text-foreground placeholder-foreground-subtle focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
          />
        </div>

        {/* Filter by Department */}
        <div className="sm:col-span-3 relative">
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="w-full rounded-2xl border border-border bg-surface px-3.5 py-2.5 text-xs text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all appearance-none cursor-pointer"
          >
            <option value="">جميع الأقسام المعنية</option>
            {orgTree.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name} ({dept.code})
              </option>
            ))}
          </select>
          <FiFilter className="absolute end-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-subtle pointer-events-none" />
        </div>

        {/* Filter by Priority */}
        <div className="sm:col-span-2 relative">
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="w-full rounded-2xl border border-border bg-surface px-3.5 py-2.5 text-xs text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all appearance-none cursor-pointer"
          >
            <option value="">جميع الأولويات</option>
            <option value="LOW">منخفضة</option>
            <option value="MEDIUM">متوسطة</option>
            <option value="HIGH">مرتفعة</option>
            <option value="URGENT">عاجلة جداً</option>
          </select>
        </div>

        {/* Scope Filter Segment */}
        <div className="sm:col-span-3 flex rounded-2xl border border-border bg-surface p-1">
          <button
            type="button"
            onClick={() => setFilterMode('MINE')}
            className={`flex-1 rounded-xl py-1.5 text-[11px] font-bold transition-all ${
              filterMode === 'MINE'
                ? 'bg-primary text-primary-foreground shadow-md font-black'
                : 'text-foreground-muted hover:text-foreground'
            }`}
          >
            <span className="inline-flex items-center gap-1">
              <FiUser className="h-3 w-3" />
              <span>مهامي</span>
            </span>
          </button>

          {isTeamLeaderOrAdmin && (
            <button
              type="button"
              onClick={() => setFilterMode('MY_DEPT')}
              className={`flex-1 rounded-xl py-1.5 text-[11px] font-bold transition-all ${
                filterMode === 'MY_DEPT'
                  ? 'bg-primary text-primary-foreground shadow-md font-black'
                  : 'text-foreground-muted hover:text-foreground'
              }`}
            >
              <span className="inline-flex items-center gap-1">
                <BiBuildingHouse className="h-3 w-3" />
                <span>القسم</span>
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setFilterMode('CREATED_BY_ME')}
            className={`flex-1 rounded-xl py-1.5 text-[11px] font-bold transition-all ${
              filterMode === 'CREATED_BY_ME'
                ? 'bg-primary text-primary-foreground shadow-md font-black'
                : 'text-foreground-muted hover:text-foreground'
            }`}
          >
            <span className="inline-flex items-center gap-1">
              <FiSend className="h-3 w-3" />
              <span>طلباتي</span>
            </span>
          </button>

          {isTeamLeaderOrAdmin && (
            <button
              type="button"
              onClick={() => setFilterMode('ALL')}
              className={`flex-1 rounded-xl py-1.5 text-[11px] font-bold transition-all ${
                filterMode === 'ALL'
                  ? 'bg-primary text-primary-foreground shadow-md font-black'
                  : 'text-foreground-muted hover:text-foreground'
              }`}
            >
              <span className="inline-flex items-center gap-1">
                <FiGlobe className="h-3 w-3" />
                <span>الكل</span>
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-xs text-foreground-muted font-bold animate-pulse">جاري تحميل لوحة كانبان...</p>
          </div>
        </div>
      )}

      {/* 6-COLUMN KANBAN BOARD */}
      {!isLoading && !isError && (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5 items-start overflow-x-auto pb-4">
            {COLUMNS.map((column) => {
              const columnTasks = tasksByColumn[column.id] || [];

              return (
                <div
                  key={column.id}
                  className="flex flex-col rounded-3xl border border-white/40 dark:border-white/10 bg-white/35 dark:bg-black/40 backdrop-blur-2xl overflow-hidden shadow-xl"
                >
                  {/* Column Header */}
                  <div className={`p-3.5 border-b border-border/20 ${column.headerBg} flex items-center justify-between`}>
                    <div className="flex items-center gap-2 truncate">
                      <column.icon className="h-4 w-4 shrink-0 text-primary" />
                      <h2 className="text-xs font-black text-foreground truncate">
                        {column.title}
                      </h2>
                    </div>
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${column.badgeColor}`}
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
                        className={`p-2.5 space-y-2.5 min-h-[480px] transition-colors ${
                          snapshot.isDraggingOver ? 'bg-primary/5 rounded-2xl' : ''
                        }`}
                      >
                        {columnTasks.length === 0 ? (
                          <div className="h-32 flex items-center justify-center border-2 border-dashed border-border/50 rounded-2xl text-[11px] text-foreground-subtle italic">
                            فارغ
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
                                  className={`group relative rounded-2xl border border-white/40 dark:border-white/10 bg-white/50 dark:bg-black/45 hover:bg-white/70 dark:hover:bg-black/65 p-3.5 shadow-md hover:border-primary/50 hover:shadow-xl cursor-pointer transition-all ${
                                    dragSnapshot.isDragging
                                      ? 'border-primary shadow-2xl scale-102 bg-white/90 dark:bg-black/90 z-50 ring-2 ring-primary/40'
                                      : ''
                                  }`}
                                >
                                  {/* Top Badges: Priority & Routing */}
                                  <div className="flex items-center justify-between mb-2">
                                    <span
                                      className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[9px] font-bold border ${
                                        PRIORITY_BADGES[task.priority].bg
                                      } ${PRIORITY_BADGES[task.priority].text} ${
                                        PRIORITY_BADGES[task.priority].border
                                      }`}
                                    >
                                      {PRIORITY_BADGES[task.priority].label}
                                    </span>

                                    {task.targetDepartment && (
                                      <span className="rounded-lg bg-primary/10 px-2 py-0.5 text-[9px] font-mono text-primary border border-primary/20">
                                        → {task.targetDepartment.code}
                                      </span>
                                    )}
                                  </div>

                                  {/* Task Title */}
                                  <h3 className="text-xs font-black text-foreground group-hover:text-primary transition-colors line-clamp-2">
                                    {task.title}
                                  </h3>

                                  {/* Attachment image thumbnail if present */}
                                  {task.attachmentUrls && task.attachmentUrls.length > 0 && (
                                    <div className="mt-2.5 flex items-center gap-1.5 overflow-hidden rounded-xl bg-surface-raised p-1 border border-border">
                                      <img
                                        src={task.attachmentUrls[0]}
                                        alt="Task preview"
                                        className="h-10 w-full object-cover rounded-lg"
                                      />
                                      {task.attachmentUrls.length > 1 && (
                                        <span className="text-[9px] font-mono font-bold text-foreground-muted px-1">
                                          +{task.attachmentUrls.length - 1}
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  {/* Creator & Comments Count */}
                                  <div className="mt-2.5 flex items-center justify-between text-[10px] text-foreground-muted">
                                    <span className="truncate max-w-[100px]">
                                      من: {task.creator?.fullName?.split(' ')[0] || 'الإدارة'}
                                    </span>

                                    {!!task._count?.comments && (
                                      <span className="flex items-center gap-1 text-primary bg-primary/10 px-1.5 py-0.5 rounded-md font-mono">
                                        <FiMessageSquare className="h-3 w-3" />
                                        <span>{task._count.comments}</span>
                                      </span>
                                    )}
                                  </div>

                                  {/* Footer: Due Date & Assignee */}
                                  <div className="mt-2.5 pt-2 border-t border-border flex items-center justify-between text-[10px]">
                                    {task.dueDate ? (
                                      <div
                                        className={`flex items-center gap-1 ${
                                          new Date(task.dueDate) < new Date() && task.status !== 'DONE'
                                            ? 'text-rose-500 font-bold'
                                            : 'text-foreground-muted'
                                        }`}
                                      >
                                        <FiCalendar className="h-3 w-3" />
                                        <span>
                                          {new Date(task.dueDate).toLocaleDateString('ar-EG', {
                                            month: 'short',
                                            day: 'numeric',
                                          })}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-foreground-subtle">بدون موعد</span>
                                    )}

                                    {task.assignee ? (
                                      <div
                                        className="flex items-center gap-1.5 bg-surface-raised px-2 py-0.5 rounded-full border border-border"
                                        title={`المعين: ${task.assignee.fullName}`}
                                      >
                                        <div className="h-4 w-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[8px] font-bold">
                                          {task.assignee.fullName.charAt(0)}
                                        </div>
                                        <span className="text-foreground font-bold truncate max-w-[70px]">
                                          {task.assignee.fullName.split(' ')[0]}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-[9px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                                        غير مسند
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

      {/* CREATE TASK MODAL */}
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

      {/* TASK DETAILS MODAL */}
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
          onWeightChange={async (weight) => {
            await updateTaskMutation.mutateAsync({
              id: selectedTaskId,
              data: { weight },
            });
          }}
          onAddComment={async (content, attachmentUrls) => {
            await addCommentMutation.mutateAsync({
              taskId: selectedTaskId,
              data: { content, attachmentUrls },
            });
          }}
          onDelete={async () => {
            if (confirm('هل أنت متأكد من حذف هذه المهمة نهائياً؟')) {
              await deleteTaskMutation.mutateAsync(selectedTaskId);
              setSelectedTaskId(null);
            }
          }}
          onPreviewImage={(url) => setActivePreviewImage(url)}
        />
      )}

      {/* REVISION EXPLANATION MODAL */}
      {revisionModalTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="relative overflow-hidden w-full max-w-md max-h-[85vh] flex flex-col rounded-3xl border border-white/30 dark:border-white/10 bg-white/90 dark:bg-[#141411]/95 backdrop-blur-3xl shadow-2xl">
            {/* Top Specular Rim */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-rose-500/50 to-transparent z-10" />

            <div className="px-6 py-5 border-b border-border/30 dark:border-white/10 flex items-center justify-between bg-surface/40 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center shadow-inner">
                  <FiAlertCircle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-foreground">طلب تعديلات وإعادة المهمة</h3>
                  <p className="text-[11px] text-foreground-muted">توضيح متطلبات وملاحظات الجودة للمسؤول</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRevisionModalTask(null)}
                className="h-8 w-8 rounded-xl flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors"
                title="إغلاق"
              >
                <FiX className="h-4 w-4" />
              </button>
            </div>

            <form id="revision-form" onSubmit={handleRevisionSubmit(onConfirmRevision)} className="flex-1 overflow-y-auto px-6 py-5 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">
                  تفاصيل وملاحظات التعديل <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  {...registerRevision('comment')}
                  placeholder="مثال: يرجى تعديل ألوان الأزرار لتطابق هوية النظام والتأكد من التجاوب مع الجوال..."
                  className={`w-full rounded-2xl border bg-surface/80 p-3 text-xs text-foreground placeholder:text-foreground-subtle focus:bg-surface focus:outline-none focus:ring-2 focus:ring-rose-500/20 resize-none ${
                    revisionErrors.comment ? 'border-rose-500' : 'border-border/80 dark:border-white/10 focus:border-rose-500'
                  }`}
                />
                {revisionErrors.comment && (
                  <p className="text-[10px] text-rose-500 mt-1 font-bold">{revisionErrors.comment.message}</p>
                )}
              </div>

              {/* ImgBB Attachment upload in Revision */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-foreground">
                  إرفاق لقطة شاشة للتوضيح (اختياري)
                </label>
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer inline-flex items-center gap-2 rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 px-4 py-2 text-xs font-bold text-foreground hover:bg-surface-hover transition-colors shadow-xs">
                    <FiImage className="h-4 w-4 text-primary" />
                    <span>رفع صورة</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleRevisionImageUpload}
                      className="hidden"
                    />
                  </label>
                  {isUploadingRevisionImg && (
                    <span className="text-[11px] text-primary animate-pulse font-mono font-bold">جاري الرفع...</span>
                  )}
                </div>

                {revisionAttachmentUrls.length > 0 && (
                  <div className="mt-2 flex gap-2 overflow-x-auto py-1">
                    {revisionAttachmentUrls.map((url, idx) => (
                      <div key={idx} className="relative group">
                        <img src={url} alt="Attachment" className="h-14 w-14 object-cover rounded-2xl border border-border/60 shadow-xs" />
                        <button
                          type="button"
                          onClick={() => setRevisionAttachmentUrls(prev => prev.filter((_, i) => i !== idx))}
                          className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white rounded-full h-5 w-5 flex items-center justify-center shadow-md hover:bg-rose-600 transition-colors"
                        >
                          <FiX className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </form>

            <div className="px-6 py-4 border-t border-border/30 dark:border-white/10 bg-surface/60 dark:bg-white/[0.02] backdrop-blur-xl flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setRevisionModalTask(null)}
                className="rounded-2xl border border-border/80 bg-surface px-5 py-2.5 text-xs font-bold text-foreground hover:bg-surface-hover transition-colors shadow-xs"
              >
                إلغاء
              </button>
              <button
                form="revision-form"
                type="submit"
                disabled={isRevisionSubmitting || updateStatusMutation.isPending}
                className="rounded-2xl bg-rose-500 hover:bg-rose-600 px-6 py-2.5 text-xs font-black text-white shadow-md active:scale-95 disabled:opacity-50 transition-all"
              >
                إرسال طلب التعديل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX FULL IMAGE PREVIEW */}
      {activePreviewImage && (
        <div
          onClick={() => setActivePreviewImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 cursor-zoom-out animate-in fade-in"
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={activePreviewImage}
              alt="Full Preview"
              className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl"
            />
            <button
              onClick={() => setActivePreviewImage(null)}
              className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-card/80 text-foreground px-3 py-1.5 text-xs hover:bg-surface transition-colors"
            >
              <FiX className="h-3.5 w-3.5" />
              <span>إغلاق</span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

// -----------------------------------------------------------------------------
// CREATE TASK MODAL
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
      setSubmitError(err.message || 'فشل رفع الصورة إلى ImgBB');
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
      setSubmitError(err?.response?.data?.message || 'فشل إنشاء المهمة.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="relative overflow-hidden w-full max-w-xl max-h-[88vh] flex flex-col rounded-3xl border border-white/30 dark:border-white/10 bg-white/90 dark:bg-[#141411]/95 backdrop-blur-3xl shadow-2xl">
        {/* Specular Rim Light */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent z-10" />

        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-border/30 dark:border-white/10 flex items-center justify-between bg-surface/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-inner">
              <FiPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-foreground">إنشاء مهمة عمل جديدة</h2>
              <p className="text-[11px] text-foreground-muted">تحديد تفاصيل ومخرجات المهمة وإسنادها للمعين</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-xl flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors"
            title="إغلاق"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body with Smooth Scroll */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {submitError && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-500 dark:text-rose-400 flex items-center gap-2">
              <FiAlertCircle className="h-4 w-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <form id="create-task-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Section 1: Assignment Routing */}
            <div className="space-y-2 p-3.5 rounded-2xl bg-surface/40 border border-border/40 dark:border-white/5">
              <label className="block text-xs font-black text-foreground">
                مسار وتوجيه المهمة <span className="text-rose-500">*</span>
              </label>
              
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface p-1 border border-border/60">
                <button
                  type="button"
                  onClick={() => {
                    setValue('assignmentType', 'SELF_OR_TEAM');
                    setValue('targetId', currentEmployee?.id || employees[0]?.id || '');
                  }}
                  className={`py-2 rounded-lg text-xs font-bold transition-all ${
                    assignmentType === 'SELF_OR_TEAM'
                      ? 'bg-primary text-primary-foreground shadow-sm font-black'
                      : 'text-foreground-muted hover:text-foreground'
                  }`}
                >
                  {isTeamLeaderOrAdmin ? (
                    <span className="inline-flex items-center gap-1.5">
                      <FiUsers className="h-3.5 w-3.5" />
                      <span>إسناد لنفسي / الفريق</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <FiUser className="h-3.5 w-3.5" />
                      <span>إسناد ذاتي (لنفسي)</span>
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setValue('assignmentType', 'DEPARTMENT');
                    setValue('targetId', availableDepartments[0]?.id || '');
                  }}
                  className={`py-2 rounded-lg text-xs font-bold transition-all ${
                    assignmentType === 'DEPARTMENT'
                      ? 'bg-primary text-primary-foreground shadow-sm font-black'
                      : 'text-foreground-muted hover:text-foreground'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <BiBuildingHouse className="h-3.5 w-3.5" />
                    <span>توجيه لقسم آخر</span>
                  </span>
                </button>
              </div>

              {/* Dynamic Target Selector */}
              <div className="pt-1">
                {assignmentType === 'DEPARTMENT' ? (
                  <select
                    {...register('targetId')}
                    className={`w-full rounded-xl border bg-surface px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                      errors.targetId ? 'border-rose-500' : 'border-border focus:border-primary'
                    }`}
                  >
                    <option value="">اختر القسم المستهدف...</option>
                    {availableDepartments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name} ({dept.code})
                      </option>
                    ))}
                  </select>
                ) : isTeamLeaderOrAdmin ? (
                  <select
                    {...register('targetId')}
                    className={`w-full rounded-xl border bg-surface px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                      errors.targetId ? 'border-rose-500' : 'border-border focus:border-primary'
                    }`}
                  >
                    <option value="">اختر الموظف المعين بالمهمة...</option>
                    {selectableEmployees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.fullName} ({emp.employeeCode}) {emp.id === currentEmployee?.id ? '(أنت)' : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-3.5 py-2.5 text-xs text-foreground">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="font-bold">{currentEmployee?.fullName || 'أنت'}</span>
                      <span className="text-foreground-muted font-mono text-[11px]">({currentEmployee?.employeeCode || 'Self'})</span>
                    </div>
                    <span className="text-[10px] text-primary bg-primary/10 px-2.5 py-0.5 rounded-md border border-primary/20 font-bold">
                      إسناد ذاتي
                    </span>
                    <input type="hidden" {...register('targetId')} value={currentEmployee?.id || ''} />
                  </div>
                )}
                {errors.targetId && (
                  <p className="text-[10px] text-rose-500 mt-1">{errors.targetId.message}</p>
                )}
              </div>
            </div>

            {/* Section 2: Task Information */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">
                  عنوان المهمة <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  {...register('title')}
                  placeholder="مثال: تصميم شاشة الدفع الإلكتروني وتكامل الـ API..."
                  className={`w-full rounded-2xl border bg-surface/80 px-4 py-2.5 text-xs text-foreground placeholder:text-foreground-subtle focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                    errors.title ? 'border-rose-500' : 'border-border focus:border-primary'
                  }`}
                />
                {errors.title && (
                  <p className="text-[10px] text-rose-500 mt-1">{errors.title.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">
                  الوصف والمخرجات المطلوبة
                </label>
                <textarea
                  rows={3}
                  {...register('description')}
                  placeholder="المتطلبات، المخرجات المستهدفة، وروابط المراجع والملاحظات..."
                  className="w-full rounded-2xl border border-border bg-surface/80 px-4 py-2.5 text-xs text-foreground placeholder:text-foreground-subtle focus:bg-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </div>
            </div>

            {/* Section 3: Priority & Due Date Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-foreground flex items-center gap-1.5">
                  <FiAlertCircle className="h-3.5 w-3.5 text-primary" />
                  <span>درجة الأولوية</span>
                </label>
                <select
                  {...register('priority')}
                  className="w-full rounded-2xl border border-border bg-surface/80 px-3.5 py-2.5 text-xs text-foreground focus:bg-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="LOW">🟢 منخفضة</option>
                  <option value="MEDIUM">🟡 متوسطة</option>
                  <option value="HIGH">🟠 مرتفعة</option>
                  <option value="URGENT">🔴 عاجلة جداً</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-foreground flex items-center gap-1.5">
                  <FiCalendar className="h-3.5 w-3.5 text-primary" />
                  <span>الموعد النهائي (Due Date)</span>
                </label>
                <input
                  type="date"
                  {...register('dueDate')}
                  className="w-full rounded-2xl border border-border bg-surface/80 px-3.5 py-2.5 text-xs text-foreground focus:bg-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                />
              </div>
            </div>

            {/* Section 4: ImgBB Images Upload */}
            <div className="space-y-2 p-3.5 rounded-2xl bg-surface/40 border border-border/40 dark:border-white/5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <FiImage className="h-3.5 w-3.5 text-primary" />
                  <span>المرفقات والصور التوضيحية</span>
                </label>
                {isUploading && (
                  <span className="text-[10px] text-primary animate-pulse font-mono font-bold">
                    جاري الرفع إلى ImgBB...
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <label className="cursor-pointer inline-flex items-center gap-2 rounded-2xl border border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 px-4 py-2 text-xs font-bold text-primary transition-all active:scale-95 shadow-xs">
                  <FiImage className="h-4 w-4" />
                  <span>اختر الصور المرفقة</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
                <span className="text-[11px] text-foreground-muted">PNG, JPG, WebP (تخزين سحابي مباشر)</span>
              </div>

              {/* Uploaded Thumbnails */}
              {attachmentUrls.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 pt-2">
                  {attachmentUrls.map((url, idx) => (
                    <div key={idx} className="relative group rounded-xl overflow-hidden border border-border bg-surface aspect-video shadow-xs">
                      <img src={url} alt={`Attachment ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeAttachment(idx)}
                        className="absolute top-1 end-1 bg-rose-500 hover:bg-rose-600 text-white rounded-full p-1 text-[10px] shadow-md flex items-center justify-center transition-transform hover:scale-110"
                        title="حذف الصورة"
                      >
                        <FiX className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-border/30 dark:border-white/10 bg-surface/60 dark:bg-white/[0.02] backdrop-blur-xl flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-border/80 bg-surface px-5 py-2.5 text-xs font-bold text-foreground hover:bg-surface-hover transition-colors shadow-xs"
          >
            إلغاء
          </button>
          <button
            form="create-task-form"
            type="submit"
            disabled={isSubmitting || isUploading}
            className="rounded-2xl btn-glow-primary px-6 py-2.5 text-xs font-black text-brand-stone-950 shadow-md active:scale-95 disabled:opacity-50 transition-all"
          >
            {isSubmitting ? 'جاري إنشاء المهمة...' : 'إنشاء المهمة'}
          </button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// TASK DETAILS MODAL
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
  onWeightChange: (weight: number) => Promise<void>;
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
  onWeightChange,
  onAddComment,
  onDelete,
  onPreviewImage,
}: TaskDetailsModalProps) {
  const { data: task, isLoading } = useTask(taskId);

  const [commentAttachmentUrls, setCommentAttachmentUrls] = useState<string[]>([]);
  const [isUploadingCommentImg, setIsUploadingCommentImg] = useState(false);

  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectComment, setRejectComment] = useState('');
  const [rejectAttachmentUrls, setRejectAttachmentUrls] = useState<string[]>([]);
  const [isUploadingRejectImg, setIsUploadingRejectImg] = useState(false);

  const [selectedAssignee, setSelectedAssignee] = useState<string>('');

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
  // Team Leaders weigh their department's tasks (commission multiplier); the server enforces the exact rule
  const canWeigh = isTargetLeader || isAdmin || !!user?.isManagement;

  const assignableEmployees = useMemo(() => {
    if (isAdmin) return employees;
    const targetDeptId = task?.targetDepartmentId || currentEmployee?.departmentId;
    if (targetDeptId) {
      return employees.filter((e) => e.departmentId === targetDeptId);
    }
    return employees;
  }, [employees, task?.targetDepartmentId, currentEmployee?.departmentId, isAdmin]);

  const handleCommentImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingCommentImg(true);
    try {
      const file = files[0];
      const url = await uploadImageToImgBB(file);
      setCommentAttachmentUrls((prev) => [...prev, url]);
    } catch (err: any) {
      alert(err.message || 'فشل رفع الصورة');
    } finally {
      setIsUploadingCommentImg(false);
      e.target.value = '';
    }
  };

  const onPostComment = async (data: CommentFormData) => {
    if (!data.content?.trim() && commentAttachmentUrls.length === 0) return;

    const content = data.content?.trim() || 'أرفق صورة:';
    const attachments = [...commentAttachmentUrls];
    
    resetCommentForm();
    setCommentAttachmentUrls([]);

    await onAddComment(content, attachments);
  };

  if (isLoading || !task) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div className="p-8 rounded-3xl bg-card border border-border text-center text-xs text-foreground-muted">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-2" />
          جاري تحميل تفاصيل المهمة...
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="relative overflow-hidden w-full max-w-2xl max-h-[88vh] flex flex-col rounded-3xl border border-white/30 dark:border-white/10 bg-white/90 dark:bg-[#141411]/95 backdrop-blur-3xl shadow-2xl">
        {/* Specular Rim Highlight */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent z-10" />

        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-border/30 dark:border-white/10 flex items-center justify-between bg-surface/40 shrink-0">
          <div>
            <div className="flex items-center gap-2 text-[10px] text-foreground-muted mb-1 font-bold">
              <span>الحالة:</span>
              <span className="font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">{task.status}</span>
              {task.targetDepartment && (
                <>
                  <span>•</span>
                  <span>القسم: {task.targetDepartment.name}</span>
                </>
              )}
            </div>
            <h2 className="text-base font-black text-foreground">{task.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-xl flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors"
            title="إغلاق"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Creator State Machine Action Bar */}
          {isCreator && ['REVIEW', 'WAITING_FOR_CLIENT'].includes(task.status) && (
            <div className="rounded-3xl border border-primary/30 bg-primary/10 p-5 space-y-3">
              <div>
                <h4 className="text-xs font-black text-primary">قرار اعتماد المهمة مطلوب من قبلك</h4>
                <p className="text-[11px] text-foreground-muted">
                  تم تسليم هذه المهمة للمراجعة. يمكنك اعتمادها وإغلاقها أو طلب تعديلات إضافية.
                </p>
              </div>

              {!isRejecting ? (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onStatusChange('DONE')}
                    className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 px-4 py-2 text-xs font-black text-white shadow-md active:scale-95 transition-all"
                  >
                    <FiCheckCircle className="h-4 w-4" />
                    <span>اعتماد المهمة كمنجزة</span>
                  </button>

                  <button
                    onClick={() => setIsRejecting(true)}
                    className="inline-flex items-center gap-1.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 px-4 py-2 text-xs font-black text-rose-500 hover:bg-rose-500/20 transition-all"
                  >
                    <FiRotateCcw className="h-4 w-4" />
                    <span>طلب تعديلات وإعادة</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5 pt-2 border-t border-primary/20">
                  <textarea
                    rows={2}
                    value={rejectComment}
                    onChange={(e) => setRejectComment(e.target.value)}
                    placeholder="اكتب الملاحظات والتعديلات المطلوبة بوضوح..."
                    className="w-full rounded-2xl border border-border bg-surface p-2.5 text-xs text-foreground focus:border-rose-500 focus:outline-none resize-none"
                  />

                  {/* Reject image upload */}
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-2.5 py-1 text-[11px] text-foreground hover:bg-surface-hover">
                      <FiImage className="h-3.5 w-3.5 text-primary" />
                      <span>إرفاق لقطة شاشة (ImgBB)</span>
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
                      <span className="text-[10px] text-primary animate-pulse">جاري الرفع...</span>
                    )}
                  </div>

                  {rejectAttachmentUrls.length > 0 && (
                    <div className="flex gap-2">
                      {rejectAttachmentUrls.map((url, i) => (
                        <img
                          key={i}
                          src={url}
                          alt="Reject attachment"
                          className="h-10 w-10 object-cover rounded-xl border border-border"
                        />
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => onStatusChange('NEEDS_REVISION', rejectComment, rejectAttachmentUrls)}
                      disabled={!rejectComment.trim()}
                      className="rounded-2xl bg-rose-500 hover:bg-rose-600 px-4 py-1.5 text-xs font-black text-white disabled:opacity-50"
                    >
                      إرسال التعديل
                    </button>
                    <button
                      onClick={() => setIsRejecting(false)}
                      className="rounded-2xl border border-border px-3 py-1.5 text-xs font-bold text-foreground"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quick Info Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-surface/50 p-4 rounded-3xl border border-border text-xs">
            <div>
              <span className="text-[10px] text-foreground-muted block font-bold">مقدم الطلب</span>
              <span className="text-foreground font-extrabold">{task.creator?.fullName || 'الإدارة'}</span>
            </div>
            <div>
              <span className="text-[10px] text-foreground-muted block font-bold">الأولوية</span>
              <span className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold ${PRIORITY_BADGES[task.priority].bg} ${PRIORITY_BADGES[task.priority].text}`}>
                {PRIORITY_BADGES[task.priority].label}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-foreground-muted block font-bold">الموعد النهائي</span>
              <span className="text-foreground font-mono">
                {task.dueDate ? new Date(task.dueDate).toLocaleDateString('ar-EG') : 'بدون موعد'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-foreground-muted block font-bold">المعين بالمهمة</span>
              {canReassign ? (
                <select
                  value={selectedAssignee}
                  onChange={(e) => {
                    setSelectedAssignee(e.target.value);
                    onAssigneeChange(e.target.value);
                  }}
                  className="mt-1 rounded-xl border border-border bg-surface-raised px-2 py-1 text-[11px] text-foreground focus:outline-none"
                >
                  <option value="">غير مسند</option>
                  {assignableEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} ({emp.employeeCode})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="mt-1 flex items-center gap-1.5 text-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span className="font-bold">{task.assignee?.fullName || 'غير مسند'}</span>
                </div>
              )}
            </div>
            <div>
              <span className="text-[10px] text-foreground-muted block font-bold">وزن المهمة</span>
              {canWeigh ? (
                <select
                  value={String(Number(task.weight ?? 1))}
                  onChange={(e) => {
                    onWeightChange(Number(e.target.value)).catch((err: any) =>
                      alert(err?.response?.data?.message || 'فشل تحديث وزن المهمة'),
                    );
                  }}
                  className="mt-1 rounded-xl border border-border bg-surface-raised px-2 py-1 text-[11px] text-foreground focus:outline-none font-mono"
                  title="المهمة العادية = 1، المهمة الكبيرة = 2 ..."
                >
                  {TASK_WEIGHTS.map((weight) => (
                    <option key={weight} value={String(weight)}>
                      {weight === 1 ? '1 (عادية)' : weight}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="mt-1 block font-mono font-bold text-foreground">
                  {Number(task.weight ?? 1)}
                </span>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <h4 className="text-xs font-black text-foreground mb-1.5">الوصف والتوجيهات</h4>
            <div className="p-4 rounded-2xl border border-border bg-surface/50 text-xs text-foreground leading-relaxed whitespace-pre-wrap">
              {task.description || 'لا يوجد وصف مدون لهذه المهمة.'}
            </div>
          </div>

          {/* Task Attachments Gallery */}
          {task.attachmentUrls && task.attachmentUrls.length > 0 && (
            <div>
              <h4 className="text-xs font-black text-foreground mb-2">
                الصور المرفقة بالمهمة ({task.attachmentUrls.length})
              </h4>
              <div className="grid grid-cols-3 gap-2">
                {task.attachmentUrls.map((url, idx) => (
                  <div
                    key={idx}
                    onClick={() => onPreviewImage(url)}
                    className="relative group rounded-2xl overflow-hidden border border-border bg-surface aspect-video cursor-zoom-in hover:border-primary transition-all"
                  >
                    <img src={url} alt={`Task attachment ${idx + 1}`} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity">
                      <span className="inline-flex items-center gap-1">
                        <FiEye className="h-3.5 w-3.5" />
                        <span>عرض</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Live Comments & Revision Timeline */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-foreground">
              التعليقات وسجل الملاحظات ({task.comments?.length || 0})
            </h4>

            <div className="space-y-2.5 max-h-64 overflow-y-auto">
              {(!task.comments || task.comments.length === 0) ? (
                <p className="text-xs text-foreground-subtle italic p-3 text-center border border-dashed border-border rounded-2xl">
                  لا توجد تعليقات أو مناقشات بعد.
                </p>
              ) : (
                task.comments.map((c) => (
                  <div key={c.id} className="p-3.5 rounded-2xl border border-border bg-surface text-xs space-y-2">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-extrabold text-primary">{c.author.fullName}</span>
                      <span className="text-foreground-muted font-mono">
                        {new Date(c.createdAt).toLocaleDateString('ar-EG')} {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-foreground whitespace-pre-wrap">{c.content}</p>

                    {/* Comment image attachments if any */}
                    {c.attachmentUrls && c.attachmentUrls.length > 0 && (
                      <div className="flex gap-2 pt-1">
                        {c.attachmentUrls.map((imgUrl, i) => (
                          <img
                            key={i}
                            src={imgUrl}
                            alt="Comment attachment"
                            onClick={() => onPreviewImage(imgUrl)}
                            className="h-16 w-24 object-cover rounded-xl border border-border cursor-zoom-in hover:opacity-90"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Comment Form */}
            <form onSubmit={handleCommentSubmit(onPostComment)} className="space-y-2 pt-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  {...registerComment('content')}
                  placeholder="اكتب تعليقاً أو استفساراً..."
                  className="flex-1 rounded-2xl border border-border bg-surface px-3.5 py-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
                />

                {/* ImgBB upload button */}
                <label
                  className="cursor-pointer inline-flex items-center justify-center rounded-2xl border border-border bg-surface px-3.5 py-2.5 text-foreground hover:bg-surface-hover"
                  title="إرفاق صورة بالتعليق"
                >
                  <FiImage className="h-4 w-4 text-primary" />
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
                  className="rounded-2xl btn-glow-primary px-5 py-2.5 text-xs font-black text-brand-stone-950 shadow-md disabled:opacity-50"
                >
                  إرسال
                </button>
              </div>

              {isUploadingCommentImg && (
                <p className="text-[10px] text-primary font-mono animate-pulse">جاري رفع الصورة إلى ImgBB...</p>
              )}

              {commentAttachmentUrls.length > 0 && (
                <div className="flex gap-2 items-center">
                  {commentAttachmentUrls.map((url, idx) => (
                    <div key={idx} className="relative group">
                      <img src={url} alt="Comment preview" className="h-12 w-12 object-cover rounded-xl border border-border" />
                      <button
                        type="button"
                        onClick={() => setCommentAttachmentUrls(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute -top-1 -right-1 bg-rose-500 text-white rounded-full h-4 w-4 flex items-center justify-center shadow"
                      >
                        <FiX className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/30 dark:border-white/10 bg-surface/60 dark:bg-white/[0.02] backdrop-blur-xl flex items-center justify-between shrink-0">
          {(isAdmin || (isCreator && task.status === 'TODO')) ? (
            <button
              onClick={onDelete}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-xs font-bold text-rose-500 hover:bg-rose-500/20 transition-all"
            >
              <FiTrash2 className="h-3.5 w-3.5" />
              <span>حذف المهمة</span>
            </button>
          ) : (
            <div />
          )}

          <button
            onClick={onClose}
            className="rounded-2xl border border-border/80 bg-surface px-5 py-2.5 text-xs font-bold text-foreground hover:bg-surface-hover transition-colors shadow-xs"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
