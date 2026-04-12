import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBusiness } from '../context/BusinessContext';
import { useAuth } from '../context/AuthContext';
import { getReceiptStats } from '../services/api/receipts';
import {
    FiUser,
    FiMail,
    FiPhone,
    FiBriefcase,
    FiClock,
    FiDollarSign,
    FiShoppingCart,
    FiLogOut,
    FiRefreshCw,
    FiTrendingUp,
    FiCalendar,
    FiAward,
} from 'react-icons/fi';

const Profile = () => {
    const navigate = useNavigate();
    const { business } = useBusiness();
    const { user, logout } = useAuth();
    const [stats, setStats] = useState({
        todaySales: 0,
        todayOrders: 0,
        monthSales: 0,
        monthOrders: 0,
    });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            const res = await getReceiptStats();
            setStats({
                todaySales: res.data.netTodaySales || res.data.todaySales || 0,
                todayOrders: res.data.todayOrders || 0,
                monthSales: res.data.netMonthSales || res.data.monthSales || 0,
                monthOrders: res.data.monthOrders || 0,
            });
        } catch (error) {
            console.error('Error loading stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadStats();
        setRefreshing(false);
    };

    const handleLogout = async () => {
        if (window.confirm('Are you sure you want to sign out?')) {
            await logout();
            navigate('/login');
        }
    };

    const formatCurrency = (amount) => `Rs. ${(amount || 0).toLocaleString()}`;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full bg-slate-50 dark:bg-d-bg">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-d-accent border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-500 dark:text-d-muted">Loading profile...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full bg-slate-50 dark:bg-d-bg overflow-auto">
            <div className="p-6 max-w-4xl mx-auto animate-fade-slide-up">
                {/* Header Card */}
                <div className="bg-gradient-to-br from-slate-100 to-white dark:from-d-elevated dark:to-d-card rounded-2xl p-8 border border-slate-200 dark:border-d-border mb-6 relative overflow-hidden">
                    {/* Decorative elements */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[rgba(255,210,100,0.1)] to-transparent rounded-full blur-3xl" />
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-[rgba(91,156,246,0.08)] to-transparent rounded-full blur-2xl" />

                    <div className="relative flex items-center gap-6">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-d-accent to-d-accent-s flex items-center justify-center shadow-[0_8px_32px_rgba(255,210,100,0.3)]">
                            <span className="text-3xl font-bold text-white dark:text-d-card">
                                {user?.name?.charAt(0) || 'E'}
                            </span>
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800 dark:text-d-heading">{user?.name || 'Employee'}</h1>
                            <div className="flex items-center gap-2 mt-2 text-slate-500 dark:text-d-muted">
                                <FiBriefcase size={16} />
                                <span>Sales Associate</span>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="w-2 h-2 bg-d-green rounded-full animate-pulse" />
                                <span className="text-sm text-d-green">Active</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Today's Performance */}
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-slate-800 dark:text-d-heading">Today's Performance</h2>
                        <button
                            onClick={handleRefresh}
                            disabled={refreshing}
                            className="flex items-center gap-2 px-4 py-2 bg-[rgba(255,210,100,0.1)] text-d-accent rounded-xl text-sm font-medium hover:bg-[rgba(255,210,100,0.15)] transition-colors disabled:opacity-50"
                        >
                            <FiRefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                            {refreshing ? 'Refreshing...' : 'Refresh'}
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white dark:bg-d-card rounded-2xl p-6 border border-slate-200 dark:border-d-border">
                            <div className="w-12 h-12 rounded-xl bg-[rgba(52,232,161,0.1)] flex items-center justify-center mb-4">
                                <FiDollarSign size={24} className="text-d-green" />
                            </div>
                            <p className="text-sm text-slate-500 dark:text-d-muted">Today's Sales</p>
                            <p className="text-2xl font-bold text-d-green mt-1 font-display">{formatCurrency(stats.todaySales)}</p>
                        </div>
                        <div className="bg-white dark:bg-d-card rounded-2xl p-6 border border-slate-200 dark:border-d-border">
                            <div className="w-12 h-12 rounded-xl bg-[rgba(91,156,246,0.1)] flex items-center justify-center mb-4">
                                <FiShoppingCart size={24} className="text-d-blue" />
                            </div>
                            <p className="text-sm text-slate-500 dark:text-d-muted">Today's Orders</p>
                            <p className="text-2xl font-bold text-slate-800 dark:text-d-heading mt-1">{stats.todayOrders}</p>
                        </div>
                    </div>
                </div>

                {/* This Month */}
                <div className="mb-6">
                    <h2 className="text-lg font-semibold text-slate-800 dark:text-d-heading mb-4">This Month</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white dark:bg-d-card rounded-2xl p-6 border border-slate-200 dark:border-d-border">
                            <div className="w-12 h-12 rounded-xl bg-[rgba(255,210,100,0.1)] flex items-center justify-center mb-4">
                                <FiTrendingUp size={24} className="text-d-accent" />
                            </div>
                            <p className="text-sm text-slate-500 dark:text-d-muted">Month Sales</p>
                            <p className="text-2xl font-bold text-d-accent mt-1 font-display">{formatCurrency(stats.monthSales)}</p>
                        </div>
                        <div className="bg-white dark:bg-d-card rounded-2xl p-6 border border-slate-200 dark:border-d-border">
                            <div className="w-12 h-12 rounded-xl bg-[rgba(245,158,11,0.1)] flex items-center justify-center mb-4">
                                <FiCalendar size={24} className="text-[#f59e0b]" />
                            </div>
                            <p className="text-sm text-slate-500 dark:text-d-muted">Month Orders</p>
                            <p className="text-2xl font-bold text-slate-800 dark:text-d-heading mt-1">{stats.monthOrders}</p>
                        </div>
                    </div>
                </div>

                {/* Profile Details */}
                <div className="bg-white dark:bg-d-card rounded-2xl p-6 border border-slate-200 dark:border-d-border mb-6">
                    <h2 className="text-lg font-semibold text-slate-800 dark:text-d-heading mb-4">Profile Details</h2>

                    <div className="space-y-1">
                        <div className="flex items-center gap-4 py-4 border-b border-slate-200 dark:border-d-border">
                            <div className="w-10 h-10 rounded-xl bg-[rgba(91,156,246,0.1)] flex items-center justify-center">
                                <FiUser size={20} className="text-d-blue" />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 dark:text-d-muted">Employee ID</p>
                                <p className="font-medium text-slate-700 dark:text-d-text">{user?.employeeId || '-'}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 py-4 border-b border-slate-200 dark:border-d-border">
                            <div className="w-10 h-10 rounded-xl bg-[rgba(255,210,100,0.1)] flex items-center justify-center">
                                <FiBriefcase size={20} className="text-d-accent" />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 dark:text-d-muted">Business</p>
                                <p className="font-medium text-slate-700 dark:text-d-text">{business?.name || '-'}</p>
                            </div>
                        </div>

                        {user?.phone && (
                            <div className="flex items-center gap-4 py-4 border-b border-slate-200 dark:border-d-border">
                                <div className="w-10 h-10 rounded-xl bg-[rgba(52,232,161,0.1)] flex items-center justify-center">
                                    <FiPhone size={20} className="text-d-green" />
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-d-muted">Phone</p>
                                    <p className="font-medium text-slate-700 dark:text-d-text">{user.phone}</p>
                                </div>
                            </div>
                        )}

                        {user?.email && (
                            <div className="flex items-center gap-4 py-4">
                                <div className="w-10 h-10 rounded-xl bg-[rgba(245,158,11,0.1)] flex items-center justify-center">
                                    <FiMail size={20} className="text-[#f59e0b]" />
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-d-muted">Email</p>
                                    <p className="font-medium text-slate-700 dark:text-d-text">{user.email}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sign Out */}
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 py-4 bg-[rgba(255,107,107,0.1)] text-d-red rounded-xl font-semibold hover:bg-[rgba(255,107,107,0.15)] transition-colors border border-[rgba(255,107,107,0.2)]"
                >
                    <FiLogOut size={20} />
                    Sign Out
                </button>
            </div>
        </div>
    );
};

export default Profile;
