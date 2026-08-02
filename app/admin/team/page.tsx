// Admin page — Team.
// Lists every admin/manager account, lets an ADMIN-role user invite new
// ones and change role/active status for existing ones. Only reachable by
// ADMIN-role admins — the sidebar hides the link for MANAGER-role admins,
// and every mutation is re-checked server-side regardless.
'use client';

import React, { useState, useEffect } from 'react';
import {
  Plus, Loader2, AlertCircle, RefreshCw, XCircle, ShieldCheck, ShieldOff, Mail,
} from 'lucide-react';
import { getAdminsData } from '@/lib/admin-management';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager';
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: string;
  isSelf: boolean;
}

interface AddForm {
  name: string;
  email: string;
  password: string;
  role: 'ADMIN' | 'MANAGER';
}

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>({ name: '', email: '', password: '', role: 'MANAGER' });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

  // Which row currently has a PATCH in flight, so its buttons can show a
  // spinner and other rows stay interactive.
  const [busyId, setBusyId] = useState<string | null>(null);

  async function fetchMembers() {
    setLoading(true);
    setError(false);
    const data = await getAdminsData();
    if (data) {
      setMembers(data);
    } else {
      setError(true);
    }
    setLoading(false);
  }

  useEffect(() => { fetchMembers(); }, []);

  // How many other active admins exist besides this one — used to disable
  // the demote/deactivate controls on the last remaining admin, with an
  // explanation, instead of letting the request fail server-side.
  const activeAdminCount = members.filter(m => m.role === 'admin' && m.isActive).length;

  async function handleAddAdmin(e: React.FormEvent) {
    e.preventDefault();
    setAddError('');
    if (!addForm.name || !addForm.email || !addForm.password) {
      setAddError('Name, email, and password are required.');
      return;
    }
    setAddLoading(true);
    try {
      const res = await fetch('/api/admin/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      });
      const json = await res.json();
      if (!res.ok) {
        setAddError(json.error ?? 'Failed to add admin.');
      } else {
        setShowAddModal(false);
        setAddForm({ name: '', email: '', password: '', role: 'MANAGER' });
        setSuccessMsg('Admin added successfully.');
        setTimeout(() => setSuccessMsg(''), 4000);
        fetchMembers();
      }
    } catch {
      setAddError('Network error. Please try again.');
    }
    setAddLoading(false);
  }

  // Shared PATCH helper for role changes and active toggles.
  async function patchMember(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/team/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(false);
        setSuccessMsg('');
        setAddError('');
        window.alert(json.error ?? 'Failed to update admin.');
      } else {
        fetchMembers();
      }
    } catch {
      window.alert('Network error. Please try again.');
    }
    setBusyId(null);
  }

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
        <p className="text-gray-600 dark:text-gray-400">Failed to load team data.</p>
        <button onClick={fetchMembers} className="px-4 py-2 bg-primary text-white rounded-lg">Retry</button>
      </div>
    );
  }

  return (
    <div className="p-6 min-h-screen animate-fadeIn">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold mb-2">Team</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage admin and manager accounts</p>
        </div>
        <button onClick={fetchMembers} className="text-sm flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-primary">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {successMsg && (
        <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          {successMsg}
        </div>
      )}

      {/* Controls */}
      <div className="glass-card hover-lift rounded-2xl p-6 mb-6 flex justify-end">
        <button
          onClick={() => { setShowAddModal(true); setAddError(''); }}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2"
        >
          <Plus size={20} />
          <span>Add Admin</span>
        </button>
      </div>

      {/* Team table */}
      <div className="glass-card hover-lift rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">
              <th className="px-6 py-3 font-medium">Name</th>
              <th className="px-6 py-3 font-medium">Email</th>
              <th className="px-6 py-3 font-medium">Role</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Joined</th>
              <th className="px-6 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              // Disable demote/deactivate on the last active admin (unless
              // it's already inactive/manager, in which case the guard
              // doesn't apply) — mirrors the server-side "last admin" checks.
              const isLastAdmin = m.role === 'admin' && m.isActive && activeAdminCount <= 1;
              const busy = busyId === m.id;
              return (
                <tr key={m.id} className="border-b last:border-b-0 border-gray-100 dark:border-gray-800">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {m.avatarUrl ? (
                        <img src={m.avatarUrl} alt={m.name} className="w-9 h-9 rounded-full object-cover" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary-dark text-white flex items-center justify-center text-sm font-bold">
                          {m.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="font-medium">{m.name}{m.isSelf && <span className="text-gray-400 dark:text-gray-500 font-normal"> (you)</span>}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                    <a href={`mailto:${m.email}`} className="flex items-center gap-2 hover:text-primary">
                      <Mail size={14} /> {m.email}
                    </a>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={m.role}
                      disabled={busy || (m.role === 'admin' && isLastAdmin)}
                      title={m.role === 'admin' && isLastAdmin ? 'Cannot demote the last remaining admin' : undefined}
                      onChange={(e) => patchMember(m.id, { role: e.target.value.toUpperCase() })}
                      className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white disabled:opacity-50"
                    >
                      <option value="admin">Admin</option>
                      <option value="manager">Manager</option>
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      m.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                    }`}>
                      {m.isActive ? 'Active' : 'Deactivated'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{m.createdAt}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => patchMember(m.id, { isActive: !m.isActive })}
                      disabled={busy || m.isSelf || (m.isActive && isLastAdmin)}
                      title={
                        m.isSelf
                          ? 'You cannot deactivate your own account'
                          : m.isActive && isLastAdmin
                          ? 'Cannot deactivate the last remaining admin'
                          : undefined
                      }
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 ${
                        m.isActive
                          ? 'bg-red-50 text-red-600 hover:bg-red-100'
                          : 'bg-green-50 text-green-700 hover:bg-green-100'
                      }`}
                    >
                      {busy ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : m.isActive ? (
                        <ShieldOff size={14} />
                      ) : (
                        <ShieldCheck size={14} />
                      )}
                      {m.isActive ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add Admin Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold">Add Admin</h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400">
                <XCircle size={24} />
              </button>
            </div>
            <form onSubmit={handleAddAdmin} className="p-6 space-y-4">
              {addError && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                  {addError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={addForm.name}
                  onChange={(e) => setAddForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  placeholder="Jane Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={addForm.email}
                  onChange={(e) => setAddForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  placeholder="jane@lodgify.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={addForm.password}
                  onChange={(e) => setAddForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  placeholder="At least 8 characters"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
                <div className="select-wrapper">
                  <select
                    value={addForm.role}
                    onChange={(e) => setAddForm(f => ({ ...f, role: e.target.value as 'ADMIN' | 'MANAGER' }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm bg-white"
                  >
                    <option value="MANAGER">Manager</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-white/60 dark:hover:bg-white/10 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {addLoading && <Loader2 size={16} className="animate-spin" />}
                  {addLoading ? 'Adding…' : 'Add Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
