// Admin page — Rooms.
// The most feature-heavy admin page: lists all hotel rooms with photos and
// status, and lets staff edit a room's details, upload/reorder/delete photos
// (via Cloudinary), toggle which facilities a room has (and create new
// facility types on the fly), add a brand new room, and put a room into or
// out of maintenance mode (which hides it from the public booking site).
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, Plus, DollarSign, Loader2, AlertCircle, RefreshCw, Edit, X,
  Upload, Star, Trash2, Users, Maximize, BedDouble, Wrench, CheckCircle2,
} from 'lucide-react';
import { getRoomsData } from '@/lib/admin-actions';
import { getFacilityIcon, FACILITY_ICON_NAMES, FACILITY_CATEGORIES } from '@/lib/facility-icons';

// Booking/operational state of a room.
type RoomStatus = 'available' | 'booked' | 'maintenance' | 'cleaning';

// One photo attached to a room. `order` controls display order — the image
// with order 0 (or first in the array) is used as the cover photo.
interface RoomImageItem {
  id: string;
  url: string;
  order: number;
}

// One selectable amenity/facility (e.g. "Free WiFi", "Private Pool") that a
// room can be tagged with.
interface FacilityItem {
  id: string;
  label: string;
  icon: string;
  category: string;
}

// Shape of a room as returned by the API.
interface Room {
  id: string;
  slug: string | null;
  name: string;
  description: string;
  price: number;
  maxGuests: number;
  size: number;
  beds: string;
  status: RoomStatus;
  activeTaskCount: number;
  images: RoomImageItem[];
  facilities: FacilityItem[];
}

// Shape of the "Add Room" modal form — deliberately minimal (just the
// basics); photos/facilities/capacity are added afterward via the edit modal.
interface AddForm {
  name: string;
  description: string;
  price: string;
}

// Shape of the "Edit Room" modal form. Numeric fields are kept as strings
// while editing (so the input can be temporarily empty/invalid) and parsed
// to numbers only when saving.
interface EditForm {
  name: string;
  description: string;
  price: string;
  maxGuests: string;
  size: string;
  beds: string;
  facilityIds: string[];
}

const EMPTY_ADD_FORM: AddForm = { name: '', description: '', price: '' };

// Badge color per room status.
const STATUS_COLORS: Record<RoomStatus, string> = {
  available:   'bg-green-100 text-green-700',
  booked:      'bg-blue-100 text-blue-700',
  cleaning:    'bg-yellow-100 text-yellow-700',
  maintenance: 'bg-red-100 text-red-700',
};

// Human-friendly display names for facility categories (the raw category
// values like "room"/"bathroom" come from the database).
const CATEGORY_LABELS: Record<string, string> = {
  room: 'Room Features',
  bathroom: 'Bathroom',
  technology: 'Technology',
  food: 'Dining & Kitchen',
  general: 'General',
};

// Uploads a room photo directly from the browser to Cloudinary (an
// image-hosting service), using a signed upload: our server first hands out
// a short-lived signature (so random people can't upload directly using our
// account), then the browser uploads the file straight to Cloudinary's API.
// Returns the final hosted image URL and its Cloudinary ID.
async function uploadRoomImageToCloudinary(file: File): Promise<{ url: string; publicId: string }> {
  const sigRes = await fetch('/api/upload/signature?folder=room-images');
  if (!sigRes.ok) throw new Error('Could not get upload signature');
  const { signature, timestamp, folder, cloudName, apiKey } = await sigRes.json();

  const form = new FormData();
  form.append('file', file);
  form.append('signature', signature);
  form.append('timestamp', String(timestamp));
  form.append('api_key', apiKey);
  form.append('folder', folder);

  const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: form,
  });
  if (!uploadRes.ok) throw new Error('Image upload failed');
  const data = await uploadRes.json();
  return { url: data.secure_url as string, publicId: data.public_id as string };
}

