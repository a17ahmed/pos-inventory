import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import { updateBusiness } from '../services/api/business';
import { useTheme } from '../context/ThemeContext';
import {
    FiUser,
    FiServer,
    FiLogOut,
    FiBriefcase,
    FiChevronRight,
    FiShield,
    FiPrinter,
    FiBell,
    FiHelpCircle,
    FiInfo,
    FiMail,
    FiPhone,
    FiMapPin,
    FiX,
    FiSave,
    FiDollarSign,
    FiGlobe,
    FiLock,
    FiDatabase,
    FiMoon,
    FiSun,
} from 'react-icons/fi';

const Settings = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { business, config, refreshBusiness } = useBusiness();
    const { isDark, toggleTheme } = useTheme();

    const [activeModal, setActiveModal] = useState(null);
    const [serverUrl, setServerUrl] = useState(import.meta.env.VITE_API_URL || 'http://localhost:3000');
    const [savingBusiness, setSavingBusiness] = useState(false);
    const bizFormRef = useRef({});

    const handleSaveBusiness = async () => {
        setSavingBusiness(true);
        try {
            const id = business?._id || business?.id;
            await updateBusiness(id, bizFormRef.current);
            await refreshBusiness();
            setActiveModal(null);
        } catch (err) {
            alert('Failed to save: ' + (err.response?.data?.message || err.message));
        } finally {
            setSavingBusiness(false);
        }
    };

    const handleLogout = async () => {
        if (window.confirm('Are you sure you want to logout?')) {
            await logout();
            navigate('/login');
        }
    };

    const handleSaveServer = () => {
        setActiveModal(null);
        alert('Server URL is configured via .env file (VITE_API_URL). Restart the app after changing it.');
    };

    // Setting item component
    const SettingItem = ({ icon: Icon, label, value, onClick, color = 'text-slate-600', danger = false, rightElement = null }) => (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-4 px-4 py-4 hover:bg-slate-50 dark:hover:bg-d-glass-hover transition-colors ${
                danger ? 'text-red-500' : ''
            }`}
        >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                danger ? 'bg-red-100 dark:bg-red-900/30' : 'bg-slate-100 dark:bg-d-elevated'
            }`}>
                <Icon size={20} className={danger ? 'text-red-500 dark:text-d-red' : color} />
            </div>
            <div className="flex-1 text-left">
                <p className={`font-medium ${danger ? 'text-red-500 dark:text-d-red' : 'text-slate-800 dark:text-d-heading'}`}>{label}</p>
                {value && <p className="text-sm text-slate-500 dark:text-d-muted">{value}</p>}
            </div>
            {rightElement || <FiChevronRight size={20} className="text-slate-400 dark:text-d-muted" />}
        </button>
    );

    // Section component
    const Section = ({ title, children }) => (
        <div className="bg-white dark:bg-d-card rounded-2xl shadow-sm border border-slate-100 dark:border-d-border overflow-hidden mb-4">
            {title && (
                <div className="px-4 py-3 bg-slate-50 dark:bg-d-elevated border-b border-slate-100 dark:border-d-border">
                    <h3 className="text-sm font-semibold text-slate-500 dark:text-d-muted uppercase tracking-wide">{title}</h3>
                </div>
            )}
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {children}
            </div>
        </div>
    );

    return (
        <div className="p-6 animate-fadeIn max-w-3xl mx-auto">
            {/* Header */}
            <h1 className="text-2xl font-bold text-slate-800 dark:text-d-heading mb-6">Settings</h1>

            {/* Profile Card */}
            <div className="bg-white dark:bg-d-card rounded-2xl shadow-sm border border-slate-100 dark:border-d-border p-6 mb-6">
                <div className="flex items-center gap-4">
                    <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold"
                        style={{ backgroundColor: config?.color || '#6366f1' }}
                    >
                        {user?.name?.charAt(0).toUpperCase() || 'A'}
                    </div>
                    <div className="flex-1">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-d-heading">{user?.name || 'Admin User'}</h2>
                        <p className="text-slate-500 dark:text-d-muted">{user?.email || 'admin@example.com'}</p>
                        <span className="inline-block mt-1 px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-full text-xs font-medium">
                            Administrator
                        </span>
                    </div>
                    <button
                        onClick={() => setActiveModal('profile')}
                        className="px-4 py-2 text-primary-500 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-xl font-medium transition-colors"
                    >
                        Edit
                    </button>
                </div>
            </div>

            {/* Business Section */}
            <Section title="Business">
                <SettingItem
                    icon={FiBriefcase}
                    label="Business Info"
                    value={business?.name || 'Not set'}
                    onClick={() => setActiveModal('business')}
                    color="text-blue-500"
                />
                <SettingItem
                    icon={FiDollarSign}
                    label="Currency"
                    value={business?.currency || 'PKR'}
                    onClick={() => setActiveModal('business')}
                    color="text-green-500"
                />
                <SettingItem
                    icon={FiPrinter}
                    label="Receipt Settings"
                    value="Configure receipt format"
                    onClick={() => setActiveModal('receipt')}
                    color="text-purple-500"
                />
            </Section>

            {/* App Settings Section */}
            <Section title="App Settings">
                <SettingItem
                    icon={isDark ? FiSun : FiMoon}
                    label="Dark Mode"
                    value={isDark ? 'On' : 'Off'}
                    onClick={toggleTheme}
                    color={isDark ? 'text-yellow-500' : 'text-indigo-500'}
                    rightElement={
                        <div
                            className="relative inline-flex items-center cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={isDark}
                                onChange={toggleTheme}
                            />
                            <div className="w-11 h-6 bg-slate-200 dark:bg-slate-600 peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                        </div>
                    }
                />
                <SettingItem
                    icon={FiServer}
                    label="Server Configuration"
                    value={import.meta.env.VITE_API_URL || 'http://localhost:3000'}
                    onClick={() => setActiveModal('server')}
                    color="text-orange-500"
                />
                <SettingItem
                    icon={FiBell}
                    label="Notifications"
                    value="Manage alerts"
                    onClick={() => {}}
                    color="text-pink-500"
                />
                <SettingItem
                    icon={FiDatabase}
                    label="Data & Storage"
                    value="Clear cache, export data"
                    onClick={() => {}}
                    color="text-cyan-500"
                />
            </Section>

            {/* Security Section */}
            <Section title="Security">
                <SettingItem
                    icon={FiLock}
                    label="Change Password"
                    value="Update your password"
                    onClick={() => {}}
                    color="text-amber-500"
                />
                <SettingItem
                    icon={FiShield}
                    label="Security Settings"
                    value="Two-factor authentication"
                    onClick={() => {}}
                    color="text-emerald-500"
                />
            </Section>

            {/* Support Section */}
            <Section title="Support">
                <SettingItem
                    icon={FiHelpCircle}
                    label="Help & Support"
                    value="FAQs, contact us"
                    onClick={() => {}}
                    color="text-blue-500"
                />
                <SettingItem
                    icon={FiInfo}
                    label="About"
                    value="Version 1.0.0"
                    onClick={() => setActiveModal('about')}
                    color="text-slate-500"
                />
            </Section>

            {/* Logout */}
            <Section>
                <SettingItem
                    icon={FiLogOut}
                    label="Logout"
                    onClick={handleLogout}
                    danger
                />
            </Section>

            {/* Profile Modal */}
            {activeModal === 'profile' && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-d-card rounded-2xl w-full max-w-lg animate-fadeIn">
                        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-d-border">
                            <h3 className="text-xl font-semibold text-slate-800 dark:text-d-heading">Edit Profile</h3>
                            <button
                                onClick={() => setActiveModal(null)}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-d-glass-hover rounded-lg transition-colors text-slate-600 dark:text-d-text"
                            >
                                <FiX />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="flex justify-center mb-4">
                                <div
                                    className="w-24 h-24 rounded-2xl flex items-center justify-center text-white text-3xl font-bold"
                                    style={{ backgroundColor: config?.color || '#6366f1' }}
                                >
                                    {user?.name?.charAt(0).toUpperCase() || 'A'}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-d-text mb-1">Full Name</label>
                                <input
                                    type="text"
                                    defaultValue={user?.name}
                                    className="w-full px-4 py-3 border border-slate-200 dark:border-d-border rounded-xl focus:ring-2 focus:ring-primary-500 bg-white dark:bg-d-elevated text-slate-800 dark:text-d-heading"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-d-text mb-1">Email</label>
                                <input
                                    type="email"
                                    defaultValue={user?.email}
                                    className="w-full px-4 py-3 border border-slate-200 dark:border-d-border rounded-xl focus:ring-2 focus:ring-primary-500 bg-white dark:bg-d-elevated text-slate-800 dark:text-d-heading"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-d-text mb-1">Phone</label>
                                <input
                                    type="tel"
                                    defaultValue={user?.phone}
                                    className="w-full px-4 py-3 border border-slate-200 dark:border-d-border rounded-xl focus:ring-2 focus:ring-primary-500 bg-white dark:bg-d-elevated text-slate-800 dark:text-d-heading"
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setActiveModal(null)}
                                    className="flex-1 py-3 border border-slate-200 dark:border-d-border rounded-xl font-medium text-slate-600 dark:text-d-text hover:bg-slate-50 dark:hover:bg-d-glass-hover"
                                >
                                    Cancel
                                </button>
                                <button className="flex-1 py-3 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600 flex items-center justify-center gap-2">
                                    <FiSave size={18} />
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Business Modal */}
            {activeModal === 'business' && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-d-card rounded-2xl w-full max-w-lg animate-fadeIn max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-d-border sticky top-0 bg-white dark:bg-d-card">
                            <h3 className="text-xl font-semibold text-slate-800 dark:text-d-heading">Business Settings</h3>
                            <button
                                onClick={() => setActiveModal(null)}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-d-glass-hover rounded-lg transition-colors text-slate-600 dark:text-d-text"
                            >
                                <FiX />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-d-elevated rounded-xl">
                                <div
                                    className="w-14 h-14 rounded-xl flex items-center justify-center text-white text-xl font-bold"
                                    style={{ backgroundColor: config?.color || '#6366f1' }}
                                >
                                    {business?.name?.charAt(0) || 'B'}
                                </div>
                                <div>
                                    <h4 className="font-semibold text-slate-800 dark:text-d-heading">{business?.name}</h4>
                                    <p className="text-sm text-slate-500 dark:text-d-muted capitalize">{config?.label || 'Business'}</p>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-d-text mb-1">
                                    <FiBriefcase className="inline mr-2" size={14} />
                                    Business Name
                                </label>
                                <input
                                    type="text"
                                    defaultValue={business?.name}
                                    onChange={(e) => bizFormRef.current.name = e.target.value}
                                    className="w-full px-4 py-3 border border-slate-200 dark:border-d-border rounded-xl focus:ring-2 focus:ring-primary-500 bg-white dark:bg-d-elevated text-slate-800 dark:text-d-heading"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-d-text mb-1">
                                    <FiPhone className="inline mr-2" size={14} />
                                    Phone
                                </label>
                                <input
                                    type="tel"
                                    defaultValue={business?.phone}
                                    onChange={(e) => bizFormRef.current.phone = e.target.value}
                                    className="w-full px-4 py-3 border border-slate-200 dark:border-d-border rounded-xl focus:ring-2 focus:ring-primary-500 bg-white dark:bg-d-elevated text-slate-800 dark:text-d-heading"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-d-text mb-1">
                                    <FiMail className="inline mr-2" size={14} />
                                    Email
                                </label>
                                <input
                                    type="email"
                                    defaultValue={business?.email}
                                    onChange={(e) => bizFormRef.current.email = e.target.value}
                                    className="w-full px-4 py-3 border border-slate-200 dark:border-d-border rounded-xl focus:ring-2 focus:ring-primary-500 bg-white dark:bg-d-elevated text-slate-800 dark:text-d-heading"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-d-text mb-1">
                                    <FiDollarSign className="inline mr-2" size={14} />
                                    Currency
                                </label>
                                <select
                                    defaultValue={business?.currency || 'PKR'}
                                    onChange={(e) => bizFormRef.current.currency = e.target.value}
                                    className="w-full px-4 py-3 border border-slate-200 dark:border-d-border rounded-xl focus:ring-2 focus:ring-primary-500 bg-white dark:bg-d-elevated text-slate-800 dark:text-d-heading"
                                >
                                    <option value="PKR">PKR - Pakistani Rupee</option>
                                    <option value="USD">USD - US Dollar</option>
                                    <option value="EUR">EUR - Euro</option>
                                    <option value="GBP">GBP - British Pound</option>
                                    <option value="AED">AED - UAE Dirham</option>
                                    <option value="SAR">SAR - Saudi Riyal</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-d-text mb-1">
                                    <FiMapPin className="inline mr-2" size={14} />
                                    Address
                                </label>
                                <input
                                    type="text"
                                    defaultValue={business?.address?.street || ''}
                                    onChange={(e) => bizFormRef.current.address = { ...(bizFormRef.current.address || business?.address || {}), street: e.target.value }}
                                    placeholder="Street address"
                                    className="w-full px-4 py-3 border border-slate-200 dark:border-d-border rounded-xl focus:ring-2 focus:ring-primary-500 bg-white dark:bg-d-elevated text-slate-800 dark:text-d-heading"
                                />
                                <input
                                    type="text"
                                    defaultValue={business?.address?.city || ''}
                                    onChange={(e) => bizFormRef.current.address = { ...(bizFormRef.current.address || business?.address || {}), city: e.target.value }}
                                    placeholder="City"
                                    className="w-full px-4 py-3 mt-2 border border-slate-200 dark:border-d-border rounded-xl focus:ring-2 focus:ring-primary-500 bg-white dark:bg-d-elevated text-slate-800 dark:text-d-heading"
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setActiveModal(null)}
                                    className="flex-1 py-3 border border-slate-200 dark:border-d-border rounded-xl font-medium text-slate-600 dark:text-d-text hover:bg-slate-50 dark:hover:bg-d-glass-hover"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveBusiness}
                                    disabled={savingBusiness}
                                    className="flex-1 py-3 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600 flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    <FiSave size={18} />
                                    {savingBusiness ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Server Modal */}
            {activeModal === 'server' && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-d-card rounded-2xl w-full max-w-lg animate-fadeIn">
                        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-d-border">
                            <h3 className="text-xl font-semibold text-slate-800 dark:text-d-heading">Server Configuration</h3>
                            <button
                                onClick={() => setActiveModal(null)}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-d-glass-hover rounded-lg transition-colors text-slate-600 dark:text-d-text"
                            >
                                <FiX />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
                                <p className="text-sm text-yellow-700 dark:text-d-accent">
                                    <strong>Note:</strong> Changing the server URL requires restarting the application.
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-d-text mb-1">
                                    <FiServer className="inline mr-2" size={14} />
                                    API Server URL
                                </label>
                                <input
                                    type="text"
                                    value={serverUrl}
                                    onChange={(e) => setServerUrl(e.target.value)}
                                    placeholder="http://192.168.100.26:3000"
                                    className="w-full px-4 py-3 border border-slate-200 dark:border-d-border rounded-xl focus:ring-2 focus:ring-primary-500 bg-white dark:bg-d-elevated text-slate-800 dark:text-d-heading"
                                />
                            </div>
                            <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                                <span className="text-green-700 dark:text-d-green font-medium">Connected to server</span>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setActiveModal(null)}
                                    className="flex-1 py-3 border border-slate-200 dark:border-d-border rounded-xl font-medium text-slate-600 dark:text-d-text hover:bg-slate-50 dark:hover:bg-d-glass-hover"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveServer}
                                    className="flex-1 py-3 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600 flex items-center justify-center gap-2"
                                >
                                    <FiSave size={18} />
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* About Modal */}
            {activeModal === 'about' && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-d-card rounded-2xl w-full max-w-md animate-fadeIn text-center">
                        <div className="p-8">
                            <div className="w-20 h-20 bg-primary-100 dark:bg-primary-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <FiBriefcase size={40} className="text-primary-500 dark:text-primary-400" />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-800 dark:text-d-heading mb-2">POS Desktop</h3>
                            <p className="text-slate-500 dark:text-d-muted mb-4">Version 1.0.0</p>
                            <p className="text-sm text-slate-500 dark:text-d-muted mb-6">
                                A modern point of sale system for retail businesses.
                            </p>
                            <div className="space-y-2 text-sm text-slate-600 dark:text-d-muted">
                                <p>Built with Electron + React</p>
                                <p>© 2024 POS Desktop. All rights reserved.</p>
                            </div>
                            <button
                                onClick={() => setActiveModal(null)}
                                className="mt-6 px-8 py-3 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Receipt Settings Modal */}
            {activeModal === 'receipt' && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-d-card rounded-2xl w-full max-w-lg animate-fadeIn">
                        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-d-border">
                            <h3 className="text-xl font-semibold text-slate-800 dark:text-d-heading">Receipt Settings</h3>
                            <button
                                onClick={() => setActiveModal(null)}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-d-glass-hover rounded-lg transition-colors text-slate-600 dark:text-d-text"
                            >
                                <FiX />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-d-text mb-1">Receipt Header</label>
                                <input
                                    type="text"
                                    defaultValue={business?.name}
                                    placeholder="Business name on receipt"
                                    className="w-full px-4 py-3 border border-slate-200 dark:border-d-border rounded-xl focus:ring-2 focus:ring-primary-500 bg-white dark:bg-d-elevated text-slate-800 dark:text-d-heading"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-d-text mb-1">Footer Message</label>
                                <input
                                    type="text"
                                    defaultValue="Thank you for your purchase!"
                                    className="w-full px-4 py-3 border border-slate-200 dark:border-d-border rounded-xl focus:ring-2 focus:ring-primary-500 bg-white dark:bg-d-elevated text-slate-800 dark:text-d-heading"
                                />
                            </div>
                            <div className="flex items-center justify-between py-3">
                                <div>
                                    <p className="font-medium text-slate-800 dark:text-d-heading">Show Business Logo</p>
                                    <p className="text-sm text-slate-500 dark:text-d-muted">Display logo on printed receipts</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" defaultChecked />
                                    <div className="w-11 h-6 bg-slate-200 dark:bg-slate-600 peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                                </label>
                            </div>
                            <div className="flex items-center justify-between py-3">
                                <div>
                                    <p className="font-medium text-slate-800 dark:text-d-heading">Auto Print</p>
                                    <p className="text-sm text-slate-500 dark:text-d-muted">Automatically print after checkout</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" />
                                    <div className="w-11 h-6 bg-slate-200 dark:bg-slate-600 peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                                </label>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setActiveModal(null)}
                                    className="flex-1 py-3 border border-slate-200 dark:border-d-border rounded-xl font-medium text-slate-600 dark:text-d-text hover:bg-slate-50 dark:hover:bg-d-glass-hover"
                                >
                                    Cancel
                                </button>
                                <button className="flex-1 py-3 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600 flex items-center justify-center gap-2">
                                    <FiSave size={18} />
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;
