// Admin page — Concierge.
// Lists guest concierge/service requests (e.g. restaurant reservations,
// transportation), lets staff start/complete/cancel them, and provides a
// modal to log a brand new request. Talks to /api/admin/concierge.
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, Plus, CheckCircle, AlertCircle, Clock, Phone,
  Zap, XCircle, Loader2, RefreshCw,
} from 'lucide-react';

// Lifecycle states a concierge request can be in.
type ConciergeStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
type Priority = 'LOW' | 'MEDIUM' | 'HIGH';

// Shape of a concierge request as returned by the API.
interface ConciergeRequest {
  id: string;
  guestName: string;
  roomNumber: string | null;
  service: string;
  description: string | null;
  status: ConciergeStatus;
  priority: Priority;
  assignedTo: string | null;
  contact: string | null;
  completedAt: string | null;
  createdAt: string;
}

// Shape of the "New Request" modal form fields (all strings for controlled
// inputs, converted/nulled when sent to the API).
interface NewForm {
  guestName: string;
  roomNumber: string;
  service: string;
  description: string;
  priority: Priority;
  assignedTo: string;
  contact: string;
}

// Default/blank values used to reset the new-request form after submit or cancel.
const EMPTY_FORM: NewForm = {
  guestName: '',
  roomNumber: '',
  service: '',
  description: '',
  priority: 'MEDIUM',
  assignedTo: '',
  contact: '',
};

