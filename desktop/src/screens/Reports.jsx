import React, { useState, useEffect } from 'react';
import { useBusiness } from '../context/BusinessContext';
import api from '../services/api';
import {
    FiTrendingUp,
    FiTrendingDown,
    FiDollarSign,
    FiShoppingCart,
    FiMinusCircle,
    FiPieChart,
    FiRefreshCw,
    FiCalendar,
    FiArrowUp,
    FiArrowDown,
} from 'react-icons/fi';
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
} from 'recharts';

const EXPENSE_COLORS = {
    rent: '#ef4444',
    utilities: '#f97316',
    supplies: '#eab308',
    wages: '#22c55e',
    maintenance: '#14b8a6',
    transport: '#06b6d4',
    marketing: '#3b82f6',
    insurance: '#6366f1',
    taxes: '#8b5cf6',
    equipment: '#a855f7',
    bank_fees: '#ec4899',
    other: '#64748b',
};

const Reports = () => {
    const { business } = useBusiness();
    const [loading, setLoading] = useState(true);
    const [timeFilter, setTimeFilter] = useState('month');
    const [data, setData] = useState({
        grossRevenue: 0,
        returns: 0,
        netRevenue: 0,
        cogs: 0,
        grossProfit: 0,
        operatingExpenses: 0,
        netProfit: 0,
        profitMargin: 0,
        expensesByCategory: [],
        receiptCount: 0,
        returnCount: 0,
        avgOrderValue: 0,
        previousPeriod: {
            netRevenue: 0,
            netProfit: 0,
        },
    });

    useEffect(() => {
        fetchReportData();
    }, [timeFilter]);

    const getDateRange = () => {
        const now = new Date();
        let startDate = new Date();
        let prevStartDate = new Date();
        let prevEndDate = new Date();

        switch (timeFilter) {
            case 'today':
                startDate.setHours(0, 0, 0, 0);
                prevStartDate.setDate(now.getDate() - 1);
                prevStartDate.setHours(0, 0, 0, 0);
                prevEndDate.setDate(now.getDate() - 1);
                prevEndDate.setHours(23, 59, 59, 999);
                break;
            case 'week':
                startDate.setDate(now.getDate() - 7);
                prevStartDate.setDate(now.getDate() - 14);
                prevEndDate.setDate(now.getDate() - 7);
                break;
            case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                prevStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                prevEndDate = new Date(now.getFullYear(), now.getMonth(), 0);
                break;
            case 'year':
                startDate = new Date(now.getFullYear(), 0, 1);
                prevStartDate = new Date(now.getFullYear() - 1, 0, 1);
                prevEndDate = new Date(now.getFullYear() - 1, 11, 31);
                break;
        }

        return { startDate, prevStartDate, prevEndDate, now };
    };

    const fetchReportData = async () => {
        setLoading(true);
        try {
            const { startDate, prevStartDate, prevEndDate, now } = getDateRange();

            // Fetch receipts
            const receiptsRes = await api.get('/receipt', { params: { limit: 10000 } });
            const allReceipts = Array.isArray(receiptsRes.data) ? receiptsRes.data : (receiptsRes.data?.receipts || []);

            // Current period receipts
            const periodReceipts = allReceipts.filter((r) => {
                const d = new Date(r.createdAt);
                return d >= startDate && d <= now;
            });

            // Previous period receipts
            const prevReceipts = allReceipts.filter((r) => {
                const d = new Date(r.createdAt);
                return d >= prevStartDate && d <= prevEndDate;
            });

            // Separate sales and refunds/returns
            const sales = periodReceipts.filter((r) =>
                !r.receiptType?.includes('refund') &&
                r.receiptType !== 'return'
            );
            const refunds = periodReceipts.filter((r) =>
                r.receiptType?.includes('refund') ||
                r.receiptType === 'return'
            );

            // Calculate revenue
            const grossRevenue = sales.reduce((sum, r) => sum + (r.totalBill || 0), 0);

            // Calculate returns from ALL sources:
            // 1. Standalone refund receipts
            let returns = refunds.reduce((sum, r) => sum + Math.abs(r.totalBill || 0), 0);
            // 2. Partial returns on sale receipts (HAS RETURNS - totalReturned field)
            returns += sales.reduce((sum, r) => sum + (r.totalReturned || 0), 0);

            const netRevenue = grossRevenue - returns;

            // Calculate COGS (Cost of Goods Sold)
            let cogs = 0;
            sales.forEach((receipt) => {
                (receipt.items || []).forEach((item) => {
                    const costPrice = item.costPrice || 0;
                    const quantity = item.quantity || item.qty || 1;
                    cogs += costPrice * quantity;
                });
            });

            const grossProfit = netRevenue - cogs;

            // Fetch expenses
            const expensesRes = await api.get('/expense', { params: { status: 'approved' } });
            const allExpenses = Array.isArray(expensesRes.data)
                ? expensesRes.data
                : expensesRes.data?.expenses || [];

            // Filter expenses by period
            const periodExpenses = allExpenses.filter((e) => {
                const d = new Date(e.date || e.createdAt);
                return d >= startDate && d <= now;
            });

            // Total operating expenses
            const operatingExpenses = periodExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

            // Net profit
            const netProfit = grossProfit - operatingExpenses;
            const profitMargin = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;

            // Expenses by category
            const expensesByCategory = Object.entries(
                periodExpenses.reduce((acc, e) => {
                    const cat = e.category || 'other';
                    acc[cat] = (acc[cat] || 0) + (e.amount || 0);
                    return acc;
                }, {})
            ).map(([category, amount]) => ({
                category,
                amount,
                label: category.charAt(0).toUpperCase() + category.slice(1).replace('_', ' '),
                color: EXPENSE_COLORS[category] || '#64748b',
            }));

            // Previous period calculations
            const prevSales = prevReceipts.filter((r) => !r.receiptType?.includes('refund'));
            const prevRefunds = prevReceipts.filter((r) => r.receiptType?.includes('refund'));
            const prevGrossRevenue = prevSales.reduce((sum, r) => sum + (r.totalBill || 0), 0);
            const prevReturns = prevRefunds.reduce((sum, r) => sum + Math.abs(r.totalBill || 0), 0);
            const prevNetRevenue = prevGrossRevenue - prevReturns;

            let prevCogs = 0;
            prevSales.forEach((receipt) => {
                (receipt.items || []).forEach((item) => {
                    prevCogs += (item.costPrice || 0) * (item.quantity || item.qty || 1);
                });
            });

            const prevExpenses = allExpenses.filter((e) => {
                const d = new Date(e.date || e.createdAt);
                return d >= prevStartDate && d <= prevEndDate;
            });
            const prevOpEx = prevExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
            const prevNetProfit = prevNetRevenue - prevCogs - prevOpEx;

            setData({
                grossRevenue,
                returns,
                netRevenue,
                cogs,
                grossProfit,
                operatingExpenses,
                netProfit,
                profitMargin,
                expensesByCategory,
                receiptCount: sales.length,
                returnCount: refunds.length,
                avgOrderValue: sales.length > 0 ? grossRevenue / sales.length : 0,
                previousPeriod: {
                    netRevenue: prevNetRevenue,
                    netProfit: prevNetProfit,
                },
            });
        } catch (error) {
            console.error('Error fetching report data:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount) => {
        return `Rs. ${(amount || 0).toLocaleString()}`;
    };

    const getGrowth = (current, previous) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / Math.abs(previous)) * 100;
    };

    const revenueGrowth = getGrowth(data.netRevenue, data.previousPeriod.netRevenue);
    const profitGrowth = getGrowth(data.netProfit, data.previousPeriod.netProfit);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full p-6 bg-slate-50 dark:bg-d-bg">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-500 dark:text-d-muted">Loading reports...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 animate-fadeIn bg-slate-50 dark:bg-d-bg min-h-full h-full overflow-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-d-heading">Reports & Insights</h1>
                    <p className="text-slate-500 dark:text-d-muted">Profit & Loss Statement</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchReportData}
                        className="flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-d-text hover:bg-slate-100 dark:hover:bg-d-glass-hover rounded-xl transition-colors"
                    >
                        <FiRefreshCw size={18} />
                        Refresh
                    </button>
                    <div className="flex items-center gap-2 bg-white dark:bg-d-card rounded-xl p-1 shadow-sm border border-slate-200 dark:border-d-border">
                        {['today', 'week', 'month', 'year'].map((filter) => (
                            <button
                                key={filter}
                                onClick={() => setTimeFilter(filter)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                                    timeFilter === filter
                                        ? 'bg-primary-500 text-white'
                                        : 'text-slate-600 dark:text-d-text hover:bg-slate-100 dark:hover:bg-d-glass-hover'
                                }`}
                            >
                                {filter === 'today' ? 'Today' : filter === 'week' ? 'Week' : filter === 'month' ? 'Month' : 'Year'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* P&L Summary Card */}
            <div className="bg-white dark:bg-d-card rounded-2xl shadow-sm border border-slate-100 dark:border-d-border p-6 mb-6">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-d-heading mb-4 flex items-center gap-2">
                    <FiPieChart className="text-primary-500" />
                    Profit & Loss Statement
                </h2>

                <div className="space-y-3">
                    {/* Revenue Section */}
                    <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-d-border">
                        <span className="text-slate-600 dark:text-d-text">Gross Revenue</span>
                        <span className="font-semibold text-slate-800 dark:text-d-heading">{formatCurrency(data.grossRevenue)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-d-border pl-4">
                        <span className="text-slate-500 dark:text-d-muted text-sm">Sales ({data.receiptCount} transactions)</span>
                        <span className="text-green-600 dark:text-d-green">{formatCurrency(data.grossRevenue)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-d-border text-red-500 dark:text-d-red">
                        <span className="flex items-center gap-2">
                            <FiMinusCircle size={16} />
                            Returns & Refunds ({data.returnCount})
                        </span>
                        <span>- {formatCurrency(data.returns)}</span>
                    </div>
                    <div className="flex justify-between items-center py-3 border-b-2 border-slate-200 dark:border-d-border bg-slate-50 dark:bg-d-elevated -mx-6 px-6">
                        <span className="font-semibold text-slate-700 dark:text-d-text">Net Revenue</span>
                        <div className="flex items-center gap-3">
                            <span className="font-bold text-lg text-slate-800 dark:text-d-heading">{formatCurrency(data.netRevenue)}</span>
                            <span className={`flex items-center text-sm ${revenueGrowth >= 0 ? 'text-green-500 dark:text-d-green' : 'text-red-500 dark:text-d-red'}`}>
                                {revenueGrowth >= 0 ? <FiArrowUp size={14} /> : <FiArrowDown size={14} />}
                                {Math.abs(revenueGrowth).toFixed(1)}%
                            </span>
                        </div>
                    </div>

                    {/* Cost Section */}
                    <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-d-border text-red-500 dark:text-d-red">
                        <span className="flex items-center gap-2">
                            <FiMinusCircle size={16} />
                            Cost of Goods Sold (COGS)
                        </span>
                        <span>- {formatCurrency(data.cogs)}</span>
                    </div>
                    <div className="flex justify-between items-center py-3 border-b border-slate-200 dark:border-d-border">
                        <span className="font-semibold text-slate-700 dark:text-d-text">Gross Profit</span>
                        <span className="font-bold text-slate-800 dark:text-d-heading">{formatCurrency(data.grossProfit)}</span>
                    </div>

                    {/* Operating Expenses */}
                    <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-d-border text-red-500 dark:text-d-red">
                        <span className="flex items-center gap-2">
                            <FiMinusCircle size={16} />
                            Operating Expenses
                        </span>
                        <span>- {formatCurrency(data.operatingExpenses)}</span>
                    </div>

                    {/* Net Profit */}
                    <div className={`flex justify-between items-center py-4 -mx-6 px-6 rounded-b-xl ${
                        data.netProfit >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'
                    }`}>
                        <span className="font-bold text-lg text-slate-800 dark:text-d-heading">Net Profit</span>
                        <div className="flex items-center gap-3">
                            <span className={`font-bold text-2xl ${
                                data.netProfit >= 0 ? 'text-green-600 dark:text-d-green' : 'text-red-600 dark:text-d-red'
                            }`}>
                                {formatCurrency(data.netProfit)}
                            </span>
                            <span className={`flex items-center text-sm ${profitGrowth >= 0 ? 'text-green-500 dark:text-d-green' : 'text-red-500 dark:text-d-red'}`}>
                                {profitGrowth >= 0 ? <FiArrowUp size={14} /> : <FiArrowDown size={14} />}
                                {Math.abs(profitGrowth).toFixed(1)}%
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white dark:bg-d-card rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-d-border">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-slate-500 dark:text-d-muted text-sm">Profit Margin</p>
                            <p className={`text-2xl font-bold ${data.profitMargin >= 0 ? 'text-green-600 dark:text-d-green' : 'text-red-600 dark:text-d-red'}`}>
                                {data.profitMargin.toFixed(1)}%
                            </p>
                        </div>
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                            data.profitMargin >= 0 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'
                        }`}>
                            {data.profitMargin >= 0 ? (
                                <FiTrendingUp size={24} className="text-green-600 dark:text-d-green" />
                            ) : (
                                <FiTrendingDown size={24} className="text-red-600 dark:text-d-red" />
                            )}
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-d-card rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-d-border">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-slate-500 dark:text-d-muted text-sm">Avg Order Value</p>
                            <p className="text-2xl font-bold text-slate-800 dark:text-d-heading">{formatCurrency(data.avgOrderValue)}</p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <FiShoppingCart size={24} className="text-blue-600 dark:text-d-blue" />
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-d-card rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-d-border">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-slate-500 dark:text-d-muted text-sm">Total Transactions</p>
                            <p className="text-2xl font-bold text-slate-800 dark:text-d-heading">{data.receiptCount}</p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                            <FiDollarSign size={24} className="text-purple-600 dark:text-purple-400" />
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-d-card rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-d-border">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-slate-500 dark:text-d-muted text-sm">Returns</p>
                            <p className="text-2xl font-bold text-red-600 dark:text-d-red">{data.returnCount}</p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                            <FiMinusCircle size={24} className="text-red-600 dark:text-d-red" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Expense Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pie Chart */}
                <div className="bg-white dark:bg-d-card rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-d-border">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-d-heading mb-4">Expense Breakdown</h3>
                    {data.expensesByCategory.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={data.expensesByCategory}
                                    dataKey="amount"
                                    nameKey="label"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={100}
                                    label={({ label, percent }) => `${label} (${(percent * 100).toFixed(0)}%)`}
                                >
                                    {data.expensesByCategory.map((entry, index) => (
                                        <Cell key={index} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value) => formatCurrency(value)} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-[300px] flex items-center justify-center text-slate-400 dark:text-d-muted">
                            No expenses recorded
                        </div>
                    )}
                </div>

                {/* Bar Chart */}
                <div className="bg-white dark:bg-d-card rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-d-border">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-d-heading mb-4">Expenses by Category</h3>
                    {data.expensesByCategory.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={data.expensesByCategory} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" className="dark:stroke-slate-600" />
                                <XAxis type="number" tickFormatter={(v) => `Rs.${(v/1000).toFixed(0)}k`} stroke="#94a3b8" />
                                <YAxis type="category" dataKey="label" width={100} stroke="#94a3b8" />
                                <Tooltip formatter={(value) => formatCurrency(value)} />
                                <Bar dataKey="amount" radius={[0, 8, 8, 0]}>
                                    {data.expensesByCategory.map((entry, index) => (
                                        <Cell key={index} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-[300px] flex items-center justify-center text-slate-400 dark:text-d-muted">
                            No expenses recorded
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Reports;
