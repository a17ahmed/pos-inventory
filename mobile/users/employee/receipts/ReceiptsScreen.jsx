import React, { useState, useCallback, useRef } from 'react';
import {
    StyleSheet,
    Text,
    View,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    Modal,
    ScrollView,
    StatusBar,
    TextInput,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBusiness } from '../../../context/BusinessContext';
import api from '../../../constants/api';
import { shadows } from '../../../constants/theme';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LIMIT = 30;

const DATE_FILTERS = [
    { value: 'today', label: 'Today' },
    { value: 'week',  label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'all',   label: 'All' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatCurrency = (amount, currency = 'Rs.') =>
    `${currency} ${(amount || 0).toLocaleString()}`;

const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleString('en-PK', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

const formatDateShort = (dateStr) => {
    const d = new Date(dateStr);
    const isToday = d.toDateString() === new Date().toDateString();
    if (isToday) return 'Today';
    return d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatTime = (dateStr) =>
    new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/**
 * Determine the display type metadata for a receipt.
 * Mirrors the desktop getReceiptType() logic exactly.
 */
const getReceiptType = (receipt) => {
    if (receipt.receiptType?.includes('_refund')) {
        return { label: 'Refund', isRefund: true, hasReturns: false };
    }
    const hasReturns =
        (receipt.totalReturned > 0) ||
        (receipt.returns && receipt.returns.length > 0);
    return { label: 'Sale', isRefund: false, hasReturns };
};

/**
 * Client-side date filtering — mirrors desktop filteredReceipts logic exactly.
 */
const applyDateFilter = (receipts, dateFilter) => {
    if (dateFilter === 'all') return receipts;
    const now = new Date();

    return receipts.filter((r) => {
        const d = new Date(r.createdAt);
        switch (dateFilter) {
            case 'today':
                return d.toDateString() === now.toDateString();
            case 'week': {
                const weekAgo = new Date(now);
                weekAgo.setDate(weekAgo.getDate() - 7);
                weekAgo.setHours(0, 0, 0, 0);
                return d >= weekAgo;
            }
            case 'month':
                return (
                    d.getMonth() === now.getMonth() &&
                    d.getFullYear() === now.getFullYear()
                );
            default:
                return true;
        }
    });
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * A single stat card used in the top summary row.
 */
const StatCard = ({ icon, iconColor, iconBg, label, value }) => (
    <View style={[styles.statCard, shadows.sm]}>
        <View style={[styles.statIconWrap, { backgroundColor: iconBg }]}>
            <Ionicons name={icon} size={22} color={iconColor} />
        </View>
        <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
            {value}
        </Text>
        <Text style={styles.statLabel}>{label}</Text>
    </View>
);

/**
 * A filter chip pill button.
 */
const FilterChip = ({ label, value, active, primaryColor, onPress }) => (
    <TouchableOpacity
        style={[
            styles.filterChip,
            active && { backgroundColor: primaryColor, borderColor: primaryColor },
        ]}
        onPress={() => onPress(value)}
        activeOpacity={0.7}
    >
        <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
            {label}
        </Text>
    </TouchableOpacity>
);

/**
 * Individual receipt row card rendered in the FlatList.
 */
const ReceiptCard = ({ receipt, currency, onPress }) => {
    const { label, isRefund, hasReturns } = getReceiptType(receipt);

    return (
        <TouchableOpacity
            style={[
                styles.receiptCard,
                shadows.sm,
                isRefund && styles.receiptCardRefund,
                hasReturns && !isRefund && styles.receiptCardHasReturns,
            ]}
            onPress={() => onPress(receipt)}
            activeOpacity={0.7}
        >
            {/* Left icon */}
            <View
                style={[
                    styles.receiptIconBg,
                    isRefund && styles.receiptIconBgRefund,
                    hasReturns && !isRefund && styles.receiptIconBgHasReturns,
                ]}
            >
                <Ionicons
                    name={isRefund ? 'arrow-undo-outline' : 'receipt-outline'}
                    size={22}
                    color={isRefund ? '#ef4444' : hasReturns ? '#d97706' : '#8b5cf6'}
                />
            </View>

            {/* Middle info */}
            <View style={styles.receiptInfo}>
                <View style={styles.receiptTopRow}>
                    <Text style={[styles.receiptNumber, isRefund && { color: '#ef4444' }]}>
                        #{receipt.receiptNumber || receipt.billNumber || '-'}
                    </Text>
                    {/* Type badge */}
                    <View
                        style={[
                            styles.typeBadge,
                            isRefund ? styles.typeBadgeRefund : styles.typeBadgeSale,
                        ]}
                    >
                        <Text
                            style={[
                                styles.typeBadgeText,
                                isRefund ? styles.typeBadgeTextRefund : styles.typeBadgeTextSale,
                            ]}
                        >
                            {label}
                        </Text>
                    </View>
                    {hasReturns && (
                        <View style={styles.typeBadgeReturns}>
                            <Text style={styles.typeBadgeTextReturns}>HAS RETURNS</Text>
                        </View>
                    )}
                </View>
                <Text style={styles.receiptCustomer} numberOfLines={1}>
                    {receipt.customerName || 'Walk-in Customer'}
                </Text>
                <Text style={styles.receiptMeta}>
                    {receipt.items?.length || 0} items •{' '}
                    {formatDateShort(receipt.createdAt)} at {formatTime(receipt.createdAt)}
                </Text>
            </View>

            {/* Right amount */}
            <View style={styles.receiptRight}>
                <Text
                    style={[
                        styles.receiptAmount,
                        { color: isRefund ? '#ef4444' : '#10b981' },
                    ]}
                >
                    {isRefund ? '-' : ''}
                    {formatCurrency(Math.abs(receipt.totalBill || 0), currency)}
                </Text>
                <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
            </View>
        </TouchableOpacity>
    );
};

/**
 * Receipt detail bottom-sheet modal.
 * Shows all receipt fields matching the desktop detail panel.
 */
const ReceiptDetailModal = ({ receipt, currency, visible, onClose }) => {
    if (!receipt) return null;

    const { label, isRefund } = getReceiptType(receipt);

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={styles.modalSheet}>
                    {/* Handle bar */}
                    <View style={styles.modalHandle} />

                    {/* Modal header */}
                    <View style={styles.modalHeader}>
                        <View>
                            <Text style={styles.modalTitle}>
                                Receipt #{receipt.receiptNumber || receipt.billNumber}
                            </Text>
                            <Text style={styles.modalSubtitle}>
                                {formatDate(receipt.createdAt)}
                            </Text>
                        </View>
                        <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
                            <Ionicons name="close" size={22} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        style={styles.modalBody}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 40 }}
                    >
                        {/* Type banner */}
                        {isRefund && (
                            <View style={styles.refundBanner}>
                                <Ionicons name="arrow-undo-circle" size={20} color="#ef4444" />
                                <Text style={styles.refundBannerText}>
                                    This is a refund/return receipt
                                </Text>
                            </View>
                        )}

                        {/* Info grid */}
                        <View style={styles.infoGrid}>
                            <View style={styles.infoGridItem}>
                                <Text style={styles.infoLabel}>Customer</Text>
                                <Text style={styles.infoValue}>
                                    {receipt.customerName || 'Walk-in Customer'}
                                </Text>
                            </View>
                            <View style={styles.infoGridItem}>
                                <Text style={styles.infoLabel}>Type</Text>
                                <Text
                                    style={[
                                        styles.infoValue,
                                        { color: isRefund ? '#ef4444' : '#10b981' },
                                    ]}
                                >
                                    {label}
                                </Text>
                            </View>
                            <View style={styles.infoGridItem}>
                                <Text style={styles.infoLabel}>Payment Method</Text>
                                <Text style={[styles.infoValue, styles.capitalize]}>
                                    {receipt.paymentMethod || 'Cash'}
                                </Text>
                            </View>
                            <View style={styles.infoGridItem}>
                                <Text style={styles.infoLabel}>Cashier</Text>
                                <Text style={styles.infoValue}>
                                    {receipt.cashierName || receipt.waiterName || '-'}
                                </Text>
                            </View>
                        </View>

                        {/* Items section */}
                        <View style={styles.sectionDivider} />
                        <Text style={styles.sectionTitle}>
                            Items ({receipt.items?.length || 0})
                        </Text>
                        {receipt.items?.map((item, index) => (
                            <View key={index} style={styles.itemRow}>
                                <View style={styles.itemInfo}>
                                    <Text style={styles.itemName}>{item.name}</Text>
                                    <Text style={styles.itemQtyPrice}>
                                        {formatCurrency(item.price, currency)} x{' '}
                                        {item.qty || item.quantity || 1}
                                    </Text>
                                </View>
                                <Text
                                    style={[
                                        styles.itemTotal,
                                        isRefund && { color: '#ef4444' },
                                    ]}
                                >
                                    {isRefund ? '-' : ''}
                                    {formatCurrency(
                                        item.price * (item.qty || item.quantity || 1),
                                        currency
                                    )}
                                </Text>
                            </View>
                        ))}

                        {/* Totals section */}
                        <View style={styles.sectionDivider} />
                        <View style={styles.totalsSection}>
                            {/* Subtotal — shown when discount is applied or always */}
                            {receipt.discount > 0 && (
                                <>
                                    <View style={styles.totalRow}>
                                        <Text style={styles.totalRowLabel}>Subtotal</Text>
                                        <Text style={styles.totalRowValue}>
                                            {formatCurrency(receipt.subtotal, currency)}
                                        </Text>
                                    </View>
                                    <View style={styles.totalRow}>
                                        <Text style={[styles.totalRowLabel, { color: '#ef4444' }]}>
                                            Discount ({receipt.discount}%)
                                        </Text>
                                        <Text style={[styles.totalRowValue, { color: '#ef4444' }]}>
                                            -{formatCurrency(
                                                (receipt.subtotal * receipt.discount) / 100,
                                                currency
                                            )}
                                        </Text>
                                    </View>
                                </>
                            )}

                            {/* Tax row */}
                            {(receipt.totalGST > 0) && (
                                <View style={styles.totalRow}>
                                    <Text style={styles.totalRowLabel}>Tax (GST)</Text>
                                    <Text style={styles.totalRowValue}>
                                        {formatCurrency(receipt.totalGST, currency)}
                                    </Text>
                                </View>
                            )}

                            {/* Grand total */}
                            <View style={[styles.totalRow, styles.grandTotalRow]}>
                                <Text style={styles.grandTotalLabel}>Total</Text>
                                <Text
                                    style={[
                                        styles.grandTotalValue,
                                        { color: isRefund ? '#ef4444' : '#10b981' },
                                    ]}
                                >
                                    {isRefund ? '-' : ''}
                                    {formatCurrency(Math.abs(receipt.totalBill || 0), currency)}
                                </Text>
                            </View>

                            {/* Cash payment info */}
                            {!isRefund && receipt.cashGiven > 0 && (
                                <>
                                    <View style={styles.totalRow}>
                                        <Text style={styles.totalRowLabel}>Cash Given</Text>
                                        <Text style={styles.totalRowValue}>
                                            {formatCurrency(receipt.cashGiven, currency)}
                                        </Text>
                                    </View>
                                    <View style={styles.totalRow}>
                                        <Text style={styles.totalRowLabel}>Change</Text>
                                        <Text style={styles.totalRowValue}>
                                            {formatCurrency(
                                                (receipt.cashGiven || 0) - Math.abs(receipt.totalBill || 0),
                                                currency
                                            )}
                                        </Text>
                                    </View>
                                </>
                            )}
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

const ReceiptsScreen = ({ navigation }) => {
    const insets = useSafeAreaInsets();
    const { config, businessData } = useBusiness();

    // Derive theme colors from business config with sensible fallback
    const primaryColor = config?.colors?.primary || '#8b5cf6';
    const secondaryColor = config?.colors?.secondary || '#a78bfa';
    const currency = businessData?.currency || 'Rs.';

    // ---------------------------------------------------------------------------
    // State
    // ---------------------------------------------------------------------------

    // Receipts data
    const [receipts, setReceipts]           = useState([]);
    const [loading, setLoading]             = useState(true);
    const [loadingMore, setLoadingMore]     = useState(false);
    const [refreshing, setRefreshing]       = useState(false);
    const [hasMore, setHasMore]             = useState(true);
    const [totalReceipts, setTotalReceipts] = useState(0);

    // Stats (always today's — same as desktop)
    const [stats, setStats] = useState({ todaySales: 0, todayOrders: 0 });

    // UI state
    const [dateFilter, setDateFilter]     = useState('today');
    const [searchQuery, setSearchQuery]   = useState('');
    const [selectedReceipt, setSelectedReceipt] = useState(null);
    const [showDetail, setShowDetail]     = useState(false);

    // Pagination ref — avoids stale closure in onEndReached
    const pageRef        = useRef(1);
    const loadingMoreRef = useRef(false);
    const hasMoreRef     = useRef(true);

    // ---------------------------------------------------------------------------
    // Data fetching
    // ---------------------------------------------------------------------------

    /**
     * Load a single paginated page. When reset=true, replaces state; otherwise
     * appends (infinite scroll). Only used in 'all' filter mode.
     */
    const fetchReceipts = useCallback(async (pageNum = 1, reset = false) => {
        if (reset) {
            setLoading(true);
        } else {
            if (loadingMoreRef.current || !hasMoreRef.current) return;
            setLoadingMore(true);
            loadingMoreRef.current = true;
        }

        try {
            const res = await api.get(`/receipt?page=${pageNum}&limit=${LIMIT}`);
            const data = res.data?.receipts || res.data || [];
            const pagination = res.data?.pagination;

            if (reset) {
                setReceipts(Array.isArray(data) ? data : []);
            } else {
                setReceipts((prev) => [
                    ...prev,
                    ...(Array.isArray(data) ? data : []),
                ]);
            }

            if (pagination) {
                setHasMore(pagination.hasMore);
                hasMoreRef.current = pagination.hasMore;
                setTotalReceipts(pagination.total);
                pageRef.current = pagination.page;
            } else {
                // Fallback for old API format
                const more = data.length === LIMIT;
                setHasMore(more);
                hasMoreRef.current = more;
                setTotalReceipts((prev) => (reset ? data.length : prev + data.length));
                pageRef.current = pageNum;
            }
        } catch (error) {
            console.error('ReceiptsScreen: Error fetching receipts:', error);
        } finally {
            setLoading(false);
            setLoadingMore(false);
            loadingMoreRef.current = false;
        }
    }, []);

    /**
     * Fetch ALL receipts without pagination — used for date-filtered views so
     * client-side date filtering is accurate across the full dataset.
     * Mirrors desktop fetchAllReceipts() exactly.
     */
    const fetchAllReceipts = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/receipt?all=true');
            const data = res.data?.receipts || res.data || [];
            setReceipts(Array.isArray(data) ? data : []);
            setHasMore(false);
            hasMoreRef.current = false;
            setTotalReceipts(data.length);
        } catch (error) {
            console.error('ReceiptsScreen: Error fetching all receipts:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    /** Always fetch today's stats regardless of active date filter. */
    const fetchStats = useCallback(async () => {
        try {
            const res = await api.get('/receipt/stats?filter=today');
            setStats({
                todaySales:  res.data?.todaySales  ?? res.data?.grossRevenue ?? 0,
                todayOrders: res.data?.todayOrders ?? res.data?.totalOrders  ?? 0,
            });
        } catch (error) {
            console.error('ReceiptsScreen: Error fetching stats:', error);
        }
    }, []);

    /**
     * Full refresh — resets pagination and re-fetches both stats and receipts.
     */
    const refresh = useCallback(
        (silent = false) => {
            if (!silent) setRefreshing(true);
            pageRef.current    = 1;
            hasMoreRef.current = true;

            const receiptsPromise =
                dateFilter !== 'all' ? fetchAllReceipts() : fetchReceipts(1, true);

            Promise.all([receiptsPromise, fetchStats()]).finally(() => {
                if (!silent) setRefreshing(false);
            });
        },
        [dateFilter, fetchAllReceipts, fetchReceipts, fetchStats]
    );

    // ---------------------------------------------------------------------------
    // Focus effect — re-fetch whenever the tab gains focus
    // ---------------------------------------------------------------------------

    useFocusEffect(
        useCallback(() => {
            StatusBar.setBarStyle('light-content');
            refresh(true); // silent — no pull-to-refresh spinner
        // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [dateFilter])
    );

    // ---------------------------------------------------------------------------
    // Filter change handler
    // ---------------------------------------------------------------------------

    const handleFilterChange = useCallback(
        (value) => {
            setDateFilter(value);
            setSearchQuery('');
            pageRef.current    = 1;
            hasMoreRef.current = true;

            if (value !== 'all') {
                fetchAllReceipts();
            } else {
                setHasMore(true);
                fetchReceipts(1, true);
            }

            // Always refresh stats
            fetchStats();
        },
        [fetchAllReceipts, fetchReceipts, fetchStats]
    );

    // ---------------------------------------------------------------------------
    // Derived display data
    // ---------------------------------------------------------------------------

    const filteredReceipts = receipts.filter((r) => {
        const matchesSearch =
            r.receiptNumber?.toString().includes(searchQuery) ||
            r.billNumber?.toString().includes(searchQuery) ||
            r.customerName?.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesDate = applyDateFilter([r], dateFilter).length > 0;

        return matchesSearch && matchesDate;
    });

    // ---------------------------------------------------------------------------
    // FlatList helpers
    // ---------------------------------------------------------------------------

    const handleEndReached = useCallback(() => {
        if (dateFilter !== 'all') return; // Client-side filtering — no more pages
        if (loadingMoreRef.current || !hasMoreRef.current) return;
        fetchReceipts(pageRef.current + 1, false);
    }, [dateFilter, fetchReceipts]);

    const handleReceiptPress = useCallback((receipt) => {
        setSelectedReceipt(receipt);
        setShowDetail(true);
    }, []);

    const handleCloseDetail = useCallback(() => {
        setShowDetail(false);
        // Small delay before clearing selected so the closing animation is smooth
        setTimeout(() => setSelectedReceipt(null), 300);
    }, []);

    // Subtitle for header — mirrors desktop subtitles
    const headerSubtitle = (() => {
        switch (dateFilter) {
            case 'today': return "Today's transactions";
            case 'week':  return "This week's transactions";
            case 'month': return "This month's transactions";
            default:      return 'All transactions';
        }
    })();

    // Footer text for list — mirrors desktop "end of list" indicators
    const listFooterMessage = (() => {
        if (loadingMore) return null; // Spinner handles this
        if (dateFilter !== 'all') {
            if (filteredReceipts.length === 0) return null; // Empty state handles this
            const label = {
                today: "today's",
                week:  "this week's",
                month: "this month's",
            }[dateFilter];
            return `${filteredReceipts.length} ${label} receipts`;
        }
        if (!hasMore && receipts.length > 0) {
            return `You've reached the end (${totalReceipts} receipts)`;
        }
        return null;
    })();

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={primaryColor} />

            {/* ----------------------------------------------------------------
                Gradient header
            ---------------------------------------------------------------- */}
            <LinearGradient
                colors={[primaryColor, secondaryColor]}
                style={[styles.header, { paddingTop: insets.top + 12 }]}
            >
                <Text style={styles.headerTitle}>Receipts</Text>
                <Text style={styles.headerSubtitle}>{headerSubtitle}</Text>
            </LinearGradient>

            {/* ----------------------------------------------------------------
                Stats cards — always show TODAY's data
            ---------------------------------------------------------------- */}
            <View style={styles.statsRow}>
                <StatCard
                    icon="cash-outline"
                    iconColor="#10b981"
                    iconBg="rgba(16,185,129,0.12)"
                    label="Today's Sales"
                    value={formatCurrency(stats.todaySales, currency)}
                />
                <StatCard
                    icon="receipt-outline"
                    iconColor="#3b82f6"
                    iconBg="rgba(59,130,246,0.12)"
                    label="Transactions"
                    value={stats.todayOrders.toString()}
                />
            </View>

            {/* ----------------------------------------------------------------
                Filter chips
            ---------------------------------------------------------------- */}
            <View style={styles.filterRow}>
                {DATE_FILTERS.map((f) => (
                    <FilterChip
                        key={f.value}
                        label={f.label}
                        value={f.value}
                        active={dateFilter === f.value}
                        primaryColor={primaryColor}
                        onPress={handleFilterChange}
                    />
                ))}
            </View>

            {/* ----------------------------------------------------------------
                Search bar
            ---------------------------------------------------------------- */}
            <View style={styles.searchWrap}>
                <Ionicons name="search-outline" size={18} color="#94a3b8" style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search receipt # or customer..."
                    placeholderTextColor="#94a3b8"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    returnKeyType="search"
                    clearButtonMode="while-editing"
                />
                {searchQuery.length > 0 && Platform.OS === 'android' && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <Ionicons name="close-circle" size={18} color="#94a3b8" />
                    </TouchableOpacity>
                )}
            </View>

            {/* ----------------------------------------------------------------
                Receipt list
            ---------------------------------------------------------------- */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={primaryColor} />
                    <Text style={styles.loadingText}>Loading receipts...</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredReceipts}
                    keyExtractor={(item) => item._id}
                    renderItem={({ item }) => (
                        <ReceiptCard
                            receipt={item}
                            currency={currency}
                            onPress={handleReceiptPress}
                        />
                    )}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => refresh(false)}
                            colors={[primaryColor]}
                            tintColor={primaryColor}
                        />
                    }
                    onEndReached={handleEndReached}
                    onEndReachedThreshold={0.3}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="receipt-outline" size={64} color="#cbd5e1" />
                            <Text style={styles.emptyText}>No receipts found</Text>
                            <Text style={styles.emptySubtext}>
                                {searchQuery
                                    ? 'Try a different search term'
                                    : dateFilter === 'today'
                                    ? 'No transactions today yet'
                                    : 'No receipts match the current filter'}
                            </Text>
                        </View>
                    }
                    ListFooterComponent={
                        <>
                            {loadingMore && (
                                <View style={styles.loadMoreContainer}>
                                    <ActivityIndicator size="small" color={primaryColor} />
                                    <Text style={[styles.loadMoreText, { color: primaryColor }]}>
                                        Loading more...
                                    </Text>
                                </View>
                            )}
                            {listFooterMessage && (
                                <Text style={styles.listFooterText}>{listFooterMessage}</Text>
                            )}
                        </>
                    }
                />
            )}

            {/* ----------------------------------------------------------------
                Receipt detail modal
            ---------------------------------------------------------------- */}
            <ReceiptDetailModal
                receipt={selectedReceipt}
                currency={currency}
                visible={showDetail}
                onClose={handleCloseDetail}
            />
        </View>
    );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
    // ----- Container -----
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },

    // ----- Header -----
    header: {
        paddingBottom: 20,
        paddingHorizontal: 20,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#ffffff',
    },
    headerSubtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 4,
    },

    // ----- Stats -----
    statsRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingTop: 16,
        gap: 12,
    },
    statCard: {
        flex: 1,
        backgroundColor: '#ffffff',
        borderRadius: 14,
        paddingVertical: 14,
        paddingHorizontal: 12,
        alignItems: 'center',
        minHeight: 96,
        justifyContent: 'center',
    },
    statIconWrap: {
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    statValue: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1e293b',
        textAlign: 'center',
    },
    statLabel: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 3,
        textAlign: 'center',
    },

    // ----- Filters -----
    filterRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 4,
        gap: 8,
    },
    filterChip: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 20,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    filterChipText: {
        fontSize: 13,
        color: '#64748b',
        fontWeight: '500',
    },
    filterChipTextActive: {
        color: '#ffffff',
    },

    // ----- Search -----
    searchWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 12,
        marginHorizontal: 16,
        marginTop: 12,
        marginBottom: 4,
        paddingHorizontal: 12,
        paddingVertical: Platform.OS === 'ios' ? 10 : 0,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: '#1e293b',
        paddingVertical: Platform.OS === 'android' ? 10 : 0,
    },

    // ----- List -----
    listContent: {
        padding: 16,
        paddingTop: 12,
        paddingBottom: 32,
    },

    // ----- Receipt card -----
    receiptCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
    },
    receiptCardRefund: {
        backgroundColor: '#fef2f2',
        borderLeftWidth: 3,
        borderLeftColor: '#ef4444',
    },
    receiptCardHasReturns: {
        backgroundColor: '#fffbeb',
        borderLeftWidth: 3,
        borderLeftColor: '#d97706',
    },
    receiptIconBg: {
        width: 46,
        height: 46,
        borderRadius: 12,
        backgroundColor: 'rgba(139,92,246,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    receiptIconBgRefund: {
        backgroundColor: 'rgba(239,68,68,0.1)',
    },
    receiptIconBgHasReturns: {
        backgroundColor: 'rgba(217,119,6,0.1)',
    },
    receiptInfo: {
        flex: 1,
        marginLeft: 12,
    },
    receiptTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 6,
    },
    receiptNumber: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1e293b',
    },
    receiptCustomer: {
        fontSize: 13,
        color: '#475569',
        marginTop: 3,
    },
    receiptMeta: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 2,
    },
    receiptRight: {
        alignItems: 'flex-end',
        marginLeft: 8,
    },
    receiptAmount: {
        fontSize: 15,
        fontWeight: '700',
        marginBottom: 4,
    },

    // ----- Type badges -----
    typeBadge: {
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 6,
    },
    typeBadgeSale: {
        backgroundColor: 'rgba(16,185,129,0.12)',
    },
    typeBadgeRefund: {
        backgroundColor: 'rgba(239,68,68,0.12)',
    },
    typeBadgeReturns: {
        backgroundColor: 'rgba(217,119,6,0.12)',
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 6,
    },
    typeBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    typeBadgeTextSale: {
        color: '#10b981',
    },
    typeBadgeTextRefund: {
        color: '#ef4444',
    },
    typeBadgeTextReturns: {
        fontSize: 10,
        fontWeight: '700',
        color: '#d97706',
        letterSpacing: 0.3,
    },

    // ----- Loading / empty / footer -----
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    loadingText: {
        fontSize: 14,
        color: '#64748b',
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '500',
        color: '#94a3b8',
        marginTop: 16,
    },
    emptySubtext: {
        fontSize: 13,
        color: '#cbd5e1',
        marginTop: 4,
        textAlign: 'center',
    },
    loadMoreContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        gap: 8,
    },
    loadMoreText: {
        fontSize: 14,
        fontWeight: '500',
    },
    listFooterText: {
        textAlign: 'center',
        fontSize: 12,
        color: '#94a3b8',
        paddingVertical: 12,
    },

    // ----- Detail modal -----
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalSheet: {
        backgroundColor: '#ffffff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '88%',
        paddingBottom: Platform.OS === 'ios' ? 0 : 8,
    },
    modalHandle: {
        width: 36,
        height: 4,
        backgroundColor: '#e2e8f0',
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: 10,
        marginBottom: 4,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
    },
    modalSubtitle: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 3,
    },
    modalCloseBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalBody: {
        paddingHorizontal: 20,
    },

    // ----- Refund banner -----
    refundBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fef2f2',
        borderRadius: 10,
        padding: 12,
        marginTop: 16,
        gap: 10,
    },
    refundBannerText: {
        fontSize: 13,
        color: '#ef4444',
        fontWeight: '500',
        flex: 1,
    },

    // ----- Info grid -----
    infoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 16,
        gap: 0,
    },
    infoGridItem: {
        width: '50%',
        paddingVertical: 10,
        paddingRight: 8,
    },
    infoLabel: {
        fontSize: 11,
        color: '#94a3b8',
        fontWeight: '500',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    infoValue: {
        fontSize: 14,
        color: '#1e293b',
        fontWeight: '600',
    },
    capitalize: {
        textTransform: 'capitalize',
    },

    // ----- Section divider / title -----
    sectionDivider: {
        height: 1,
        backgroundColor: '#f1f5f9',
        marginVertical: 16,
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 12,
    },

    // ----- Items -----
    itemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f8fafc',
    },
    itemInfo: {
        flex: 1,
        marginRight: 12,
    },
    itemName: {
        fontSize: 14,
        fontWeight: '500',
        color: '#1e293b',
    },
    itemQtyPrice: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    itemTotal: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1e293b',
    },

    // ----- Totals -----
    totalsSection: {
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 14,
        gap: 8,
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    totalRowLabel: {
        fontSize: 14,
        color: '#64748b',
    },
    totalRowValue: {
        fontSize: 14,
        color: '#1e293b',
        fontWeight: '500',
    },
    grandTotalRow: {
        paddingTop: 10,
        marginTop: 4,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
    },
    grandTotalLabel: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b',
    },
    grandTotalValue: {
        fontSize: 18,
        fontWeight: '700',
    },
});

export default ReceiptsScreen;