// Main page component — rendered at /admin/concierge.
export default function ConciergePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<ConciergeStatus | 'all'>('all');
  const [requests, setRequests] = useState<ConciergeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // Tracks which request+action combo is currently being submitted (e.g.
  // "abc123start"), so we can show a spinner on just that one button.
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // New request modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newForm, setNewForm] = useState<NewForm>(EMPTY_FORM);
  const [newLoading, setNewLoading] = useState(false);
  const [newError, setNewError] = useState('');

  // Loads all concierge requests from the API.
  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/admin/concierge');
      if (!res.ok) throw new Error();
      const json = await res.json();
      setRequests(json.requests ?? []);
    } catch {
      setError(true);
    }
    setLoading(false);
  }, []);

  // Runs once on mount to load the initial request list.
  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  // Sends a status-change action (start/complete/cancel) for one request to
  // the API, then merges the updated fields back into local state so the UI
  // reflects the change without needing a full refetch.
  async function handleAction(id: string, action: 'start' | 'complete' | 'cancel') {
    setActionLoading(id + action);
    try {
      const res = await fetch(`/api/admin/concierge/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        const json = await res.json();
        setRequests(prev =>
          prev.map(r => r.id === id ? { ...r, ...json.request } : r)
        );
      }
    } catch {
      // silently fail — user can refresh
    }
    setActionLoading(null);
  }

  // Handles submission of the "New Request" form. Validates required fields
  // client-side first, then POSTs to the API to create the request.
  async function handleNewRequest(e: React.FormEvent) {
    // Prevent the browser's default full-page form submit/reload.
    e.preventDefault();
    setNewError('');
    // Simple required-field validation before hitting the network.
    if (!newForm.guestName || !newForm.service) {
      setNewError('Guest name and service are required.');
      return;
    }
    setNewLoading(true);
    try {
      const res = await fetch('/api/admin/concierge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestName: newForm.guestName,
          roomNumber: newForm.roomNumber || null,
          service: newForm.service,
          description: newForm.description || null,
          priority: newForm.priority,
          assignedTo: newForm.assignedTo || null,
          contact: newForm.contact || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setNewError(json.error ?? 'Failed to create request.');
      } else {
        setRequests(prev => [json.request, ...prev]);
        setShowNewModal(false);
        setNewForm(EMPTY_FORM);
      }
    } catch {
      setNewError('Network error. Please try again.');
    }
    setNewLoading(false);
  }

  // Applies both the search box and status dropdown filters to the full
  // request list to produce what's actually shown on screen.
  const filteredRequests = requests.filter((r) => {
    const matchesSearch =
      r.guestName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.service.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.roomNumber ?? '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === 'all' || r.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  // Maps a status value to its badge color classes.
  const getStatusColor = (status: ConciergeStatus) => {
    switch (status) {
      case 'COMPLETED':  return 'bg-green-100 text-green-700';
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-700';
      case 'PENDING':    return 'bg-yellow-100 text-yellow-700';
      case 'CANCELLED':  return 'bg-red-100 text-red-700';
      default:           return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300';
    }
  };

  // Converts the raw enum value (e.g. "IN_PROGRESS") into a human-friendly label.
  const getStatusLabel = (status: ConciergeStatus) => {
    switch (status) {
      case 'IN_PROGRESS': return 'In Progress';
      default: return status.charAt(0) + status.slice(1).toLowerCase();
    }
  };

  // Picks which icon to show for a given priority level.
  const getPriorityIcon = (priority: Priority) => {
    if (priority === 'HIGH')   return <Zap size={18} className="text-red-600" />;
    if (priority === 'MEDIUM') return <AlertCircle size={18} className="text-yellow-600" />;
    return <Clock size={18} className="text-blue-600" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <AlertCircle className="text-red-500" size={40} />
        <p className="text-gray-600 dark:text-gray-400">Failed to load concierge requests.</p>
        <button onClick={fetchRequests} className="px-4 py-2 bg-primary text-white rounded-lg">Retry</button>
      </div>
    );
  }

  return (
    <div className="p-6 min-h-screen animate-fadeIn">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold mb-2">Concierge</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage guest requests and special services</p>
        </div>
        <button
          onClick={fetchRequests}
          className="text-sm flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-primary"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Controls */}
      <div className="glass-card hover-lift rounded-2xl p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
            <input
              type="text"
              placeholder="Search by guest, room, or service"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as ConciergeStatus | 'all')}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
            >
              <option value="all">All Requests</option>
              <option value="PENDING">Pending</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>

            <button
              onClick={() => { setShowNewModal(true); setNewError(''); }}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2"
            >
              <Plus size={20} />
              <span className="hidden sm:inline">New Request</span>
            </button>
          </div>
        </div>
      </div>

      {/* Requests List */}
      <div className="space-y-4">
        {filteredRequests.map((request) => {
          const isActing = actionLoading?.startsWith(request.id);
          return (
            <div key={request.id} className="glass-card hover-lift rounded-2xl p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-lg font-semibold">{request.guestName}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                      {getStatusLabel(request.status)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {request.roomNumber ? `Room ${request.roomNumber} • ` : ''}{request.service}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {getPriorityIcon(request.priority)}
                </div>
              </div>

              {request.description && (
                <p className="text-gray-700 dark:text-gray-300 mb-3">{request.description}</p>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 pb-4 border-b">
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 font-medium mb-1">Requested</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {new Date(request.createdAt).toLocaleString('en-US', {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 font-medium mb-1">Assigned To</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{request.assignedTo ?? 'Unassigned'}</p>
                </div>
                {request.contact && (
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 font-medium mb-1">Contact</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1">
                      <Phone size={14} />
                      {request.contact}
                    </p>
                  </div>
                )}
                {request.completedAt && (
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 font-medium mb-1">Completed</p>
                    <p className="text-sm text-green-700 flex items-center gap-1">
                      <CheckCircle size={14} />
                      {new Date(request.completedAt).toLocaleString('en-US', {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                {request.status === 'PENDING' && (
                  <button
                    onClick={() => handleAction(request.id, 'start')}
                    disabled={!!isActing}
                    className="flex-1 px-4 py-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {isActing ? <Loader2 size={14} className="animate-spin" /> : null}
                    Start Processing
                  </button>
                )}
                {request.status === 'IN_PROGRESS' && (
                  <button
                    onClick={() => handleAction(request.id, 'complete')}
                    disabled={!!isActing}
                    className="flex-1 px-4 py-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {isActing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={16} />}
                    Mark Complete
                  </button>
                )}
                {(request.status === 'PENDING' || request.status === 'IN_PROGRESS') && (
                  <button
                    onClick={() => handleAction(request.id, 'cancel')}
                    disabled={!!isActing}
                    className="px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium disabled:opacity-60"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredRequests.length === 0 && (
        <div className="text-center py-12 glass-card hover-lift rounded-2xl">
          <p className="text-gray-500 dark:text-gray-400">
            {requests.length === 0 ? 'No concierge requests yet.' : 'No requests match your search.'}
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-8">
        <div className="glass-card hover-lift rounded-2xl p-6">
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">Total Requests</p>
          <p className="text-3xl font-bold text-primary">{requests.length}</p>
        </div>
        <div className="glass-card hover-lift rounded-2xl p-6">
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">Pending</p>
          <p className="text-3xl font-bold text-yellow-600">{requests.filter(r => r.status === 'PENDING').length}</p>
        </div>
        <div className="glass-card hover-lift rounded-2xl p-6">
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">In Progress</p>
          <p className="text-3xl font-bold text-blue-600">{requests.filter(r => r.status === 'IN_PROGRESS').length}</p>
        </div>
        <div className="glass-card hover-lift rounded-2xl p-6">
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">Completed</p>
          <p className="text-3xl font-bold text-green-600">{requests.filter(r => r.status === 'COMPLETED').length}</p>
        </div>
      </div>

      {/* ── New Request Modal ── */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold">New Concierge Request</h2>
              <button onClick={() => setShowNewModal(false)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:text-gray-500">
                <XCircle size={24} />
              </button>
            </div>
            <form onSubmit={handleNewRequest} className="p-6 space-y-4">
              {newError && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                  {newError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Guest Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newForm.guestName}
                    onChange={(e) => setNewForm(f => ({ ...f, guestName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    placeholder="John Smith"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Room Number</label>
                  <input
                    type="text"
                    value={newForm.roomNumber}
                    onChange={(e) => setNewForm(f => ({ ...f, roomNumber: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    placeholder="101"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Priority
                  </label>
                  <select
                    value={newForm.priority}
                    onChange={(e) => setNewForm(f => ({ ...f, priority: e.target.value as Priority }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm bg-white"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Service <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newForm.service}
                  onChange={(e) => setNewForm(f => ({ ...f, service: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  placeholder="e.g. Restaurant Reservation, Transportation"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea
                  value={newForm.description}
                  onChange={(e) => setNewForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm resize-none"
                  placeholder="Additional details about the request…"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assigned To</label>
                  <input
                    type="text"
                    value={newForm.assignedTo}
                    onChange={(e) => setNewForm(f => ({ ...f, assignedTo: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    placeholder="Staff name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contact</label>
                  <input
                    type="text"
                    value={newForm.contact}
                    onChange={(e) => setNewForm(f => ({ ...f, contact: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    placeholder="+94 77 000 0000"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-white/60 dark:hover:bg-white/10 transition-colors transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={newLoading}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {newLoading && <Loader2 size={16} className="animate-spin" />}
                  {newLoading ? 'Creating…' : 'Create Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