// Main page component — rendered at /admin/rooms.
export default function RoomsPage() {
  const [rooms, setRooms]               = useState<Room[]>([]);
  const [facilities, setFacilities]     = useState<FacilityItem[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(false);
  const [searchQuery, setSearchQuery]   = useState('');
  const [filterStatus, setFilterStatus] = useState<RoomStatus | 'all'>('all');
  const [actionMsg, setActionMsg]       = useState('');

  // Edit modal
  const [editRoom, setEditRoom]         = useState<Room | null>(null);
  const [editForm, setEditForm]         = useState<EditForm>({
    name: '', description: '', price: '', maxGuests: '2', size: '300', beds: '', facilityIds: [],
  });
  const [editLoading, setEditLoading]   = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  // Ref to the hidden <input type="file"> so we can trigger the native file
  // picker programmatically when the "Add photo" button is clicked.
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Add modal
  const [showAdd, setShowAdd]           = useState(false);
  const [addForm, setAddForm]           = useState<AddForm>(EMPTY_ADD_FORM);
  const [addLoading, setAddLoading]     = useState(false);

  // New facility form (inside edit modal)
  const [newFacility, setNewFacility]   = useState({ label: '', icon: 'Check', category: 'general' });
  const [addingFacility, setAddingFacility] = useState(false);

  // Tracks which single room's maintenance toggle is currently in flight.
  const [maintenanceLoadingId, setMaintenanceLoadingId] = useState<string | null>(null);

  // Loads the full room list. Returns the fetched data (not just void) so
  // callers like refreshEditRoom() can immediately look up a specific room
  // from the fresh results without a second round of state reads.
  const fetchRooms = useCallback(async () => {
    setLoading(true);
    setError(false);
    const data = await getRoomsData();
    if (data) setRooms(data);
    else setError(true);
    setLoading(false);
    return data;
  }, []);

  // Loads the master list of facility types (used to build the checkbox
  // list in the edit modal, independent of which facilities each room has).
  const fetchFacilities = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/facilities');
      if (res.ok) setFacilities(await res.json());
    } catch {
      // Non-fatal — facility checklist will just show empty until retried.
    }
  }, []);

  // Runs once on mount to load both rooms and the facility list in parallel.
  useEffect(() => { fetchRooms(); fetchFacilities(); }, [fetchRooms, fetchFacilities]);

  // Applies the search box and status filter to the full room list.
  const filtered = rooms.filter(r => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      r.name.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q);
    const matchFilter = filterStatus === 'all' || r.status === filterStatus;
    return matchSearch && matchFilter;
  });

  // Opens the "Edit Room" modal for a given room, pre-filling the form with
  // its current values (numbers converted to strings for the text inputs).
  function openEdit(room: Room) {
    setEditRoom(room);
    setEditForm({
      name: room.name,
      description: room.description,
      price: String(room.price),
      maxGuests: String(room.maxGuests),
      size: String(room.size),
      beds: room.beds,
      facilityIds: room.facilities.map(f => f.id),
    });
    setActionMsg('');
  }

  // Re-fetches the room list and updates `editRoom` with the fresh copy of
  // the room currently being edited. Used after image/facility changes so
  // the modal reflects the latest photos/facilities without closing it.
  async function refreshEditRoom(roomId: string) {
    const fresh = await fetchRooms();
    const match = fresh?.find(r => r.id === roomId);
    if (match) setEditRoom(match);
    return match;
  }

  // Saves the edit form's changes (name, description, price, capacity,
  // size, beds, facilities) via PATCH.
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
          maxGuests:   parseInt(editForm.maxGuests, 10) || 1,
          size:        parseInt(editForm.size, 10) || 0,
          beds:        editForm.beds,
          facilityIds: editForm.facilityIds,
        }),
      });
      if (!res.ok) throw new Error();
      setEditRoom(null);
      setActionMsg('Room updated.');
      await fetchRooms();
    } catch {
      setActionMsg('Failed to update room.');
    } finally {
      setEditLoading(false);
    }
  }

  // Creates a new room with just the basics (name/description/price), then
  // immediately opens the edit modal on it so the admin can add photos and
  // facilities right away.
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
      const created = await res.json();
      setShowAdd(false);
      setAddForm(EMPTY_ADD_FORM);
      setActionMsg('Room added. Add photos and facilities below.');
      const fresh = await fetchRooms();
      const newRoom = fresh?.find(r => r.id === created.id);
      if (newRoom) openEdit(newRoom);
    } catch {
      setActionMsg('Failed to add room.');
    } finally {
      setAddLoading(false);
    }
  }

  // Puts a room into maintenance mode — this hides it from the public
  // booking site (guests can't book it) until maintenance is resolved.
  async function handleStartMaintenance(roomId: string) {
    setMaintenanceLoadingId(roomId);
    try {
      const res = await fetch(`/api/admin/rooms/${roomId}/maintenance`, { method: 'POST' });
      if (!res.ok) throw new Error();
      setActionMsg('Room marked under maintenance — hidden from the public site.');
      await fetchRooms();
    } catch {
      setActionMsg('Failed to mark room under maintenance.');
    } finally {
      setMaintenanceLoadingId(null);
    }
  }

  // Takes a room out of maintenance mode, making it bookable again.
  async function handleResolveMaintenance(roomId: string) {
    setMaintenanceLoadingId(roomId);
    try {
      const res = await fetch(`/api/admin/rooms/${roomId}/maintenance`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setActionMsg('Maintenance resolved — room is bookable again.');
      await fetchRooms();
    } catch {
      setActionMsg('Failed to resolve maintenance.');
    } finally {
      setMaintenanceLoadingId(null);
    }
  }

  // Fires when the admin picks a file from the hidden file input. Uploads it
  // to Cloudinary, then tells our API to attach the resulting URL to the
  // room being edited, then refreshes the edit modal to show the new photo.
  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset the input value so selecting the same file again still fires
    // this handler (browsers otherwise treat it as "no change").
    e.target.value = '';
    if (!file || !editRoom) return;

    setImageUploading(true);
    try {
      const { url, publicId } = await uploadRoomImageToCloudinary(file);
      const res = await fetch(`/api/admin/rooms/${editRoom.id}/images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, publicId }),
      });
      if (!res.ok) throw new Error();
      await refreshEditRoom(editRoom.id);
    } catch {
      setActionMsg('Failed to upload image.');
    } finally {
      setImageUploading(false);
    }
  }

  // Deletes one photo from the room currently being edited.
  async function handleDeleteImage(imageId: string) {
    if (!editRoom) return;
    try {
      const res = await fetch(`/api/admin/rooms/${editRoom.id}/images/${imageId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      await refreshEditRoom(editRoom.id);
    } catch {
      setActionMsg('Failed to delete image.');
    }
  }

  // Marks a non-cover photo as the new cover (first) photo for the room.
  async function handleSetCover(imageId: string) {
    if (!editRoom) return;
    try {
      const res = await fetch(`/api/admin/rooms/${editRoom.id}/images/${imageId}`, { method: 'PATCH' });
      if (!res.ok) throw new Error();
      await refreshEditRoom(editRoom.id);
    } catch {
      setActionMsg('Failed to update cover image.');
    }
  }

  // Toggles one facility checkbox on/off in the edit form: adds the id if
  // it's not already selected, removes it if it is.
  function toggleFacility(id: string) {
    setEditForm(f => ({
      ...f,
      facilityIds: f.facilityIds.includes(id)
        ? f.facilityIds.filter(x => x !== id)
        : [...f.facilityIds, id],
    }));
  }

  // Creates a brand new facility type (e.g. "Private Pool") from the small
  // form inside the edit modal, adds it to the master facilities list, and
  // automatically checks it for the room currently being edited.
  async function handleAddFacility() {
    if (!newFacility.label.trim()) return;
    setAddingFacility(true);
    try {
      const res = await fetch('/api/admin/facilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newFacility),
      });
      if (!res.ok) throw new Error();
      const created: FacilityItem = await res.json();
      setFacilities(prev => [...prev, created].sort((a, b) => a.label.localeCompare(b.label)));
      setEditForm(f => ({ ...f, facilityIds: [...f.facilityIds, created.id] }));
      setNewFacility({ label: '', icon: 'Check', category: 'general' });
    } catch {
      setActionMsg('Failed to add facility. It may already exist.');
    } finally {
      setAddingFacility(false);
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
      <p className="text-gray-600 dark:text-gray-400">Failed to load rooms data.</p>
      <button onClick={fetchRooms} className="px-4 py-2 bg-primary text-white rounded-lg">Retry</button>
    </div>
  );

  // Groups the flat facilities list into { category, items } buckets (in the
  // fixed FACILITY_CATEGORIES order) so the edit modal can render them under
  // labeled section headings instead of one long unsorted checkbox list.
  // Empty categories (no facilities yet) are dropped from the result.
  const facilitiesByCategory = FACILITY_CATEGORIES.map(category => ({
    category,
    items: facilities.filter(f => f.category === category),
  })).filter(g => g.items.length > 0);

  return (
    <div className="p-6 min-h-screen animate-fadeIn">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold mb-2">Rooms</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage hotel rooms, photos, and facilities</p>
        </div>
        <button onClick={fetchRooms} className="text-sm flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-primary">
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
              placeholder="Search by room name or description"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex gap-2">
            <div className="select-wrapper flex-1">
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value as RoomStatus | 'all')}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
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
        <div className="text-center py-12 glass-card hover-lift rounded-2xl">
          <p className="text-gray-500 dark:text-gray-400">{rooms.length === 0 ? 'No rooms yet. Add a room to get started.' : 'No rooms match your search.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(room => {
            // First image in the array is treated as the cover photo (see
            // handleSetCover, which re-orders images to make a chosen one first).
            const cover = room.images[0];
            return (
              <div key={room.id} className="glass-card hover-lift rounded-2xl overflow-hidden hover:shadow-lg transition-shadow">
                <div className="h-48 bg-gradient-to-br from-primary-light to-primary/20 relative flex items-center justify-center overflow-hidden">
                  {cover ? (
                    <img src={cover.url} alt={room.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-primary/40 text-4xl font-bold">{room.name.charAt(0)}</span>
                  )}
                  <span className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[room.status]}`}>
                    {room.status.charAt(0).toUpperCase() + room.status.slice(1)}
                  </span>
                </div>
                <div className="p-6">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold">{room.name}</h3>
                    {room.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{room.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-4">
                    <div className="flex items-center gap-1">
                      <Users size={14} /> <span>{room.maxGuests}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Maximize size={14} /> <span>{room.size} sqft</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <DollarSign size={14} /> <span>LKR {room.price.toLocaleString()}</span>
                    </div>
                  </div>
                  {room.activeTaskCount > 0 && (
                    <div className="flex items-center gap-2 text-sm mb-4">
                      <AlertCircle size={16} className="text-yellow-500" />
                      <span className="text-yellow-600">{room.activeTaskCount} active task{room.activeTaskCount > 1 ? 's' : ''}</span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit(room)}
                      className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-200 transition-colors text-sm flex items-center justify-center gap-2"
                    >
                      <Edit size={14} /> Edit
                    </button>
                    {room.status === 'maintenance' ? (
                      <button
                        onClick={() => handleResolveMaintenance(room.id)}
                        disabled={maintenanceLoadingId === room.id}
                        className="flex-1 px-3 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 disabled:opacity-50 transition-colors text-sm flex items-center justify-center gap-2"
                      >
                        {maintenanceLoadingId === room.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                        Resolve
                      </button>
                    ) : (
                      <button
                        onClick={() => handleStartMaintenance(room.id)}
                        disabled={maintenanceLoadingId === room.id}
                        className="flex-1 px-3 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors text-sm flex items-center justify-center gap-2"
                      >
                        {maintenanceLoadingId === room.id ? <Loader2 size={14} className="animate-spin" /> : <Wrench size={14} />}
                        Maintenance
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
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
          <div key={s.label} className="glass-card hover-lift rounded-2xl p-6">
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">{s.label}</p>
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Edit Room Modal */}
      {editRoom && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="glass-strong rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-inherit z-10">
              <h2 className="text-xl font-heading font-bold">Edit Room</h2>
              <button onClick={() => setEditRoom(null)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-6">
              {/* Basic fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Room Name *</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                  <textarea
                    rows={3}
                    value={editForm.description}
                    onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Price per Night (LKR) *</label>
                  <input
                    type="number"
                    min="0"
                    value={editForm.price}
                    onChange={e => setEditForm({ ...editForm, price: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Guests</label>
                  <input
                    type="number"
                    min="1"
                    value={editForm.maxGuests}
                    onChange={e => setEditForm({ ...editForm, maxGuests: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Size (sqft)</label>
                  <input
                    type="number"
                    min="0"
                    value={editForm.size}
                    onChange={e => setEditForm({ ...editForm, size: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                    <BedDouble size={14} /> Bed Configuration
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1 King Bed"
                    value={editForm.beds}
                    onChange={e => setEditForm({ ...editForm, beds: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Images */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Photos</label>
                <div className="flex flex-wrap gap-3 mb-3">
                  {editRoom.images.map((img, i) => (
                    <div key={img.id} className="relative w-24 h-24 rounded-lg overflow-hidden group border border-gray-200 dark:border-gray-700">
                      <img src={img.url} alt="" className="w-full h-full object-cover" />
                      {i === 0 && (
                        <span className="absolute top-1 left-1 bg-primary text-white text-[10px] px-1.5 py-0.5 rounded">Cover</span>
                      )}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        {i !== 0 && (
                          <button
                            type="button"
                            onClick={() => handleSetCover(img.id)}
                            title="Set as cover"
                            className="w-7 h-7 rounded-full bg-white/90 text-primary flex items-center justify-center hover:bg-white"
                          >
                            <Star size={14} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteImage(img.id)}
                          title="Delete"
                          className="w-7 h-7 rounded-full bg-white/90 text-red-600 flex items-center justify-center hover:bg-white"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={imageUploading}
                    className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
                  >
                    {imageUploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                    <span className="text-[10px] mt-1">{imageUploading ? 'Uploading…' : 'Add photo'}</span>
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
                </div>
              </div>

              {/* Facilities */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Facilities</label>
                <div className="space-y-4 max-h-64 overflow-y-auto pr-1 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  {facilitiesByCategory.map(group => (
                    <div key={group.category}>
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                        {CATEGORY_LABELS[group.category] || group.category}
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {group.items.map(facility => {
                          const Icon = getFacilityIcon(facility.icon);
                          const checked = editForm.facilityIds.includes(facility.id);
                          return (
                            <label
                              key={facility.id}
                              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm cursor-pointer border transition-colors ${
                                checked ? 'border-primary bg-primary-light/60 text-primary' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleFacility(facility.id)}
                                className="accent-primary"
                              />
                              <Icon size={14} />
                              <span className="truncate">{facility.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {facilities.length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No facilities yet — add one below.</p>
                  )}
                </div>

                {/* Add new facility */}
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <div className="flex-1 min-w-[140px]">
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">New facility name</label>
                    <input
                      type="text"
                      placeholder="e.g. Private Pool"
                      value={newFacility.label}
                      onChange={e => setNewFacility({ ...newFacility, label: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Icon</label>
                    <select
                      value={newFacility.icon}
                      onChange={e => setNewFacility({ ...newFacility, icon: e.target.value })}
                      className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                    >
                      {FACILITY_ICON_NAMES.map(name => <option key={name} value={name}>{name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Category</label>
                    <select
                      value={newFacility.category}
                      onChange={e => setNewFacility({ ...newFacility, category: e.target.value })}
                      className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                    >
                      {FACILITY_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>)}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddFacility}
                    disabled={addingFacility || !newFacility.label.trim()}
                    className="px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 text-sm flex items-center gap-1"
                  >
                    {addingFacility ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    Add
                  </button>
                </div>
              </div>
            </div>
            <div className="p-6 border-t flex gap-3 sticky bottom-0 bg-inherit">
              <button onClick={() => setEditRoom(null)} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-white/60 dark:hover:bg-white/10 transition-colors">Close</button>
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
          <div className="glass-strong rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-heading font-bold">Add New Room</h2>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Add the basics first — you'll add photos, guest capacity, and facilities right after.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Room Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Deluxe Suite"
                  value={addForm.name}
                  onChange={e => setAddForm({ ...addForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea
                  rows={3}
                  placeholder="Room features and amenities..."
                  value={addForm.description}
                  onChange={e => setAddForm({ ...addForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Price per Night (LKR) *</label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 25000"
                  value={addForm.price}
                  onChange={e => setAddForm({ ...addForm, price: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={() => setShowAdd(false)} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-white/60 dark:hover:bg-white/10 transition-colors">Cancel</button>
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
