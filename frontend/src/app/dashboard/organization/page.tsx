'use client';

import React, { useState } from 'react';
import {
  useOrganizationTree,
  useCreateDepartment,
  useDeleteDepartment,
  useCreatePosition,
  useDeletePosition,
  useCreateLevel,
  useDeleteLevel,
} from '../../../hooks/use-organization';
import { useAuth } from '../../../hooks/use-auth';
import { AxiosError } from 'axios';

export default function OrganizationPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('org.manage');

  const { data: departments, isLoading, isError, error } = useOrganizationTree();
  const createDeptMutation = useCreateDepartment();
  const deleteDeptMutation = useDeleteDepartment();
  const createPosMutation = useCreatePosition();
  const deletePosMutation = useDeletePosition();
  const createLvlMutation = useCreateLevel();
  const deleteLvlMutation = useDeleteLevel();

  // Modals state
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [isPosModalOpen, setIsPosModalOpen] = useState(false);
  const [isLvlModalOpen, setIsLvlModalOpen] = useState(false);

  // Form states
  const [deptForm, setDeptForm] = useState({ name: '', code: '', description: '' });
  const [posForm, setPosForm] = useState({ name: '', departmentId: '', description: '' });
  const [lvlForm, setLvlForm] = useState({ name: '', positionId: '', rank: 1, description: '' });

  const [actionError, setActionError] = useState<string | null>(null);

  const handleCreateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      await createDeptMutation.mutateAsync(deptForm);
      setDeptForm({ name: '', code: '', description: '' });
      setIsDeptModalOpen(false);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to create department';
      setActionError(Array.isArray(msg) ? msg.join(', ') : msg);
    }
  };

  const handleCreatePos = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      await createPosMutation.mutateAsync(posForm);
      setPosForm({ name: '', departmentId: '', description: '' });
      setIsPosModalOpen(false);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to create position';
      setActionError(Array.isArray(msg) ? msg.join(', ') : msg);
    }
  };

  const handleCreateLvl = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      await createLvlMutation.mutateAsync({
        ...lvlForm,
        rank: Number(lvlForm.rank) || 1,
      });
      setLvlForm({ name: '', positionId: '', rank: 1, description: '' });
      setIsLvlModalOpen(false);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to create level';
      setActionError(Array.isArray(msg) ? msg.join(', ') : msg);
    }
  };

  const handleDeleteDept = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete department '${name}'?`)) return;
    setActionError(null);
    try {
      await deleteDeptMutation.mutateAsync(id);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to delete department';
      setActionError(Array.isArray(msg) ? msg.join(', ') : msg);
    }
  };

  const handleDeletePos = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete position '${name}'?`)) return;
    setActionError(null);
    try {
      await deletePosMutation.mutateAsync(id);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to delete position';
      setActionError(Array.isArray(msg) ? msg.join(', ') : msg);
    }
  };

  const handleDeleteLvl = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete level '${name}'?`)) return;
    setActionError(null);
    try {
      await deleteLvlMutation.mutateAsync(id);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to delete level';
      setActionError(Array.isArray(msg) ? msg.join(', ') : msg);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Organization Hierarchy
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Manage enterprise business units, job positions, and seniority levels.
          </p>
        </div>

        {canManage && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                setActionError(null);
                setIsDeptModalOpen(true);
              }}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-600/30 hover:bg-indigo-500 transition-colors"
            >
              + Add Department
            </button>
            <button
              onClick={() => {
                setActionError(null);
                if (departments && departments.length > 0) {
                  setPosForm((p) => ({ ...p, departmentId: departments[0].id }));
                }
                setIsPosModalOpen(true);
              }}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
            >
              + Add Position
            </button>
          </div>
        )}
      </div>

      {/* Error Alert Banner */}
      {actionError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400 flex items-center justify-between">
          <span>{actionError}</span>
          <button
            onClick={() => setActionError(null)}
            className="text-red-400 hover:text-white font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Hierarchical Tree Cards */}
      <div className="space-y-6">
        {departments?.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-800 p-12 text-center text-slate-500 text-sm">
            No departments configured yet. Click "+ Add Department" to create your first unit.
          </div>
        )}

        {departments?.map((dept) => (
          <div
            key={dept.id}
            className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-sm transition-all"
          >
            {/* Department Head Row */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center space-x-3">
                  <span className="rounded-md bg-indigo-500/20 border border-indigo-500/30 px-2.5 py-0.5 font-mono text-xs font-bold text-indigo-300">
                    {dept.code}
                  </span>
                  <h2 className="text-lg font-bold text-white">{dept.name}</h2>
                </div>
                {dept.description && (
                  <p className="mt-1.5 text-xs text-slate-400">{dept.description}</p>
                )}
              </div>

              {canManage && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      setPosForm({ name: '', departmentId: dept.id, description: '' });
                      setIsPosModalOpen(true);
                    }}
                    className="rounded-md bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-indigo-400 hover:bg-slate-700 transition-colors"
                  >
                    + Position
                  </button>
                  <button
                    onClick={() => handleDeleteDept(dept.id, dept.name)}
                    className="rounded-md bg-slate-800/80 px-2.5 py-1 text-[11px] font-semibold text-red-400 hover:bg-red-500/20 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>

            {/* Positions List in this Department */}
            <div className="mt-6 space-y-4">
              {dept.positions.length === 0 ? (
                <p className="text-xs italic text-slate-500 pl-4 border-l-2 border-slate-800">
                  No positions defined in this department.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-4 pl-3 border-l-2 border-indigo-500/20">
                  {dept.positions.map((pos) => (
                    <div
                      key={pos.id}
                      className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-200">
                            {pos.name}
                          </h3>
                          {pos.description && (
                            <p className="text-xs text-slate-400 mt-0.5">
                              {pos.description}
                            </p>
                          )}
                        </div>

                        {canManage && (
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => {
                                setLvlForm({
                                  name: '',
                                  positionId: pos.id,
                                  rank: pos.levels.length + 1,
                                  description: '',
                                });
                                setIsLvlModalOpen(true);
                              }}
                              className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-emerald-400 hover:bg-slate-700 transition-colors"
                            >
                              + Level
                            </button>
                            <button
                              onClick={() => handleDeletePos(pos.id, pos.name)}
                              className="text-[10px] text-slate-500 hover:text-red-400 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Seniority Levels Pills */}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mr-1">
                          Levels:
                        </span>
                        {pos.levels.length === 0 ? (
                          <span className="text-[11px] text-slate-500 italic">
                            No levels assigned
                          </span>
                        ) : (
                          pos.levels.map((lvl) => (
                            <span
                              key={lvl.id}
                              className="group inline-flex items-center space-x-1.5 rounded-md border border-slate-700/80 bg-slate-900 px-2.5 py-1 text-xs text-slate-300 shadow-sm"
                            >
                              <span className="font-mono text-[10px] font-bold text-indigo-400">
                                L{lvl.rank}
                              </span>
                              <span>{lvl.name}</span>
                              {canManage && (
                                <button
                                  onClick={() => handleDeleteLvl(lvl.id, lvl.name)}
                                  className="text-slate-500 hover:text-red-400 ml-1 text-[10px]"
                                  title="Delete Level"
                                >
                                  ×
                                </button>
                              )}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal: Create Department */}
      {isDeptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white">Create New Department</h2>
            <form onSubmit={handleCreateDept} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Department Name
                </label>
                <input
                  type="text"
                  required
                  value={deptForm.name}
                  onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                  placeholder="Finance & Operations"
                  className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Unique Code (Uppercase)
                </label>
                <input
                  type="text"
                  required
                  value={deptForm.code}
                  onChange={(e) =>
                    setDeptForm({ ...deptForm, code: e.target.value.toUpperCase() })
                  }
                  placeholder="FIN"
                  className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Description (Optional)
                </label>
                <textarea
                  value={deptForm.description}
                  onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                  placeholder="Manages corporate accounts and payroll..."
                  rows={2}
                  className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDeptModalOpen(false)}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createDeptMutation.isPending}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-600/30 hover:bg-indigo-500 disabled:opacity-50"
                >
                  {createDeptMutation.isPending ? 'Creating...' : 'Create Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Position */}
      {isPosModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white">Create New Position</h2>
            <form onSubmit={handleCreatePos} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Department
                </label>
                <select
                  required
                  value={posForm.departmentId}
                  onChange={(e) => setPosForm({ ...posForm, departmentId: e.target.value })}
                  className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                >
                  {departments?.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Position Title
                </label>
                <input
                  type="text"
                  required
                  value={posForm.name}
                  onChange={(e) => setPosForm({ ...posForm, name: e.target.value })}
                  placeholder="Financial Analyst"
                  className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Description (Optional)
                </label>
                <textarea
                  value={posForm.description}
                  onChange={(e) => setPosForm({ ...posForm, description: e.target.value })}
                  placeholder="Prepares budget reports..."
                  rows={2}
                  className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPosModalOpen(false)}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createPosMutation.isPending}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-600/30 hover:bg-indigo-500 disabled:opacity-50"
                >
                  {createPosMutation.isPending ? 'Creating...' : 'Create Position'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Level */}
      {isLvlModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white">Create Seniority Level</h2>
            <form onSubmit={handleCreateLvl} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Level Title
                </label>
                <input
                  type="text"
                  required
                  value={lvlForm.name}
                  onChange={(e) => setLvlForm({ ...lvlForm, name: e.target.value })}
                  placeholder="Senior (L3)"
                  className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Rank / Seniority Index
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={lvlForm.rank}
                  onChange={(e) => setLvlForm({ ...lvlForm, rank: Number(e.target.value) })}
                  className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Description (Optional)
                </label>
                <textarea
                  value={lvlForm.description}
                  onChange={(e) => setLvlForm({ ...lvlForm, description: e.target.value })}
                  placeholder="Requirements: 5+ years experience..."
                  rows={2}
                  className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsLvlModalOpen(false)}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLvlMutation.isPending}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-600/30 hover:bg-indigo-500 disabled:opacity-50"
                >
                  {createLvlMutation.isPending ? 'Creating...' : 'Create Level'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
