'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, Trash2, Archive, Star, Clock, Loader2, AlertCircle, Send, X } from 'lucide-react';

type MessageStatus = 'UNREAD' | 'READ' | 'ARCHIVED';

interface ContactMessage {
  id: string;
  firstName: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  status: MessageStatus;
  starred: boolean;
  adminReply: string | null;
  repliedAt: string | null;
  createdAt: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  booking:   'bg-blue-100 text-blue-700',
  general:   'bg-green-100 text-green-700',
  complaint: 'bg-red-100 text-red-700',
  feedback:  'bg-purple-100 text-purple-700',
  other:     'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
};

export default function MessagesPage() {
  const [messages, setMessages]           = useState<ContactMessage[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(false);
  const [searchQuery, setSearchQuery]     = useState('');
  const [filterStatus, setFilterStatus]   = useState<MessageStatus | 'all'>('all');
  const [selected, setSelected]           = useState<ContactMessage | null>(null);
  const [replyText, setReplyText]         = useState('');
  const [replyLoading, setReplyLoading]   = useState(false);
  const [actionMsg, setActionMsg]         = useState('');

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/admin/messages');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMessages(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  async function patchMessage(id: string, action: string, extra?: object) {
    const res = await fetch(`/api/admin/messages/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action, ...extra }),
    });
    if (!res.ok) throw new Error();
    return res.json() as Promise<ContactMessage>;
  }

  async function handleOpen(msg: ContactMessage) {
    setSelected(msg);
    setReplyText('');
    setActionMsg('');
    if (msg.status === 'UNREAD') {
      try {
        const updated = await patchMessage(msg.id, 'read');
        setMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
        setSelected(updated);
      } catch { /* silent */ }
    }
  }

  async function handleStar(e: React.MouseEvent, msg: ContactMessage) {
    e.stopPropagation();
    try {
      const updated = await patchMessage(msg.id, 'star');
      setMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
      if (selected?.id === updated.id) setSelected(updated);
    } catch { /* silent */ }
  }

  async function handleArchive() {
    if (!selected) return;
    try {
      const updated = await patchMessage(selected.id, 'archive');
      setMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
      setSelected(null);
      setActionMsg('Message archived.');
    } catch {
      setActionMsg('Failed to archive.');
    }
  }

  async function handleDelete() {
    if (!selected) return;
    if (!confirm('Delete this message permanently?')) return;
    try {
      await fetch(`/api/admin/messages/${selected.id}`, { method: 'DELETE' });
      setMessages(prev => prev.filter(m => m.id !== selected.id));
      setSelected(null);
      setActionMsg('Message deleted.');
    } catch {
      setActionMsg('Failed to delete.');
    }
  }

  async function handleReply() {
    if (!selected || !replyText.trim()) return;
    setReplyLoading(true);
    try {
      const updated = await patchMessage(selected.id, 'reply', { reply: replyText.trim() });
      setMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
      setSelected(updated);
      setReplyText('');
      setActionMsg('Reply saved.');
    } catch {
      setActionMsg('Failed to save reply.');
    } finally {
      setReplyLoading(false);
    }
  }

  const filtered = messages.filter(m => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      m.firstName.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      m.subject.toLowerCase().includes(q);
    const matchFilter = filterStatus === 'all' || m.status === filterStatus;
    return matchSearch && matchFilter;
  });

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
        <p className="text-gray-600 dark:text-gray-400">Failed to load messages.</p>
        <button onClick={fetchMessages} className="px-4 py-2 bg-primary text-white rounded-lg">Retry</button>
      </div>
    );
  }

  return (
    <div className="p-6 min-h-screen animate-fadeIn">
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-bold mb-2">Messages</h1>
        <p className="text-gray-600 dark:text-gray-400">Manage guest inquiries and communications</p>
      </div>

      {actionMsg && !selected && (
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
              placeholder="Search by name, subject, or email"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as MessageStatus | 'all')}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Messages</option>
            <option value="UNREAD">Unread</option>
            <option value="READ">Read</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* List */}
        <div className="lg:col-span-2 space-y-4">
          {filtered.length === 0 ? (
            <div className="text-center py-12 glass-card hover-lift rounded-2xl">
              <p className="text-gray-500 dark:text-gray-400">{messages.length === 0 ? 'No messages yet. Submissions from the contact form will appear here.' : 'No messages match your search.'}</p>
            </div>
          ) : filtered.map(msg => (
            <div
              key={msg.id}
              onClick={() => handleOpen(msg)}
              className={`p-4 rounded-lg cursor-pointer transition-all border-l-4 ${
                msg.status === 'UNREAD'
                  ? 'bg-blue-50 border-primary'
                  : msg.status === 'ARCHIVED'
                  ? 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 opacity-70 hover:opacity-100'
                  : 'bg-white border-gray-200 dark:border-gray-700 hover:bg-white/60 dark:hover:bg-white/10 transition-colors'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">{msg.firstName}</h3>
                    {msg.status === 'UNREAD' && <div className="w-2 h-2 bg-primary rounded-full" />}
                    {msg.adminReply && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Replied</span>}
                  </div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1 capitalize">{msg.subject.replace('_', ' ')}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">{msg.message}</p>
                </div>
                <button
                  onClick={e => handleStar(e, msg)}
                  className={`p-1 rounded-lg transition-colors flex-shrink-0 ${msg.starred ? 'text-yellow-500 bg-yellow-50' : 'text-gray-400 dark:text-gray-500 hover:text-yellow-500'}`}
                >
                  <Star size={18} fill={msg.starred ? 'currentColor' : 'none'} />
                </button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${CATEGORY_COLORS[msg.subject] ?? CATEGORY_COLORS.other}`}>
                  {msg.subject.charAt(0).toUpperCase() + msg.subject.slice(1)}
                </span>
                <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                  <Clock size={14} />
                  {new Date(msg.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Detail Panel */}
        {selected && (
          <div className="glass-card hover-lift rounded-2xl p-6 sticky top-24 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4 pb-4 border-b">
              <div>
                <h3 className="text-lg font-semibold">{selected.firstName}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{selected.email}</p>
                {selected.phone && <p className="text-sm text-gray-500 dark:text-gray-400">{selected.phone}</p>}
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:text-gray-500">
                <X size={20} />
              </button>
            </div>

            <div className="mb-4">
              <h4 className="font-semibold mb-1 capitalize">{selected.subject.replace('_', ' ')}</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{new Date(selected.createdAt).toLocaleString()}</p>
              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {selected.message}
              </div>
            </div>

            {selected.adminReply ? (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-xs text-green-700 font-medium mb-1">
                  Your Reply Â· {selected.repliedAt ? new Date(selected.repliedAt).toLocaleDateString() : ''}
                </p>
                <p className="text-sm text-green-900">{selected.adminReply}</p>
              </div>
            ) : (
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Write a Reply</p>
                <textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="Type your reply..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm resize-none"
                />
                <button
                  onClick={handleReply}
                  disabled={replyLoading || !replyText.trim()}
                  className="mt-2 w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                >
                  {replyLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Save Reply
                </button>
              </div>
            )}

            {actionMsg && (
              <p className="text-xs text-center text-gray-600 dark:text-gray-400 mb-2">{actionMsg}</p>
            )}

            <div className="space-y-2">
              <button
                onClick={handleArchive}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-white/60 dark:hover:bg-white/10 transition-colors transition-colors flex items-center justify-center gap-2"
              >
                <Archive size={18} /> Archive
              </button>
              <button
                onClick={handleDelete}
                className="w-full px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 size={18} /> Delete
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-8">
        {[
          { label: 'Total Messages', value: messages.length,                                          color: 'text-primary' },
          { label: 'Unread',         value: messages.filter(m => m.status === 'UNREAD').length,       color: 'text-blue-600' },
          { label: 'Complaints',     value: messages.filter(m => m.subject === 'complaint').length,   color: 'text-red-600' },
          { label: 'Starred',        value: messages.filter(m => m.starred).length,                   color: 'text-yellow-600' },
        ].map(s => (
          <div key={s.label} className="glass-card hover-lift rounded-2xl p-6">
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">{s.label}</p>
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
