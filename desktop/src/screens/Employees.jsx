import React, { useState, useEffect } from 'react';
import { useBusiness } from '../context/BusinessContext';
import api from '../services/api';
import {
    FiPlus,
    FiSearch,
    FiEdit2,
    FiTrash2,
    FiUsers,
    FiX,
    FiSave,
    FiMail,
    FiPhone,
    FiPercent,
    FiHash,
} from 'react-icons/fi';

// Business type detection (mirrors frontend/constants/employeeConfig.js)
const getBusinessType = (config) => {
    const code = config?.type?.toLowerCase() || '';
    if (['salon', 'spa', 'clinic', 'service', 'ser', 'sal', 'cli'].some(t => code.includes(t))) return 'service';
    if (['restaurant', 'food', 'cafe', 'kitchen', 'res', 'caf'].some(t => code.includes(t))) return 'restaurant';
    return 'retail';
};

const ROLE_OPTIONS = {
    service: [
        { label: 'Employee', value: 'employee' },
        { label: 'Senior', value: 'senior' },
        { label: 'Manager', value: 'manager' },
    ],
    restaurant: [
        { label: 'Waiter', value: 'waiter' },
        { label: 'Chef', value: 'chef' },
        { label: 'Head Chef', value: 'head_chef' },
        { label: 'Manager', value: 'manager' },
    ],
    retail: [],
};

const DEFAULT_ROLES = { service: 'employee', restaurant: 'waiter', retail: 'employee' };

const STATUS_OPTIONS = [
    { label: 'Active', value: 'active' },
    { label: 'Inactive', value: 'inactive' },
    { label: 'On Leave', value: 'on_leave' },
];

