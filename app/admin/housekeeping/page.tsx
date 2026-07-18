'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Check, User, Calendar, Loader2, AlertCircle, RefreshCw, Edit, X } from 'lucide-react';
import { getHousekeepingData, getRoomsData } from '@/lib/admin-actions';

type TaskStatus = 'pending' | 'in-progress' | 'completed';

interface RoomOption {
  id: string;
  name: string;
}

interface HousekeepingTask {
  id: string;
  roomName: string;
  title: string;
  description: string;
  assignedTo: string;
  status: TaskStatus;
  priority: 'low' | 'medium' | 'high';
  dueAt: string | null;
}

interface NewTaskForm {
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  dueAt: string;
  roomId: string;
}

const STATUS_COLORS: Record<TaskStatus, string> = {
  completed:    'bg-green-100 text-green-700',
  'in-progress':'bg-blue-100 text-blue-700',
  pending:      'bg-yellow-100 text-yellow-700',
};

const PRIORITY_COLORS: Record<string, string> = {
  high:   'text-red-600',
  medium: 'text-yellow-600',
  low:    'text-green-600',
};

export default function HousekeepingPage() {
  const [tasks, setTasks]             = useState<HousekeepingTask[]>([]);
  const [rooms, setRooms]             = useState<RoomOption[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all');
  const [actionMsg, setActionMsg]     = useState('');
  const [updatingId, setUpdatingId]   = useState<string | null>(null);

  // Edit modal
  const [editTask, setEditTask]       = useState<HousekeepingTask | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  // New task modal
  const [showNew, setShowNew]         = useState(false);
  const [newForm, setNewForm]         = useState<NewTaskForm>({ title: '', description: '', priority: 'MEDIUM', dueAt: '', roomId: '' });
  const [newLoading, setNewLoading]   = useState(false);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(false);
    const data = await getHousekeepingData();
    if (data) setTasks(data);
    else setError(true);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  useEffect(() => {
    getRoomsData().then(data => { if (data) setRooms(data.map(r => ({ id: r.id, name: r.name }))); });
  }, []);

  const filtered = tasks.filter(t => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      t.roomName.toLowerCase().includes(q) ||
      t.title.toLowerCase().includes(q) ||
      t.assignedTo.toLowerCase().includes(q);
    const matchFilter = filterStatus === 'all' || t.status === filterStatus;
    return matchSearch && matchFilter;
  });

  async function handleMarkComplete(id: string) {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/admin/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COMPLETED' }),
      });
      if (!res.ok) throw new Error();
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'completed' } : t));
      setActionMsg('Task marked complete.');
    } catch {
      setActionMsg('Failed to update task.');
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleEditSave() {
    if (!editTask) return;
    setEditLoading(true);
    try {
      const res = await fetch(`/api/admin/tasks/${editTask.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:       editTask.title,
          description: editTask.description,
          priority:    editTask.priority.toUpperCase(),
          dueAt:       editTask.dueAt || null,
        }),
      });
      if (!res.ok) throw new Error();
      setTasks(prev => prev.map(t => t.id === editTask.id ? editTask : t));
      setEditTask(null);
      setActionMsg('Task updated.');
    } catch {
      setActionMsg('Failed to update task.');
    } finally {
      setEditLoading(false);
    }
  }

  async function handleCreateTask() {
    if (!newForm.title.trim()) return;
    setNewLoading(true);
    try {
      const res = await fetch('/api/admin/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:       newForm.title,
          description: newForm.description || null,
          priority:    newForm.priority,
          dueAt:       newForm.dueAt || null,
          roomId:      newForm.roomId || null,
        }),
      });
      if (!res.ok) throw new Error();
      setShowNew(false);
      setNewForm({ title: '', description: '', priority: 'MEDIUM', dueAt: '', roomId: '' });
      setActionMsg('Task created.');
      await fetchTasks();
    } catch {
      setActionMsg('Failed to create task.');
    } finally {
      setNewLoading(false);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="animate-spin text-primary" size={48} />
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <AlertCircle className="text-red-500" size={40} />
      <p className="text-gray-600 dark:text-gray-400">Failed to load housekeeping tasks.</p>
      <button onClick={fetchTasks} className="px-4 py-2 bg-primary text-white rounded-lg">Retry</button>
    </div>
  );

  return (
    <div className="p-6 min-h-screen animate-fadeIn">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold mb-2">Housekeeping</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage cleaning tasks and staff assignments</p>
        </div>
        <button onClick={fetchTasks} className="text-sm flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-primary">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {actionMsg && (
        <div className="mb-4 px-4 py-3 bg-green-50 border border-green-300 rounded-lg text-sm text-green-800">
          {actionMsg}
        </div>
      )}

      {/* Controls */}
      <div className="glass-card hover-lift rounded-2xl p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
            <input
              type="text"
              placeholder="Search by room, staff, or task"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex gap-2">
            <div className="select-wrapper flex-1">
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value as TaskStatus | 'all')}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
              >
                <option value="all">All Tasks</option>
                <option value="pending">Pending</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <button
              onClick={() => { setShowNew(true); setActionMsg(''); }}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2"
            >
              <Plus size={20} />
              <span className="hidden sm:inline">New Task</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tasks List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 glass-card hover-lift rounded-2xl">
          <p className="text-gray-500 dark:text-gray-400">
            {tasks.length === 0
              ? 'No housekeeping tasks yet. Create one using the New Task button.'
              : 'No tasks match your search.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(task => (
            <div key={task.id} className="glass-card hover-lift rounded-2xl p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">{task.roomName}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[task.status]}`}>
                      {task.status === 'in-progress' ? 'In Progress' : task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">{task.title}</p>
                  {task.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{task.description}</p>}
                </div>
                <div className={`text-sm font-bold ${PRIORITY_COLORS[task.priority]}`}>
                  {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)} Priority
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b">
                <div className="flex items-center gap-2 text-sm">
                  <User size={16} className="text-gray-400 dark:text-gray-500" />
                  <span className="text-gray-700 dark:text-gray-300">{task.assignedTo}</span>
                </div>
                {task.dueAt && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar size={16} className="text-gray-400 dark:text-gray-500" />
                    <span className="text-gray-700 dark:text-gray-300">{new Date(task.dueAt).toLocaleDateString()}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                {task.status !== 'completed' && (
                  <button
                    onClick={() => { handleMarkComplete(task.id); setActionMsg(''); }}
                    disabled={updatingId === task.id}
                    className="flex-1 px-4 py-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    {updatingId === task.id ? <Loader2 size={16} className="animate-spin" /> : <Check size={18} />}
                    Mark Complete
                  </button>
                )}
                <button
                  onClick={() => { setEditTask({ ...task }); setActionMsg(''); }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-white/60 dark:hover:bg-white/10 transition-colors transition-colors flex items-center justify-center gap-2"
                >
                  <Edit size={16} /> Edit Task
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-8">
        {[
          { label: 'Total Tasks',  value: tasks.length,                                      color: 'text-primary' },
          { label: 'Pending',      value: tasks.filter(t => t.status === 'pending').length,   color: 'text-yellow-600' },
          { label: 'In Progress',  value: tasks.filter(t => t.status === 'in-progress').length, color: 'text-blue-600' },
          { label: 'Completed',    value: tasks.filter(t => t.status === 'completed').length, color: 'text-green-600' },
        ].map(s => (
          <div key={s.label} className="glass-card hover-lift rounded-2xl p-6">
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">{s.label}</p>
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Edit Task Modal */}
      {editTask && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="glass-strong rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-heading font-bold">Edit Task</h2>
              <button onClick={() => setEditTask(null)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:text-gray-500"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                <input
                  type="text"
                  value={editTask.title}
                  onChange={e => setEditTask({ ...editTask, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={editTask.description}
                  onChange={e => setEditTask({ ...editTask, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
                  <select
                    value={editTask.priority}
                    onChange={e => setEditTask({ ...editTask, priority: e.target.value as 'low' | 'medium' | 'high' })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={editTask.dueAt || ''}
                    onChange={e => setEditTask({ ...editTask, dueAt: e.target.value || null })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={() => setEditTask(null)} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-white/60 dark:hover:bg-white/10 transition-colors">Cancel</button>
              <button
                onClick={handleEditSave}
                disabled={editLoading}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {editLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Task Modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="glass-strong rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-heading font-bold">New Housekeeping Task</h2>
              <button onClick={() => setShowNew(false)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:text-gray-500"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Clean and restock Room 101"
                  value={newForm.title}
                  onChange={e => setNewForm({ ...newForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Room</label>
                <div className="select-wrapper">
                  <select
                    value={newForm.roomId}
                    onChange={e => setNewForm({ ...newForm, roomId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                  >
                    <option value="">General (no specific room)</option>
                    {rooms.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea
                  rows={3}
                  placeholder="Optional details..."
                  value={newForm.description}
                  onChange={e => setNewForm({ ...newForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
                  <select
                    value={newForm.priority}
                    onChange={e => setNewForm({ ...newForm, priority: e.target.value as 'LOW' | 'MEDIUM' | 'HIGH' })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={newForm.dueAt}
                    onChange={e => setNewForm({ ...newForm, dueAt: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={() => setShowNew(false)} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-white/60 dark:hover:bg-white/10 transition-colors">Cancel</button>
              <button
                onClick={handleCreateTask}
                disabled={newLoading || !newForm.title.trim()}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {newLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                Create Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
