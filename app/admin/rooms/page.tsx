'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, DollarSign, Loader2, AlertCircle, RefreshCw, Edit, X } from 'lucide-react';
import { getRoomsData } from '@/lib/admin-actions';

type RoomStatus = 'available' | 'booked' | 'maintenance' | 'cleaning';

interface Room {
  id: string;
  name: string;
  description: string;
  price: number;
  status: RoomStatus;
  activeTaskCount: number;
}

interface RoomForm {
  name: string;
  description: string;
  price: string;
}

const STATUS_COLORS: Record<RoomStatus, string> = {
  available:   'bg-green-100 text-green-700',
  booked:      'bg-blue-100 text-blue-700',
  cleaning:    'bg-yellow-100 text-yellow-700',
  maintenance: 'bg-red-100 text-red-700',
};

export default function RoomsPage() {
  const [rooms, setRooms]               = useState<Room[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(false);
  const [searchQuery, setSearchQuery]   = useState('');
  const [filterStatus, setFilterStatus] = useState<RoomStatus | 'all'>('all');
  const [actionMsg, setActionMsg]       = useState('');

  // Edit modal
  const [editRoom, setEditRoom]         = useState<Room | null>(null);
  const [editForm, setEditForm]         = useState<RoomForm>({ name: '', description: '', price: '' });
  const [editLoading, setEditLoading]   = useState(false);

  // Add modal
  const [showAdd, setShowAdd]           = useState(false);
  const [addForm, setAddForm]           = useState<RoomForm>({ name: '', description: '', price: '' });
  const [addLoading, setAddLoading]     = useState(false);

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    setError(false);
    const data = await getRoomsData();
    if (data) setRooms(data);
    else setError(true);
    setLoading(false);
  }, []);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  const filtered = rooms.filter(r => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      r.name.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q);
    const matchFilter = filterStatus === 'all' || r.status === filterStatus;
    return matchSearch && matchFilter;
  });

  function openEdit(room: Room) {
    setEditRoom(room);
    setEditForm({ name: room.name, description: room.description, price: String(room.price) });
    setActionMsg('');
  }

  async function handleEditSave() {
    if (!editRoom || !editForm.name || !editForm.price) return;
    setEditLoading(true);
    try {
      const res = await fetch(`/api/admin/rooms/${editRoom.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:        editForm.name,
          description: editForm.description,
          price:       parseFloat(editForm.price),
        }),
      });
      if (!res.ok) throw new Error();
      setRooms(prev => prev.map(r =>
        r.id === editRoom.id
          ? { ...r, name: editForm.name, description: editForm.description, price: parseFloat(editForm.price) }
          : r
      ));
      setEditRoom(null);
      setActionMsg('Room updated.');
    } catch {
      setActionMsg('Failed to update room.');
    } finally {
      setEditLoading(false);
    }
  }

  async function handleAddRoom() {
    if (!addForm.name || !addForm.price) return;
    setAddLoading(true);
    try {
      const res = await fetch('/api/admin/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:        addForm.name,
          description: addForm.description || null,
          price:       parseFloat(addForm.price),
        }),
      });
      if (!res.ok) throw new Error();
      setShowAdd(false);
      setAddForm({ name: '', description: '', price: '' });
      setActionMsg('Room added.');
      await fetchRooms();
    } catch {
      setActionMsg('Failed to add room.');
    } finally {
      setAddLoading(false);
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
      <p className="text-gray-600">Failed to load rooms data.</p>
      <button onClick={fetchRooms} className="px-4 py-2 bg-primary text-white rounded-lg">Retry</button>
    </div>
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold mb-2">Rooms</h1>
          <p className="text-gray-600">Manage hotel rooms and availability</p>
        </div>
        <button onClick={fetchRooms} className="text-sm flex items-center gap-1 text-gray-500 hover:text-primary">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {actionMsg && (
        <div className="mb-4 px-4 py-3 bg-green-50 border border-green-300 rounded-lg text-sm text-green-800">
          {actionMsg}
        </div>
      )}

      {/* Controls */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by room name or description"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex gap-2">
            <div className="select-wrapper flex-1">
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value as RoomStatus | 'all')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
              >
                <option value="all">All Status</option>
                <option value="available">Available</option>
                <option value="booked">Booked</option>
                <option value="cleaning">Cleaning</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>
            <button
              onClick={() => { setShowAdd(true); setActionMsg(''); }}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2"
            >
              <Plus size={20} />
              <span className="hidden sm:inline">Add Room</span>
            </button>
          </div>
        </div>
      </div>

      {/* Rooms Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-md">
          <p className="text-gray-500">{rooms.length === 0 ? 'No rooms yet. Add a room to get started.' : 'No rooms match your search.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(room => (
            <div key={room.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
              <div className="h-48 bg-gradient-to-br from-primary-light to-primary/20 relative flex items-center justify-center">
                <span className="text-primary/40 text-4xl font-bold">{room.name.charAt(0)}</span>
                <span className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[room.status]}`}>
                  {room.status.charAt(0).toUpperCase() + room.status.slice(1)}
                </span>
              </div>
              <div className="p-6">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold">{room.name}</h3>
                  {room.description && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{room.description}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b">
                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign size={16} className="text-gray-400" />
                    <span className="text-gray-600">LKR {room.price.toLocaleString()}/night</span>
                  </div>
                  {room.activeTaskCount > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <AlertCircle size={16} className="text-yellow-500" />
                      <span className="text-yellow-600">{room.activeTaskCount} active task{room.activeTaskCount > 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => openEdit(room)}
                  className="w-full px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors text-sm flex items-center justify-center gap-2"
                >
                  <Edit size={14} /> Edit Room
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-8">
        {[
          { label: 'Total Rooms',           value: rooms.length,                                                                         color: 'text-primary' },
          { label: 'Available',             value: rooms.filter(r => r.status === 'available').length,                                   color: 'text-green-600' },
          { label: 'Booked',                value: rooms.filter(r => r.status === 'booked').length,                                      color: 'text-blue-600' },
          { label: 'Maintenance/Cleaning',  value: rooms.filter(r => r.status === 'maintenance' || r.status === 'cleaning').length,      color: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-lg shadow-md p-6">
            <p className="text-gray-600 text-sm mb-2">{s.label}</p>
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Edit Room Modal */}
      {editRoom && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-heading font-bold">Edit Room</h2>
              <button onClick={() => setEditRoom(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Room Name *</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={editForm.description}
                  onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price per Night (LKR) *</label>
                <input
                  type="number"
                  min="0"
                  value={editForm.price}
                  onChange={e => setEditForm({ ...editForm, price: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={() => setEditRoom(null)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
              <button
                onClick={handleEditSave}
                disabled={editLoading || !editForm.name || !editForm.price}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {editLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Room Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-heading font-bold">Add New Room</h2>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Room Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Deluxe Suite"
                  value={addForm.name}
                  onChange={e => setAddForm({ ...addForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  placeholder="Room features and amenities..."
                  value={addForm.description}
                  onChange={e => setAddForm({ ...addForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price per Night (LKR) *</label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 25000"
                  value={addForm.price}
                  onChange={e => setAddForm({ ...addForm, price: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={() => setShowAdd(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
              <button
                onClick={handleAddRoom}
                disabled={addLoading || !addForm.name || !addForm.price}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {addLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                Add Room
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