const Employees = () => {
    const { config } = useBusiness();
    const businessType = getBusinessType(config);
    const roles = ROLE_OPTIONS[businessType] || [];
    const isService = businessType === 'service';

    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState(null);
    const [prefix, setPrefix] = useState('emp@');
    const [generatedId, setGeneratedId] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        role: DEFAULT_ROLES[businessType] || 'employee',
        password: '',
        requirePasswordChange: true,
        status: 'active',
        commissionRate: '',
        specializations: '',
    });

    useEffect(() => {
        fetchEmployees();
        fetchPrefix();
    }, []);

    const fetchEmployees = async () => {
        try {
            const res = await api.get('/employee');
            setEmployees(res.data || []);
        } catch (error) {
            console.error('Error fetching employees:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchPrefix = async () => {
        try {
            const res = await api.get('/employee/prefix');
            setPrefix(res.data?.prefix || 'emp@');
        } catch (error) {
            console.log('Using default prefix');
        }
    };

    // Auto-generate employeeId from name
    const updateName = (name) => {
        setFormData(prev => ({ ...prev, name }));
        if (!editingEmployee) {
            const username = name.toLowerCase().replace(/\s+/g, '');
            setGeneratedId(username ? `${prefix}${username}` : '');
        }
    };

    const filteredEmployees = employees.filter(
        (e) =>
            e.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            e.employeeId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            e.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            e.phone?.includes(searchQuery)
    );

    const openModal = (employee = null) => {
        if (employee) {
            setEditingEmployee(employee);
            setGeneratedId(employee.employeeId || '');
            setFormData({
                name: employee.name || '',
                email: employee.email || '',
                phone: employee.phone || '',
                role: employee.role || DEFAULT_ROLES[businessType] || 'employee',
                password: '',
                requirePasswordChange: false,
                status: employee.status || 'active',
                commissionRate: employee.commissionRate || '',
                specializations: (employee.specializations || []).join(', '),
            });
        } else {
            setEditingEmployee(null);
            setGeneratedId('');
            setFormData({
                name: '',
                email: '',
                phone: '',
                role: DEFAULT_ROLES[businessType] || 'employee',
                password: '',
                requirePasswordChange: true,
                status: 'active',
                commissionRate: '',
                specializations: '',
            });
        }
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const data = {
                name: formData.name,
                phone: formData.phone,
                email: formData.email,
                status: formData.status,
            };

            if (roles.length > 0) data.role = formData.role;
            if (formData.password) data.password = formData.password;

            if (!editingEmployee) {
                // Creating: include ID generation fields
                data.username = formData.name.toLowerCase().replace(/\s+/g, '');
                data.requirePasswordChange = formData.requirePasswordChange;
                if (!data.password) {
                    alert('Password is required');
                    return;
                }
            }

            if (isService) {
                data.commissionRate = parseInt(formData.commissionRate) || 0;
                data.specializations = formData.specializations
                    .split(',')
                    .map(s => s.trim())
                    .filter(Boolean);
            }

            if (editingEmployee) {
                await api.patch(`/employee/${editingEmployee._id}`, data);
            } else {
                await api.post('/employee', data);
            }

            setShowModal(false);
            fetchEmployees();
        } catch (error) {
            console.error('Error saving employee:', error);
            alert(error.response?.data?.message || 'Failed to save employee');
        }
    };

    const handleDelete = async (employeeId) => {
        if (!window.confirm('Are you sure you want to delete this employee?')) return;
        try {
            await api.delete(`/employee/${employeeId}`);
            fetchEmployees();
        } catch (error) {
            console.error('Error deleting employee:', error);
            alert('Failed to delete employee');
        }
    };

    const getRoleBadgeColor = (role) => {
        switch (role) {
            case 'admin': case 'manager': case 'head_chef':
                return 'bg-purple-100 text-purple-600 dark:bg-[rgba(139,92,246,0.15)] dark:text-[#a78bfa]';
            case 'senior': case 'chef':
                return 'bg-blue-100 text-blue-600 dark:bg-[rgba(59,130,246,0.15)] dark:text-[#60a5fa]';
            default:
                return 'bg-slate-100 text-slate-600 dark:bg-d-glass-hover dark:text-d-muted';
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'active':
                return 'bg-green-100 text-green-600 dark:bg-[rgba(52,232,161,0.15)] dark:text-d-green';
            case 'inactive':
                return 'bg-red-100 text-red-600 dark:bg-[rgba(255,107,107,0.15)] dark:text-d-red';
            case 'on_leave':
                return 'bg-yellow-100 text-yellow-600 dark:bg-[rgba(255,210,100,0.15)] dark:text-d-accent';
            default:
                return 'bg-slate-100 text-slate-600 dark:bg-d-glass-hover dark:text-d-muted';
        }
    };

    const inputClass = "w-full px-4 py-2 bg-white dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl text-slate-800 dark:text-d-text placeholder-slate-400 dark:placeholder-d-faint focus:outline-none focus:border-amber-300 dark:focus:border-d-border-hover";
    const labelClass = "block text-sm font-medium text-slate-700 dark:text-d-muted mb-1";

    return (
        <div className="p-6 animate-fadeIn bg-slate-50 dark:bg-d-bg min-h-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-d-heading">
                        {config?.staffLabel || 'Employees'}
                    </h1>
                    <p className="text-slate-500 dark:text-d-muted">{employees.length} team members</p>
                </div>
                <button
                    onClick={() => openModal()}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 dark:from-d-accent dark:to-d-accent-s text-white dark:text-d-card rounded-xl font-semibold hover:shadow-md dark:hover:shadow-[0_4px_20px_rgba(255,210,100,0.4)] transition-all"
                >
                    <FiPlus />
                    Add {config?.staffLabel || 'Employee'}
                </button>
            </div>

            {/* Search */}
            <div className="relative mb-6">
                <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-d-faint" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, ID, email or phone..."
                    className="w-full max-w-md pl-12 pr-4 py-3 bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-xl text-slate-800 dark:text-d-text placeholder-slate-400 dark:placeholder-d-faint focus:outline-none focus:border-amber-300 dark:focus:border-d-border-hover transition-colors"
                />
            </div>

            {/* Employees Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredEmployees.map((employee) => (
                    <div
                        key={employee._id}
                        className="bg-white dark:bg-d-card rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-d-border hover:border-amber-300 dark:hover:border-d-border-hover transition-all"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-primary-100 dark:bg-[rgba(255,210,100,0.1)] rounded-xl flex items-center justify-center">
                                    <span className="text-xl font-bold text-primary-600 dark:text-d-accent">
                                        {employee.name?.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-800 dark:text-d-text">{employee.name}</h3>
                                    {employee.employeeId && (
                                        <p className="text-xs text-slate-400 dark:text-d-faint font-mono">{employee.employeeId}</p>
                                    )}
                                    <div className="flex items-center gap-2 mt-1">
                                        {roles.length > 0 && (
                                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(employee.role)}`}>
                                                {employee.role}
                                            </span>
                                        )}
                                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(employee.status)}`}>
                                            {employee.status || 'active'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => openModal(employee)}
                                    className="p-2 text-slate-400 dark:text-d-faint hover:text-primary-500 dark:hover:text-d-accent hover:bg-primary-50 dark:hover:bg-[rgba(255,210,100,0.1)] rounded-lg transition-colors"
                                >
                                    <FiEdit2 size={18} />
                                </button>
                                <button
                                    onClick={() => handleDelete(employee._id)}
                                    className="p-2 text-slate-400 dark:text-d-faint hover:text-red-500 dark:hover:text-d-red hover:bg-red-50 dark:hover:bg-[rgba(255,107,107,0.1)] rounded-lg transition-colors"
                                >
                                    <FiTrash2 size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            {employee.email && (
                                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-d-muted">
                                    <FiMail size={14} />
                                    <span>{employee.email}</span>
                                </div>
                            )}
                            {employee.phone && (
                                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-d-muted">
                                    <FiPhone size={14} />
                                    <span>{employee.phone}</span>
                                </div>
                            )}
                            {isService && employee.commissionRate > 0 && (
                                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-d-muted">
                                    <FiPercent size={14} />
                                    <span>{employee.commissionRate}% commission</span>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {filteredEmployees.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-d-faint">
                    <FiUsers size={48} />
                    <p className="mt-4 dark:text-d-muted">No employees found</p>
                </div>
            )}

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 dark:bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-d-card dark:border dark:border-d-border rounded-2xl w-full max-w-lg animate-fadeIn max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-d-border sticky top-0 bg-white dark:bg-d-card rounded-t-2xl z-10">
                            <h3 className="text-xl font-semibold text-slate-800 dark:text-d-heading">
                                {editingEmployee ? `Edit ${config?.staffLabel || 'Employee'}` : `Add ${config?.staffLabel || 'Employee'}`}
                            </h3>
                            <button
                                onClick={() => setShowModal(false)}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-d-glass-hover rounded-lg transition-colors text-slate-600 dark:text-d-muted"
                            >
                                <FiX />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {/* Name */}
                            <div>
                                <label className={labelClass}>Name *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => updateName(e.target.value)}
                                    className={inputClass}
                                    required
                                    placeholder="Full name"
                                />
                            </div>

                            {/* Employee ID (auto-generated, shown always) */}
                            <div>
                                <label className={labelClass}>Employee ID</label>
                                <div className="flex items-center gap-2">
                                    <div className={`${inputClass} bg-slate-50 dark:bg-d-elevated flex items-center gap-2`}>
                                        <FiHash size={14} className="text-slate-400 dark:text-d-faint" />
                                        <span className={generatedId || editingEmployee?.employeeId ? 'text-slate-800 dark:text-d-text' : 'text-slate-400 dark:text-d-faint'}>
                                            {editingEmployee ? editingEmployee.employeeId : (generatedId || 'Auto-generated from name')}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Password */}
                            <div>
                                <label className={labelClass}>
                                    {editingEmployee ? 'New Password (leave empty to keep)' : 'Password *'}
                                </label>
                                <input
                                    type="password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    className={inputClass}
                                    required={!editingEmployee}
                                    placeholder={editingEmployee ? 'Leave empty to keep current' : 'Min 4 characters'}
                                    minLength={formData.password ? 4 : undefined}
                                />
                            </div>

                            {/* Require Password Change (create only) */}
                            {!editingEmployee && (
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.requirePasswordChange}
                                        onChange={(e) => setFormData({ ...formData, requirePasswordChange: e.target.checked })}
                                        className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                                    />
                                    <span className="text-sm text-slate-700 dark:text-d-text">
                                        Require password change on first login
                                    </span>
                                </label>
                            )}

                            {/* Phone & Email (side by side) */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>Phone</label>
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        className={inputClass}
                                        placeholder="Phone number"
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Email</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className={inputClass}
                                        placeholder="Email address"
                                    />
                                </div>
                            </div>

                            {/* Role & Status (side by side) */}
                            <div className="grid grid-cols-2 gap-4">
                                {roles.length > 0 && (
                                    <div>
                                        <label className={labelClass}>Role</label>
                                        <select
                                            value={formData.role}
                                            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                            className={inputClass}
                                        >
                                            {roles.map((r) => (
                                                <option key={r.value} value={r.value}>{r.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                <div>
                                    <label className={labelClass}>Status</label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                        className={inputClass}
                                    >
                                        {STATUS_OPTIONS.map((s) => (
                                            <option key={s.value} value={s.value}>{s.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Service-only fields */}
                            {isService && (
                                <>
                                    <div>
                                        <label className={labelClass}>Specializations</label>
                                        <input
                                            type="text"
                                            value={formData.specializations}
                                            onChange={(e) => setFormData({ ...formData, specializations: e.target.value })}
                                            className={inputClass}
                                            placeholder="e.g. Haircut, Coloring, Styling"
                                        />
                                        <p className="text-xs text-slate-400 dark:text-d-faint mt-1">Comma-separated</p>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Commission Rate (%)</label>
                                        <input
                                            type="number"
                                            value={formData.commissionRate}
                                            onChange={(e) => setFormData({ ...formData, commissionRate: e.target.value })}
                                            className={inputClass}
                                            min="0"
                                            max="100"
                                            placeholder="0"
                                        />
                                    </div>
                                </>
                            )}

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 py-3 border border-slate-200 dark:border-d-border rounded-xl font-medium text-slate-600 dark:text-d-muted hover:bg-slate-50 dark:hover:bg-d-glass transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3 bg-gradient-to-r from-amber-400 to-amber-500 dark:from-d-accent dark:to-d-accent-s text-white dark:text-d-card rounded-xl font-medium hover:shadow-md dark:hover:shadow-[0_4px_20px_rgba(255,210,100,0.4)] transition-all flex items-center justify-center gap-2"
                                >
                                    <FiSave />
                                    Save
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Employees;
