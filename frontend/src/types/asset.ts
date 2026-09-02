export type AssetType = 'HARDWARE' | 'SOFTWARE' | 'FURNITURE' | 'OTHER';

export type AssetStatus = 'AVAILABLE' | 'ASSIGNED' | 'IN_MAINTENANCE' | 'RETIRED';

export interface AssetAssignee {
  id: string;
  fullName: string;
  employeeCode: string;
  avatarUrl?: string | null;
  department?: {
    id: string;
    name: string;
    code: string;
  } | null;
  position?: {
    id: string;
    name: string;
  } | null;
}

export interface AssetAssignmentHistory {
  id: string;
  assetId: string;
  employeeId: string;
  employee?: {
    id: string;
    fullName: string;
    employeeCode: string;
    avatarUrl?: string | null;
    department?: { id: string; name: string; code?: string } | null;
  };
  asset?: {
    id: string;
    name: string;
    serialNumber: string;
    type: AssetType;
    model?: string | null;
    manufacturer?: string | null;
  };
  assignedAt: string;
  returnedAt?: string | null;
  conditionNotes?: string | null;
  assignedById?: string | null;
  assignedBy?: {
    id: string;
    fullName: string;
    employeeCode: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface Asset {
  id: string;
  name: string;
  serialNumber: string;
  type: AssetType;
  status: AssetStatus;
  model?: string | null;
  manufacturer?: string | null;
  purchaseDate?: string | null;
  purchaseCost?: number | null;
  warrantyExpiry?: string | null;
  notes?: string | null;
  imageUrl?: string | null;
  assigneeId?: string | null;
  assignee?: AssetAssignee | null;
  assignmentHistory?: AssetAssignmentHistory[];
  createdAt: string;
  updatedAt: string;
}

export interface AssetStats {
  totalAssets: number;
  availableCount: number;
  assignedCount: number;
  maintenanceCount: number;
  retiredCount: number;
  byType: {
    hardware: number;
    software: number;
    furniture: number;
    other: number;
  };
  totalValuation: number;
}

export interface CreateAssetInput {
  name: string;
  serialNumber: string;
  type: AssetType;
  model?: string;
  manufacturer?: string;
  purchaseDate?: string;
  purchaseCost?: number;
  warrantyExpiry?: string;
  notes?: string;
  imageUrl?: string;
  assigneeId?: string;
  conditionNotes?: string;
}

export interface UpdateAssetInput {
  name?: string;
  serialNumber?: string;
  type?: AssetType;
  status?: AssetStatus;
  model?: string;
  manufacturer?: string;
  purchaseDate?: string;
  purchaseCost?: number;
  warrantyExpiry?: string;
  notes?: string;
  imageUrl?: string;
}

export interface AssignAssetInput {
  employeeId: string;
  conditionNotes?: string;
}

export interface ReturnAssetInput {
  conditionNotes?: string;
  status?: AssetStatus;
}

export interface QueryAssetsParams {
  search?: string;
  type?: AssetType;
  status?: AssetStatus;
  assigneeId?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedAssetsResponse {
  data: Asset[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
