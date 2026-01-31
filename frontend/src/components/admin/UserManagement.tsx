import React, { useState, useEffect } from 'react';
import { Shield, UserPlus, X, Edit2, CheckCircle, XCircle, Key } from 'lucide-react';
import api from '../../services/api';

interface UserData {
    id: string;
    email: string;
    full_name: string;
    role: string;
    active: number; // 1 or 0
    created_at: string;
}

interface UserManagementProps {
    onClose: () => void;
}

const UserManagement: React.FC<UserManagementProps> = ({ onClose }) => {
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingField, setEditingField] = useState<'name' | 'email' | null>(null);
    const [editValue, setEditValue] = useState('');

    // Form State
    const [newItem, setNewItem] = useState({
        email: '',
        password: '',
        full_name: '',
        role: 'viewer'
    });

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await api.get('/users');
            setUsers(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post('/users', newItem);
            alert('User created successfully');
            setShowCreate(false);
            setNewItem({ email: '', password: '', full_name: '', role: 'viewer' });
            fetchUsers();
        } catch (e: any) {
            alert('Failed: ' + (e.response?.data?.message || e.message));
        }
    };

    const handleUpdate = async (userId: string, data: any) => {
        try {
            await api.put(`/users/${userId}`, data);
            setEditingId(null);
            setEditingField(null);
            fetchUsers();
            if (data.password) alert('Password updated successfully');
        } catch (e: any) {
            alert('Update failed: ' + (e.response?.data?.message || e.message));
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">

                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                            <Shield size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">User Management</h2>
                            <p className="text-sm text-slate-500">Manage access and roles</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto bg-slate-50/50 flex-1">

                    {/* Toolbar */}
                    <div className="flex justify-between items-center mb-6">
                        <div className="text-sm font-semibold text-slate-500">
                            Total Users: {users.length}
                        </div>
                        <button
                            onClick={() => setShowCreate(!showCreate)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
                        >
                            <UserPlus size={16} />
                            {showCreate ? 'Cancel' : 'Add New User'}
                        </button>
                    </div>

                    {/* Create Form */}
                    {showCreate && (
                        <form onSubmit={handleCreate} className="mb-8 p-4 bg-white rounded-xl border border-blue-100 shadow-sm animate-in slide-in-from-top-4 duration-300">
                            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <UserPlus size={16} className="text-blue-500" /> Create New Account
                            </h3>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Full Name</label>
                                    <input
                                        className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-sm"
                                        value={newItem.full_name}
                                        onChange={e => setNewItem({ ...newItem, full_name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Email</label>
                                    <input
                                        type="email"
                                        className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-sm"
                                        value={newItem.email}
                                        onChange={e => setNewItem({ ...newItem, email: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Password</label>
                                    <input
                                        type="password"
                                        className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-sm"
                                        value={newItem.password}
                                        onChange={e => setNewItem({ ...newItem, password: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Role</label>
                                    <select
                                        className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-sm"
                                        value={newItem.role}
                                        onChange={e => setNewItem({ ...newItem, role: e.target.value })}
                                    >
                                        <option value="viewer">Viewer (Read Only)</option>
                                        <option value="admin">Admin (Full Access)</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex justify-end">
                                <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-bold text-sm">
                                    Create Account
                                </button>
                            </div>
                        </form>
                    )}

                    {/* User List */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 border-b border-slate-100 text-xs uppercase text-slate-500 font-bold">
                                <tr>
                                    <th className="px-6 py-4">User</th>
                                    <th className="px-6 py-4">Role</th>
                                    <th className="px-6 py-4 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr><td colSpan={3} className="p-8 text-center text-slate-400">Loading users...</td></tr>
                                ) : users.map(user => (
                                    <tr key={user.id} className={`hover:bg-slate-50 transition-colors ${!user.active ? 'opacity-50 grayscale' : ''}`}>
                                        <td className="px-6 py-4 space-y-1">
                                            {/* NAME EDIT */}
                                            {editingId === user.id && editingField === 'name' ? (
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        className="border rounded px-2 py-1 text-sm w-full"
                                                        value={editValue}
                                                        onChange={(e) => setEditValue(e.target.value)}
                                                        autoFocus
                                                    />
                                                    <button onClick={() => handleUpdate(user.id, { full_name: editValue })} className="text-green-600">
                                                        <CheckCircle size={16} />
                                                    </button>
                                                    <button onClick={() => { setEditingId(null); setEditingField(null); }} className="text-red-600">
                                                        <XCircle size={16} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="group flex items-center gap-2">
                                                    <div className="font-bold text-slate-800">{user.full_name}</div>
                                                    <button
                                                        onClick={() => { setEditingId(user.id); setEditingField('name'); setEditValue(user.full_name); }}
                                                        className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-blue-600"
                                                    >
                                                        <Edit2 size={12} />
                                                    </button>
                                                </div>
                                            )}

                                            {/* EMAIL EDIT */}
                                            {editingId === user.id && editingField === 'email' ? (
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        className="border rounded px-2 py-1 text-xs w-full font-mono"
                                                        value={editValue}
                                                        onChange={(e) => setEditValue(e.target.value)}
                                                        autoFocus
                                                    />
                                                    <button onClick={() => handleUpdate(user.id, { email: editValue })} className="text-green-600">
                                                        <CheckCircle size={14} />
                                                    </button>
                                                    <button onClick={() => { setEditingId(null); setEditingField(null); }} className="text-red-600">
                                                        <XCircle size={14} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="group flex items-center gap-2">
                                                    <div className="text-xs text-slate-400 font-mono">{user.email}</div>
                                                    <button
                                                        onClick={() => { setEditingId(user.id); setEditingField('email'); setEditValue(user.email); }}
                                                        className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-blue-600"
                                                    >
                                                        <Edit2 size={10} />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-2">
                                                <select
                                                    value={user.role}
                                                    onChange={(e) => handleUpdate(user.id, { role: e.target.value })}
                                                    className={`px-2 py-1 rounded-full text-xs font-bold border outline-none cursor-pointer w-fit ${user.role === 'admin'
                                                        ? 'bg-purple-50 text-purple-600 border-purple-100'
                                                        : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                        }`}
                                                >
                                                    <option value="viewer">VIEWER</option>
                                                    <option value="admin">ADMIN</option>
                                                </select>

                                                <button
                                                    onClick={() => {
                                                        const newPass = prompt("Enter new password for " + user.full_name);
                                                        if (newPass) handleUpdate(user.id, { password: newPass });
                                                    }}
                                                    className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-blue-600 transition-colors w-fit"
                                                >
                                                    <Key size={10} /> Reset Password
                                                </button>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 text-xs text-center">
                                            <button
                                                onClick={async () => {
                                                    if (!confirm(`Are you sure you want to ${user.active ? 'disable' : 'enable'} this user?`)) return;
                                                    try {
                                                        await api.put(`/users/${user.id}`, { active: user.active ? 0 : 1 });
                                                        fetchUsers();
                                                    } catch (err) {
                                                        alert('Status update failed');
                                                    }
                                                }}
                                                className={`flex items-center gap-1 px-3 py-1 rounded-full font-bold transition-all ${user.active
                                                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                                    : 'bg-red-100 text-red-700 hover:bg-red-200'
                                                    }`}
                                            >
                                                {user.active ? <CheckCircle size={14} /> : <XCircle size={14} />}
                                                {user.active ? 'Active' : 'Disabled'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserManagement;
