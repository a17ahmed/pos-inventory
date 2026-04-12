import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useBusiness } from '../context/BusinessContext';
import { getAllReceipts, getReceiptStats, getReceiptsPaginated } from '../services/api/receipts';
import {
    FiSearch,
    FiFileText,
    FiCalendar,
    FiDownload,
    FiPrinter,
    FiEye,
    FiX,
    FiDollarSign,
    FiShoppingCart,
    FiTrendingUp,
    FiRefreshCw,
    FiLoader,
} from 'react-icons/fi';

const Receipts = () => {
    const { business } = useBusiness();
    const [receipts, setReceipts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFilter, setDateFilter] = useState('all');
    const [showDetail, setShowDetail] = useState(null);

    // Pagination state
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [totalReceipts, setTotalReceipts] = useState(0);
    const scrollContainerRef = useRef(null);

    // Stats from API
    const [stats, setStats] = useState({
        todaySales: 0,
        todayOrders: 0,
        totalSales: 0
    });

    useEffect(() => {
        fetchReceipts(1, true);
        fetchStats();
    }, []);

    // When date filter changes, fetch appropriately
    useEffect(() => {
        if (dateFilter !== 'all') {
            // Load all receipts when filtering by date
            fetchAllReceipts();
        } else {
            // Reset to paginated loading when switching to "All"
            setPage(1);
            setHasMore(true);
            fetchReceipts(1, true);
        }
    }, [dateFilter]);

    const fetchAllReceipts = async () => {
        setLoading(true);
        try {
            const res = await getAllReceipts();
            const data = res.data?.receipts || res.data || [];
            setReceipts(Array.isArray(data) ? data : []);
            setHasMore(false);
            setTotalReceipts(data.length);
        } catch (error) {
            console.error('Error fetching all receipts:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const res = await getReceiptStats();
            setStats({
                todaySales: res.data?.todaySales ?? 0,
                todayOrders: res.data?.todayOrders ?? 0,
                totalSales: res.data?.monthOrders ?? 0  // Show month's order count
            });
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    const fetchReceipts = async (pageNum = 1, reset = false) => {
        if (reset) {
            setLoading(true);
        } else {
            setLoadingMore(true);
        }

        try {
            const res = await getReceiptsPaginated(pageNum);

            // Handle both old (array) and new (object with receipts) response formats
            const data = res.data?.receipts || res.data || [];
            const pagination = res.data?.pagination;

            if (reset) {
                setReceipts(Array.isArray(data) ? data : []);
            } else {
                setReceipts(prev => [...prev, ...(Array.isArray(data) ? data : [])]);
            }

            if (pagination) {
                setHasMore(pagination.hasMore);
                setTotalReceipts(pagination.total);
                setPage(pagination.page);
            } else {
                // Fallback for old API format
                setHasMore(data.length === 30);
                setTotalReceipts(data.length);
            }
        } catch (error) {
            console.error('Error fetching receipts:', error);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    // Use ref to track current page for scroll handler
    const pageRef = useRef(page);
    const loadingMoreRef = useRef(loadingMore);
    const hasMoreRef = useRef(hasMore);

    // Keep refs in sync with state
    useEffect(() => {
        pageRef.current = page;
    }, [page]);

    useEffect(() => {
        loadingMoreRef.current = loadingMore;
    }, [loadingMore]);

    useEffect(() => {
        hasMoreRef.current = hasMore;
    }, [hasMore]);

    // Handle scroll for infinite loading (only when viewing "All" receipts)
    const handleScroll = useCallback(() => {
        // Don't auto-load when filtering by date (client-side filtering)
        if (dateFilter !== 'all') return;
        if (loadingMoreRef.current || !hasMoreRef.current) return;

        const container = scrollContainerRef.current;
        if (!container) return;

        const { scrollTop, scrollHeight, clientHeight } = container;
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

        // Load more when user scrolls to within 300px of bottom
        if (distanceFromBottom < 300) {
            fetchReceipts(pageRef.current + 1, false);
        }
    }, [dateFilter]);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (container) {
            // Use passive listener for better scroll performance
            container.addEventListener('scroll', handleScroll, { passive: true });
            return () => container.removeEventListener('scroll', handleScroll);
        }
    }, [handleScroll]);

    const handleRefresh = () => {
        setPage(1);
        setHasMore(true);
        fetchReceipts(1, true);
        fetchStats();
    };

    const filteredReceipts = receipts.filter((r) => {
        const matchesSearch =
            r.receiptNumber?.toString().includes(searchQuery) ||
            r.billNumber?.toString().includes(searchQuery) ||
            r.customerName?.toLowerCase().includes(searchQuery.toLowerCase());

        let matchesDate = true;
        if (dateFilter !== 'all') {
            const receiptDate = new Date(r.createdAt);
            const now = new Date();

            switch (dateFilter) {
                case 'today':
                    matchesDate = receiptDate.toDateString() === now.toDateString();
                    break;
                case 'week':
                    // Use midnight 7 days ago (consistent with backend)
                    const weekAgo = new Date(now);
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    weekAgo.setHours(0, 0, 0, 0);
                    matchesDate = receiptDate >= weekAgo;
                    break;
                case 'month':
                    matchesDate =
                        receiptDate.getMonth() === now.getMonth() &&
                        receiptDate.getFullYear() === now.getFullYear();
                    break;
            }
        }

        return matchesSearch && matchesDate;
    });

    const formatCurrency = (amount) => {
        return `Rs. ${(amount || 0).toLocaleString()}`;
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleString('en-PK', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getReceiptType = (receipt) => {
        if (receipt.receiptType?.includes('_refund')) {
            return { label: 'Refund', color: 'bg-[rgba(255,107,107,0.15)] text-d-red', hasReturns: false };
        }
        // Check if this sale has returns
        const hasReturns = (receipt.totalReturned > 0) || (receipt.returns && receipt.returns.length > 0);
        return {
            label: 'Sale',
            color: 'bg-[rgba(52,232,161,0.15)] text-d-green',
            hasReturns
        };
    };


    if (loading) {
        return (
            <div className="flex items-center justify-center h-full bg-slate-50 dark:bg-d-bg">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-d-accent border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-500 dark:text-d-muted">Loading receipts...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full bg-slate-50 dark:bg-d-bg overflow-hidden flex flex-col">
            <div className="p-6 animate-fade-slide-up flex flex-col flex-1 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-d-heading">Sales Report</h1>
                        <p className="text-slate-500 dark:text-d-muted">
                            {totalReceipts > 0 ? `${totalReceipts} total receipts` : `${receipts.length} receipts`}
                        </p>
                    </div>
                    <button
                        onClick={handleRefresh}
                        className="flex items-center gap-2 px-4 py-2.5 text-slate-500 dark:text-d-muted hover:text-slate-700 dark:hover:text-d-text hover:bg-slate-100 dark:hover:bg-d-glass rounded-xl transition-all"
                    >
                        <FiRefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-2xl p-5">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-[rgba(52,232,161,0.1)] rounded-xl flex items-center justify-center">
                                <FiDollarSign className="text-d-green" size={20} />
                            </div>
                            <span className="text-slate-500 dark:text-d-muted text-sm">Today's Sales</span>
                        </div>
                        <p className="text-2xl font-bold text-d-green font-display">{formatCurrency(stats.todaySales)}</p>
                    </div>
                    <div className="bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-2xl p-5">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-[rgba(255,210,100,0.1)] rounded-xl flex items-center justify-center">
                                <FiShoppingCart className="text-d-accent" size={20} />
                            </div>
                            <span className="text-slate-500 dark:text-d-muted text-sm">Today's Orders</span>
                        </div>
                        <p className="text-2xl font-bold text-slate-800 dark:text-d-heading">{stats.todayOrders}</p>
                    </div>
                    <div className="bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-2xl p-5">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-[rgba(91,156,246,0.1)] rounded-xl flex items-center justify-center">
                                <FiTrendingUp className="text-d-blue" size={20} />
                            </div>
                            <span className="text-slate-500 dark:text-d-muted text-sm">Total Sales</span>
                        </div>
                        <p className="text-2xl font-bold text-slate-800 dark:text-d-heading">{stats.totalSales || totalReceipts}</p>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-4 mb-6">
                    <div className="relative flex-1 max-w-md">
                        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-d-faint" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by receipt # or customer..."
                            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-xl text-slate-700 dark:text-d-text placeholder-d-faint focus:outline-none focus:border-d-border-hover transition-colors"
                        />
                    </div>

                    <div className="flex items-center gap-1 bg-white dark:bg-d-card rounded-xl p-1 border border-slate-200 dark:border-d-border">
                        {[
                            { value: 'all', label: 'All' },
                            { value: 'today', label: 'Today' },
                            { value: 'week', label: 'Week' },
                            { value: 'month', label: 'Month' },
                        ].map((filter) => (
                            <button
                                key={filter.value}
                                onClick={() => setDateFilter(filter.value)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                    dateFilter === filter.value
                                        ? 'bg-d-accent text-d-card'
                                        : 'text-slate-500 dark:text-d-muted hover:text-slate-700 dark:text-d-text'
                                }`}
                            >
                                {filter.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Receipts Table */}
                <div
                    ref={scrollContainerRef}
                    className="bg-white dark:bg-d-card rounded-2xl border border-slate-200 dark:border-d-border overflow-hidden max-h-[calc(100vh-350px)] overflow-y-auto"
                >
                    <table className="w-full">
                        <thead className="bg-slate-50 dark:bg-d-elevated sticky top-0 z-10 shadow-[0_2px_8px_rgba(0,0,0,0.15)]">
                            <tr>
                                <th className="text-left py-4 px-6 font-semibold text-slate-600 dark:text-d-muted text-sm bg-slate-50 dark:bg-d-elevated">Receipt #</th>
                                <th className="text-left py-4 px-6 font-semibold text-slate-600 dark:text-d-muted text-sm bg-slate-50 dark:bg-d-elevated">Customer</th>
                                <th className="text-left py-4 px-6 font-semibold text-slate-600 dark:text-d-muted text-sm bg-slate-50 dark:bg-d-elevated">Items</th>
                                <th className="text-left py-4 px-6 font-semibold text-slate-600 dark:text-d-muted text-sm bg-slate-50 dark:bg-d-elevated">Total</th>
                                <th className="text-left py-4 px-6 font-semibold text-slate-600 dark:text-d-muted text-sm bg-slate-50 dark:bg-d-elevated">Type</th>
                                <th className="text-left py-4 px-6 font-semibold text-slate-600 dark:text-d-muted text-sm bg-slate-50 dark:bg-d-elevated">Date</th>
                                <th className="text-right py-4 px-6 font-semibold text-slate-600 dark:text-d-muted text-sm bg-slate-50 dark:bg-d-elevated">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredReceipts.map((receipt) => {
                                const type = getReceiptType(receipt);
                                return (
                                    <tr
                                        key={receipt._id}
                                        className={`border-t border-slate-200 dark:border-d-border transition-colors ${
                                            type.label === 'Refund'
                                                ? 'bg-red-100 dark:bg-[#3d2020] hover:bg-red-200 dark:hover:bg-[#4a2525]'
                                                : type.hasReturns
                                                    ? 'bg-amber-100 dark:bg-[#3d3520] hover:bg-amber-200 dark:hover:bg-[#4a4025]'
                                                    : 'hover:bg-slate-50 dark:hover:bg-[rgba(255,255,255,0.02)]'
                                        }`}
                                    >
                                        <td className="py-4 px-6 font-medium text-slate-800 dark:text-d-heading">
                                            #{receipt.receiptNumber || receipt.billNumber || '-'}
                                        </td>
                                        <td className="py-4 px-6 text-slate-700 dark:text-d-text">
                                            {receipt.customerName || 'Walk-in'}
                                        </td>
                                        <td className="py-4 px-6 text-slate-500 dark:text-d-muted">
                                            {receipt.items?.length || 0} items
                                        </td>
                                        <td className="py-4 px-6 font-semibold font-display">
                                            <span className={receipt.totalBill < 0 ? 'text-d-red' : 'text-d-green'}>
                                                {formatCurrency(Math.abs(receipt.totalBill))}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-2">
                                                <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${type.color}`}>
                                                    {type.label}
                                                </span>
                                                {type.hasReturns && (
                                                    <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-[rgba(255,107,107,0.15)] text-d-red">
                                                        HAS RETURNS
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 text-slate-500 dark:text-d-muted text-sm">
                                            {formatDate(receipt.createdAt)}
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => setShowDetail(receipt)}
                                                    className="p-2 text-slate-500 dark:text-d-muted hover:text-d-accent hover:bg-[rgba(255,210,100,0.1)] rounded-lg transition-colors"
                                                    title="View Details"
                                                >
                                                    <FiEye size={16} />
                                                </button>
                                                <button
                                                    className="p-2 text-slate-500 dark:text-d-muted hover:text-d-blue hover:bg-[rgba(91,156,246,0.1)] rounded-lg transition-colors"
                                                    title="Print"
                                                >
                                                    <FiPrinter size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {filteredReceipts.length === 0 && !loading && (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-d-faint">
                            <FiFileText size={48} />
                            <p className="mt-4 text-slate-500 dark:text-d-muted">No receipts found</p>
                        </div>
                    )}

                    {/* Loading More Indicator */}
                    {loadingMore && (
                        <div className="flex items-center justify-center py-6 gap-3">
                            <FiLoader className="animate-spin text-d-accent" size={20} />
                            <span className="text-slate-500 dark:text-d-muted">Loading more receipts...</span>
                        </div>
                    )}

                    {/* Load More Button - only show when viewing "All" receipts */}
                    {hasMore && !loading && receipts.length > 0 && dateFilter === 'all' && (
                        <div className="flex justify-center py-6">
                            <button
                                onClick={() => fetchReceipts(page + 1, false)}
                                disabled={loadingMore}
                                className="px-6 py-3 bg-gradient-to-r from-d-accent to-d-accent-s text-d-card rounded-xl font-semibold hover:shadow-[0_4px_20px_rgba(255,210,100,0.4)] transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                {loadingMore ? (
                                    <>
                                        <FiLoader className="animate-spin" size={16} />
                                        Loading...
                                    </>
                                ) : (
                                    <>
                                        Load More ({receipts.length} of {totalReceipts})
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {/* End of List Indicator */}
                    {!hasMore && receipts.length > 0 && !loading && dateFilter === 'all' && (
                        <div className="text-center py-6 text-slate-400 dark:text-d-faint text-sm">
                            You've reached the end ({totalReceipts} receipts)
                        </div>
                    )}

                    {/* Filtered results count */}
                    {dateFilter !== 'all' && !loading && (
                        <div className="text-center py-6 text-slate-400 dark:text-d-faint text-sm">
                            {filteredReceipts.length > 0
                                ? `${filteredReceipts.length} ${dateFilter === 'today' ? "today's" : dateFilter === 'week' ? "this week's" : "this month's"} receipts`
                                : `No receipts ${dateFilter === 'today' ? "today" : dateFilter === 'week' ? "this week" : "this month"}`
                            }
                        </div>
                    )}
                </div>
            </div>

            {/* Receipt Detail Modal */}
            {showDetail && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-2xl w-full max-w-lg animate-pop-in max-h-[90vh] overflow-auto">
                        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-d-border sticky top-0 bg-white dark:bg-d-card">
                            <h3 className="text-xl font-semibold text-slate-800 dark:text-d-heading">
                                Receipt #{showDetail.receiptNumber || showDetail.billNumber}
                            </h3>
                            <button
                                onClick={() => setShowDetail(null)}
                                className="p-2 hover:bg-d-glass rounded-lg transition-colors text-slate-500 dark:text-d-muted"
                            >
                                <FiX size={20} />
                            </button>
                        </div>

                        <div className="p-6">
                            {/* Receipt Info */}
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-d-muted">Customer</p>
                                    <p className="font-medium text-slate-700 dark:text-d-text">
                                        {showDetail.customerName || 'Walk-in Customer'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-d-muted">Date</p>
                                    <p className="font-medium text-slate-700 dark:text-d-text">{formatDate(showDetail.createdAt)}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-d-muted">Payment Method</p>
                                    <p className="font-medium text-slate-700 dark:text-d-text capitalize">
                                        {showDetail.paymentMethod || 'Cash'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-d-muted">Cashier</p>
                                    <p className="font-medium text-slate-700 dark:text-d-text">{showDetail.cashierName || '-'}</p>
                                </div>
                            </div>

                            {/* Items */}
                            <div className="border-t border-slate-200 dark:border-d-border pt-4">
                                <h4 className="font-medium text-slate-800 dark:text-d-heading mb-3">Items</h4>
                                <div className="space-y-2">
                                    {showDetail.items?.map((item, index) => (
                                        <div
                                            key={index}
                                            className="flex items-center justify-between py-3 border-b border-[rgba(255,255,255,0.05)] last:border-0"
                                        >
                                            <div>
                                                <p className="font-medium text-slate-700 dark:text-d-text">{item.name}</p>
                                                <p className="text-sm text-slate-500 dark:text-d-muted">
                                                    {formatCurrency(item.price)} x {item.qty || item.quantity}
                                                </p>
                                            </div>
                                            <p className="font-semibold text-slate-700 dark:text-d-text font-display">
                                                {formatCurrency(item.price * (item.qty || item.quantity))}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Totals */}
                            <div className="border-t border-slate-200 dark:border-d-border pt-4 mt-4 space-y-2">
                                {showDetail.discount > 0 && (
                                    <>
                                        <div className="flex justify-between text-slate-500 dark:text-d-muted">
                                            <span>Subtotal</span>
                                            <span className="text-slate-700 dark:text-d-text">{formatCurrency(showDetail.subtotal)}</span>
                                        </div>
                                        <div className="flex justify-between text-d-red">
                                            <span>Discount ({showDetail.discount}%)</span>
                                            <span>
                                                -{formatCurrency((showDetail.subtotal * showDetail.discount) / 100)}
                                            </span>
                                        </div>
                                    </>
                                )}
                                <div className="flex justify-between text-xl font-bold pt-3 border-t border-slate-200 dark:border-d-border">
                                    <span className="text-slate-800 dark:text-d-heading">Total</span>
                                    <span className={`font-display ${showDetail.totalBill < 0 ? 'text-d-red' : 'text-d-green'}`}>
                                        {formatCurrency(Math.abs(showDetail.totalBill))}
                                    </span>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-6">
                                <button className="flex-1 py-3 border border-slate-200 dark:border-d-border rounded-xl font-medium text-slate-500 dark:text-d-muted hover:bg-d-glass transition-colors flex items-center justify-center gap-2">
                                    <FiPrinter size={18} />
                                    Print
                                </button>
                                <button className="flex-1 py-3 bg-gradient-to-r from-d-accent to-d-accent-s text-d-card rounded-xl font-semibold hover:shadow-[0_4px_20px_rgba(255,210,100,0.4)] transition-all flex items-center justify-center gap-2">
                                    <FiDownload size={18} />
                                    Download
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Receipts;
