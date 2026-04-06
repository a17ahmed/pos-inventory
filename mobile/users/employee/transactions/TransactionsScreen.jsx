import React, { useState, useEffect, useCallback } from 'react';
import {
    StyleSheet,
    Text,
    View,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    Modal,
    ScrollView,
    Platform,
    StatusBar,
    TextInput,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import api from '../../../constants/api';

// Business Context
import { useBusiness } from '../../../context/BusinessContext';

const TransactionsScreen = ({ navigation, employeeData }) => {
    // Use BusinessContext for business type and config
    const { config, businessData } = useBusiness();

    // Get colors from config (with fallback)
    const themeColors = {
        primary: config?.colors?.primary || '#f97316',
        secondary: config?.colors?.secondary || '#ea580c',
        light: config?.colors?.light || '#fff7ed',
    };
    const [refreshing, setRefreshing] = useState(false);
    const [transactions, setTransactions] = useState([]);
    const [refundReceipts, setRefundReceipts] = useState([]); // Store refund receipts for filtered calculations
    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [showDetail, setShowDetail] = useState(false);

    // Stats from server (accurate all-time totals)
    const [stats, setStats] = useState({
        totalSales: 0,
        netSales: 0,
        totalOrders: 0,
        totalItems: 0,
        netItems: 0,
        totalRefunds: 0,
        refundCount: 0,
    });

    // Refund state
    const [showRefundModal, setShowRefundModal] = useState(false);
    const [refundReason, setRefundReason] = useState('');
    const [processing, setProcessing] = useState(false);

    // Filters
    const [filter, setFilter] = useState('today'); // today, week, month, all

    const formatCurrency = (amount) => `Rs. ${(amount || 0).toLocaleString()}`;

    const printReceipt = async (order) => {
        const itemsHtml = order.items?.map(item => `
            <tr>
                <td>${item.name}</td>
                <td style="text-align: center">${item.qty}</td>
                <td style="text-align: right">${item.price}</td>
            </tr>
        `).join('') || '';

        const html = `
        <html><head><style>
            body { font-family: monospace; padding: 20px; max-width: 300px; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 20px; }
            .header h2 { margin: 0; }
            .header p { margin: 5px 0; font-size: 12px; }
            .divider { border-top: 1px dashed #000; margin: 10px 0; }
            .info p { margin: 3px 0; font-size: 12px; }
            table { width: 100%; font-size: 12px; border-collapse: collapse; }
            th { text-align: left; border-bottom: 1px solid #000; padding: 5px 0; }
            td { padding: 5px 0; }
            .totals { margin-top: 10px; }
            .totals p { margin: 3px 0; font-size: 12px; display: flex; justify-content: space-between; }
            .total-row { font-weight: bold; font-size: 14px; }
            .footer { text-align: center; margin-top: 20px; font-size: 10px; }
        </style></head><body>
            <div class="header">
                <h2>${businessData?.name || 'Business'}</h2>
                <p>${businessData?.address || ''}</p>
                <p>Order #${order.billNumber}</p>
            </div>
            <div class="divider"></div>
            <div class="info">
                <p>Date: ${order.date} ${order.time}</p>
                <p>Cashier: ${order.cashierName || 'N/A'}</p>
                <p>Customer: ${order.customerName || 'Walk-in'}</p>
            </div>
            <div class="divider"></div>
            <table><thead><tr><th>Item</th><th>Qty</th><th style="text-align: right">Price</th></tr></thead>
            <tbody>${itemsHtml}</tbody></table>
            <div class="divider"></div>
            <div class="totals">
                <p><span>Subtotal:</span><span>${formatCurrency(order.totalBill - (order.totalGST || 0))}</span></p>
                <p><span>GST:</span><span>${formatCurrency(order.totalGST)}</span></p>
                <p class="total-row"><span>Total:</span><span>${formatCurrency(order.totalBill)}</span></p>
                <p><span>Cash:</span><span>${formatCurrency(order.cashGiven)}</span></p>
                <p><span>Change:</span><span>${formatCurrency((order.cashGiven || 0) - order.totalBill)}</span></p>
            </div>
            <div class="divider"></div>
            <div class="footer"><p>Thank you for your business!</p></div>
        </body></html>`;

        try { await Print.printAsync({ html }); } catch (e) { console.log('Print error:', e); }
    };

    // Only use useFocusEffect to avoid duplicate API calls
    useFocusEffect(
        useCallback(() => {
            loadTransactions();
        }, [])
    );

    const loadTransactions = async () => {
        try {
            // Fetch receipts list and stats in parallel
            const [receiptsRes, statsRes] = await Promise.all([
                api.get('/receipt?all=true'),
                api.get('/receipt/stats')
            ]);

            // Handle both old format (array) and new format (object with receipts)
            const allReceipts = Array.isArray(receiptsRes.data)
                ? receiptsRes.data
                : receiptsRes.data.receipts || [];

            // Map all receipts (both sales and refunds)
            const mappedReceipts = allReceipts.map(r => {
                const isRefundReceipt = r.receiptType?.includes('_refund');
                const hasReturns = (r.totalReturned || 0) > 0 || (r.returns && r.returns.length > 0);
                return {
                    _id: r._id,
                    billNumber: r.billNumber,
                    customerName: r.customerName || (isRefundReceipt ? 'Return' : 'Walk-in Customer'),
                    totalBill: r.totalBill || 0,
                    totalGST: r.totalGST || 0,
                    totalQty: r.totalQty || r.items?.reduce((sum, i) => sum + (i.qty || 1), 0) || 0,
                    items: r.items?.map(i => ({
                        name: i.name,
                        price: i.price,
                        qty: i.qty || 1,
                        returnedQty: i.returnedQty || 0,
                        remainingQty: i.remainingQty ?? (i.qty || 1),
                    })),
                    cashGiven: r.cashGiven || 0,
                    change: (r.cashGiven || 0) - (r.totalBill || 0),
                    cashierName: r.cashierName || r.waiterName || 'Staff',
                    date: new Date(r.createdAt).toLocaleDateString(),
                    time: new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    createdAt: r.createdAt,
                    orderType: r.orderId ? 'order' : 'direct',
                    receiptType: r.receiptType,
                    paymentMethod: r.paymentMethod || 'cash',
                    // Refund/Return info
                    paymentStatus: r.isRefunded ? 'refunded' : 'paid',
                    isRefunded: r.isRefunded || false,
                    isReturnReceipt: isRefundReceipt, // Mark as return receipt
                    refundReason: r.refundReason,
                    refundAmount: r.refundAmount,
                    refundedBy: r.refundedBy || null,
                    refundedAt: r.refundedAt,
                    orderId: r.orderId,
                    // Return history (for receipts with linked returns)
                    hasReturns: hasReturns,
                    totalReturned: r.totalReturned || 0,
                    netAmount: r.netAmount ?? (r.totalBill || 0),
                    returns: r.returns || [],
                };
            }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            // Store refund receipts separately for calculations
            const refunds = mappedReceipts
                .filter(r => r.isReturnReceipt)
                .map(r => ({
                    _id: r._id,
                    totalBill: Math.abs(r.totalBill || 0), // Store as positive for easy subtraction
                    totalQty: r.totalQty || 0,
                    createdAt: r.createdAt,
                }));

            setTransactions(mappedReceipts);
            setRefundReceipts(refunds);

            // Use today's stats from the stats endpoint
            const statsData = statsRes.data;
            setStats({
                totalSales: statsData.todaySales || statsData.grossRevenue || 0,
                netSales: statsData.netTodaySales || statsData.netRevenue || 0,
                totalOrders: statsData.todayOrders || statsData.totalOrders || 0,
                totalItems: statsData.totalItems || 0,
                netItems: statsData.totalItems || 0,
                totalRefunds: statsData.todayReturns || statsData.totalReturns || 0,
                refundCount: statsData.refundCount || 0,
            });
        } catch (error) {
            console.error('Error loading transactions:', error);
        } finally {
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadTransactions();
    };

    const getFilterDates = () => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        // Use calendar month start (1st of current month), not "last 30 days"
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        return { now, today, weekAgo, monthStart };
    };

    const isInCurrentMonth = (dateStr) => {
        const date = new Date(dateStr);
        const now = new Date();
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    };

    const getFilteredTransactions = () => {
        const { today, weekAgo } = getFilterDates();

        let filtered;
        switch (filter) {
            case 'today':
                filtered = transactions.filter(t => new Date(t.createdAt) >= today);
                break;
            case 'week':
                filtered = transactions.filter(t => new Date(t.createdAt) >= weekAgo);
                break;
            case 'month':
                filtered = transactions.filter(t => isInCurrentMonth(t.createdAt));
                break;
            default:
                filtered = transactions;
        }
        return filtered;
    };

    // Get only sales (non-refund) transactions for stats calculation
    const getSalesOnly = (list) => list.filter(t => !t.isReturnReceipt);

    const getFilteredRefunds = () => {
        const { today, weekAgo, monthStart } = getFilterDates();

        switch (filter) {
            case 'today':
                return refundReceipts.filter(r => new Date(r.createdAt) >= today);
            case 'week':
                return refundReceipts.filter(r => new Date(r.createdAt) >= weekAgo);
            case 'month':
                return refundReceipts.filter(r => isInCurrentMonth(r.createdAt));
            default:
                return refundReceipts;
        }
    };

    const filteredTransactions = getFilteredTransactions();
    const filteredRefunds = getFilteredRefunds();
    const filteredSalesOnly = getSalesOnly(filteredTransactions);

    // Stats - use server stats for "all" filter, calculate for filtered views
    // Net sales = sales - raw refunds - linked returns
    const filteredSalesTotal = filteredSalesOnly.reduce((sum, t) => sum + (t.totalBill || 0), 0);
    const filteredRefundTotal = filteredRefunds.reduce((sum, r) => sum + (r.totalBill || 0), 0);
    const filteredRefundItems = filteredRefunds.reduce((sum, r) => sum + (r.totalQty || 0), 0);
    // Linked returns (returns WITH bill number) - stored in totalReturned field of receipts
    const filteredLinkedReturns = filteredSalesOnly.reduce((sum, t) => sum + (t.totalReturned || 0), 0);

    const totalAmount = filteredSalesTotal - filteredRefundTotal - filteredLinkedReturns;
    const totalTransactions = filteredSalesOnly.length;
    const totalItems = filteredSalesOnly.reduce((sum, t) => sum + (t.totalQty || 0), 0) - filteredRefundItems;

    const FilterChip = ({ label, value }) => (
        <TouchableOpacity
            style={[
                styles.filterChip,
                filter === value && { backgroundColor: themeColors.primary, borderColor: themeColors.primary }
            ]}
            onPress={() => setFilter(value)}
        >
            <Text style={[styles.filterText, filter === value && styles.filterTextActive]}>
                {label}
            </Text>
        </TouchableOpacity>
    );

    const TransactionItem = ({ item }) => {
        const date = new Date(item.createdAt);
        const isToday = date.toDateString() === new Date().toDateString();
        const isReturn = item.isReturnReceipt;
        const isRefundedSale = item.isRefunded && !isReturn;
        const hasLinkedReturns = item.hasReturns && !isReturn;

        // Show net amount if has linked returns, otherwise show total
        const displayAmount = hasLinkedReturns ? (item.netAmount || 0) : Math.abs(item.totalBill || 0);

        return (
            <TouchableOpacity
                style={[
                    styles.transactionItem,
                    isReturn && styles.transactionItemReturn,
                    isRefundedSale && styles.transactionItemRefunded,
                    hasLinkedReturns && styles.transactionItemHasReturns
                ]}
                onPress={() => {
                    setSelectedTransaction(item);
                    setShowDetail(true);
                }}
            >
                <View style={[
                    styles.transactionIconBg,
                    isReturn && styles.iconBgReturn,
                    isRefundedSale && styles.iconBgRefunded,
                    hasLinkedReturns && styles.iconBgHasReturns
                ]}>
                    <Ionicons
                        name={isReturn ? "arrow-undo-outline" : (isRefundedSale ? "return-down-back-outline" : "receipt-outline")}
                        size={22}
                        color={isReturn ? "#ef4444" : (isRefundedSale ? "#ef4444" : (hasLinkedReturns ? "#d97706" : themeColors.primary))}
                    />
                </View>
                <View style={styles.transactionInfo}>
                    <View style={styles.customerRow}>
                        <Text style={[styles.transactionCustomer, isReturn && { color: '#ef4444' }]}>
                            {isReturn ? 'Product Return' : (item.customerName || 'Walk-in Customer')}
                        </Text>
                        {isReturn && (
                            <View style={styles.returnBadge}>
                                <Text style={styles.returnBadgeText}>RETURN</Text>
                            </View>
                        )}
                        {isRefundedSale && (
                            <View style={styles.refundedBadge}>
                                <Text style={styles.refundedBadgeText}>REFUNDED</Text>
                            </View>
                        )}
                        {hasLinkedReturns && (
                            <View style={styles.hasReturnsBadge}>
                                <Text style={styles.hasReturnsBadgeText}>HAS RETURNS</Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.transactionMeta}>
                        {isReturn ? 'Return' : 'Order'} #{item.billNumber} • {item.totalQty || item.items?.length || 0} items
                    </Text>
                    <Text style={styles.transactionDate}>
                        {isToday ? 'Today' : date.toLocaleDateString()} at {' '}
                        {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </View>
                <View style={styles.transactionRight}>
                    {hasLinkedReturns && (
                        <Text style={styles.originalAmount}>
                            Rs. {Math.abs(item.totalBill || 0).toLocaleString()}
                        </Text>
                    )}
                    <Text style={[
                        styles.transactionAmount,
                        { color: isReturn ? '#ef4444' : (hasLinkedReturns ? '#d97706' : themeColors.primary) },
                        isRefundedSale && styles.amountRefunded
                    ]}>
                        {isReturn ? '-' : ''}Rs. {displayAmount.toLocaleString()}
                    </Text>
                    <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                </View>
            </TouchableOpacity>
        );
    };

    // Refund handler
    const handleRefund = () => {
        setRefundReason('');
        setShowRefundModal(true);
    };

    const confirmRefund = async () => {
        if (!refundReason.trim()) {
            Alert.alert('Reason Required', 'Please enter a reason for the refund');
            return;
        }

        setProcessing(true);
        try {
            // If this receipt has an orderId, refund via order endpoint
            // Otherwise refund via receipt endpoint
            if (selectedTransaction.orderId) {
                await api.patch(`/order/${selectedTransaction.orderId}/refund`, {
                    reason: refundReason,
                    amount: selectedTransaction.totalBill
                });
            } else {
                await api.post(`/receipt/${selectedTransaction._id}/refund`, {
                    reason: refundReason,
                    refundAmount: selectedTransaction.totalBill
                });
            }

            Alert.alert('Refund Processed', `Rs. ${selectedTransaction.totalBill?.toLocaleString()} has been refunded`);
            setShowRefundModal(false);
            setShowDetail(false);
            loadTransactions(); // Reload to show updated status
        } catch (error) {
            console.error('Refund error:', error);
            Alert.alert('Error', error.response?.data?.message || 'Failed to process refund');
        } finally {
            setProcessing(false);
        }
    };

    const TransactionDetail = () => {
        if (!selectedTransaction) return null;

        const date = new Date(selectedTransaction.createdAt);
        const canRefund = !selectedTransaction.isRefunded;

        const isReturnReceipt = selectedTransaction.isReturnReceipt;

        return (
            <Modal visible={showDetail} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        {/* Header */}
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {isReturnReceipt ? 'Return Details' : 'Transaction Details'}
                            </Text>
                            <TouchableOpacity onPress={() => setShowDetail(false)}>
                                <Ionicons name="close" size={24} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Return Receipt Banner */}
                            {isReturnReceipt && (
                                <View style={[styles.refundBanner, { backgroundColor: '#fef2f2' }]}>
                                    <Ionicons name="arrow-undo" size={20} color="#ef4444" />
                                    <View style={styles.refundBannerText}>
                                        <Text style={styles.refundBannerTitle}>Product Return</Text>
                                        <Text style={styles.refundBannerMeta}>
                                            Items returned and refunded to customer
                                        </Text>
                                    </View>
                                </View>
                            )}

                            {/* Refunded Status Banner (for sales that were refunded) */}
                            {selectedTransaction.isRefunded && !isReturnReceipt && (
                                <View style={styles.refundBanner}>
                                    <Ionicons name="alert-circle" size={20} color="#ef4444" />
                                    <View style={styles.refundBannerText}>
                                        <Text style={styles.refundBannerTitle}>This order was refunded</Text>
                                        {selectedTransaction.refundedBy && (
                                            <Text style={styles.refundBannerMeta}>
                                                By: {selectedTransaction.refundedBy}
                                            </Text>
                                        )}
                                        {selectedTransaction.refundedAt && (
                                            <Text style={styles.refundBannerMeta}>
                                                On: {new Date(selectedTransaction.refundedAt).toLocaleDateString()} {new Date(selectedTransaction.refundedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </Text>
                                        )}
                                        <Text style={styles.refundBannerReason}>
                                            Reason: {selectedTransaction.refundReason || 'Not specified'}
                                        </Text>
                                    </View>
                                </View>
                            )}

                            {/* Has Returns Banner (for sales with partial/full returns linked) */}
                            {selectedTransaction.hasReturns && !isReturnReceipt && !selectedTransaction.isRefunded && (
                                <View style={styles.hasReturnsBanner}>
                                    <Ionicons name="arrow-undo-circle" size={20} color="#f59e0b" />
                                    <View style={styles.refundBannerText}>
                                        <Text style={styles.hasReturnsBannerTitle}>This order has returns</Text>
                                        <Text style={styles.hasReturnsBannerMeta}>
                                            Total Returned: Rs. {selectedTransaction.totalReturned?.toLocaleString()}
                                        </Text>
                                    </View>
                                </View>
                            )}

                            {/* Bill Info */}
                            <View style={styles.detailSection}>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>
                                        {isReturnReceipt ? 'Return Number' : 'Order Number'}
                                    </Text>
                                    <Text style={styles.detailValue}>#{selectedTransaction.billNumber}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Date</Text>
                                    <Text style={styles.detailValue}>
                                        {selectedTransaction.date} {selectedTransaction.time}
                                    </Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Customer</Text>
                                    <Text style={styles.detailValue}>
                                        {isReturnReceipt ? 'Return Customer' : (selectedTransaction.customerName || 'Walk-in')}
                                    </Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>{isReturnReceipt ? 'Processed By' : 'Cashier'}</Text>
                                    <Text style={styles.detailValue}>
                                        {selectedTransaction.cashierName || 'Staff'}
                                    </Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Status</Text>
                                    <Text style={[
                                        styles.detailValue,
                                        isReturnReceipt ? styles.statusRefunded :
                                        (selectedTransaction.isRefunded ? styles.statusRefunded : styles.statusPaid)
                                    ]}>
                                        {isReturnReceipt ? 'Returned' : (selectedTransaction.isRefunded ? 'Refunded' : 'Paid')}
                                    </Text>
                                </View>
                            </View>

                            {/* Items */}
                            <Text style={styles.itemsTitle}>
                                {isReturnReceipt ? 'Returned Items' : 'Items'} ({selectedTransaction.items?.length})
                            </Text>
                            {selectedTransaction.items?.map((item, index) => {
                                const hasItemReturn = (item.returnedQty || 0) > 0;
                                return (
                                    <View key={index} style={styles.itemRow}>
                                        <View style={styles.itemInfo}>
                                            <Text style={styles.itemName}>{item.name}</Text>
                                            <View style={styles.itemQtyRow}>
                                                <Text style={[styles.itemQty, hasItemReturn && styles.itemQtyReturned]}>
                                                    x{item.qty}
                                                </Text>
                                                {hasItemReturn && (
                                                    <Text style={styles.itemReturnedQty}>
                                                        ({item.returnedQty} returned)
                                                    </Text>
                                                )}
                                            </View>
                                        </View>
                                        <Text style={[styles.itemPrice, isReturnReceipt && { color: '#ef4444' }]}>
                                            {isReturnReceipt ? '-' : ''}Rs. {Math.abs(item.price || 0)}
                                        </Text>
                                    </View>
                                );
                            })}

                            {/* Return History - for receipts with linked returns */}
                            {selectedTransaction.hasReturns && selectedTransaction.returns?.length > 0 && !isReturnReceipt && (
                                <View style={styles.returnHistorySection}>
                                    <Text style={styles.returnHistoryTitle}>Return History</Text>
                                    {selectedTransaction.returns.map((ret, index) => (
                                        <View key={index} style={styles.returnHistoryItem}>
                                            <View style={styles.returnHistoryInfo}>
                                                <Text style={styles.returnHistoryLabel}>
                                                    Return #{ret.returnNumber || index + 1}
                                                </Text>
                                                <Text style={styles.returnHistoryDate}>
                                                    {ret.returnedAt ? new Date(ret.returnedAt).toLocaleDateString() : 'N/A'}
                                                </Text>
                                            </View>
                                            <Text style={styles.returnHistoryAmount}>
                                                -Rs. {(ret.totalRefund || 0).toLocaleString()}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {/* Summary */}
                            <View style={styles.summarySection}>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>
                                        {isReturnReceipt ? 'Refund Amount' : 'Subtotal'}
                                    </Text>
                                    <Text style={[styles.summaryValue, isReturnReceipt && { color: '#ef4444' }]}>
                                        {isReturnReceipt ? '-' : ''}Rs. {Math.abs(selectedTransaction.totalBill - (selectedTransaction.totalGST || 0)).toLocaleString()}
                                    </Text>
                                </View>
                                {!isReturnReceipt && (
                                    <View style={styles.summaryRow}>
                                        <Text style={styles.summaryLabel}>Tax (GST)</Text>
                                        <Text style={styles.summaryValue}>
                                            Rs. {(selectedTransaction.totalGST || 0).toLocaleString()}
                                        </Text>
                                    </View>
                                )}
                                <View style={[styles.summaryRow, styles.totalRow]}>
                                    <Text style={styles.totalLabel}>
                                        {isReturnReceipt ? 'Total Refunded' : 'Total'}
                                    </Text>
                                    <Text style={[
                                        styles.totalValue,
                                        (selectedTransaction.isRefunded || isReturnReceipt) && styles.totalRefunded
                                    ]}>
                                        {isReturnReceipt ? '-' : ''}Rs. {Math.abs(selectedTransaction.totalBill || 0).toLocaleString()}
                                    </Text>
                                </View>

                                {/* Show returns deduction and net amount for receipts with linked returns */}
                                {selectedTransaction.hasReturns && !isReturnReceipt && (
                                    <>
                                        <View style={styles.summaryRow}>
                                            <Text style={[styles.summaryLabel, { color: '#ef4444' }]}>Returns</Text>
                                            <Text style={[styles.summaryValue, { color: '#ef4444' }]}>
                                                -Rs. {(selectedTransaction.totalReturned || 0).toLocaleString()}
                                            </Text>
                                        </View>
                                        <View style={[styles.summaryRow, styles.netRow]}>
                                            <Text style={styles.netLabel}>Net Amount</Text>
                                            <Text style={styles.netValue}>
                                                Rs. {(selectedTransaction.netAmount || 0).toLocaleString()}
                                            </Text>
                                        </View>
                                    </>
                                )}

                                {!isReturnReceipt && selectedTransaction.cashGiven > 0 && !selectedTransaction.hasReturns && (
                                    <>
                                        <View style={styles.summaryRow}>
                                            <Text style={styles.summaryLabel}>Cash Given</Text>
                                            <Text style={styles.summaryValue}>
                                                Rs. {selectedTransaction.cashGiven?.toLocaleString()}
                                            </Text>
                                        </View>
                                        <View style={styles.summaryRow}>
                                            <Text style={styles.summaryLabel}>Change</Text>
                                            <Text style={styles.summaryValue}>
                                                Rs. {(selectedTransaction.cashGiven - selectedTransaction.totalBill).toLocaleString()}
                                            </Text>
                                        </View>
                                    </>
                                )}
                            </View>

                            {/* Action Buttons - Hide for return receipts */}
                            {!isReturnReceipt && (
                                <View style={styles.actionButtons}>
                                    <TouchableOpacity style={styles.printButton} onPress={() => printReceipt(selectedTransaction)}>
                                        <Ionicons name="print" size={20} color="#fff" />
                                        <Text style={styles.printButtonText}>Print Receipt</Text>
                                    </TouchableOpacity>
                                    {canRefund && (
                                        <TouchableOpacity style={styles.refundButton} onPress={handleRefund}>
                                            <Ionicons name="return-down-back" size={20} color="#fff" />
                                            <Text style={styles.refundButtonText}>Process Refund</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        );
    };

    // Refund Modal
    const RefundModal = () => (
        <Modal visible={showRefundModal} animationType="fade" transparent>
            <View style={styles.refundModalOverlay}>
                <View style={styles.refundModalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Process Refund</Text>
                        <TouchableOpacity onPress={() => setShowRefundModal(false)}>
                            <Ionicons name="close" size={24} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.refundModalBody}>
                        <View style={styles.refundAmountBox}>
                            <Text style={styles.refundAmountLabel}>Refund Amount</Text>
                            <Text style={styles.refundAmountValue}>
                                Rs. {selectedTransaction?.totalBill?.toLocaleString()}
                            </Text>
                        </View>

                        <Text style={styles.refundInputLabel}>Reason for refund *</Text>
                        <TextInput
                            style={styles.refundInput}
                            placeholder="Enter reason (e.g., customer complaint, order error)"
                            value={refundReason}
                            onChangeText={setRefundReason}
                            multiline
                            numberOfLines={3}
                        />

                        <View style={styles.refundModalButtons}>
                            <TouchableOpacity
                                style={styles.cancelRefundBtn}
                                onPress={() => setShowRefundModal(false)}
                            >
                                <Text style={styles.cancelRefundBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.confirmRefundBtn, processing && styles.btnDisabled]}
                                onPress={confirmRefund}
                                disabled={processing}
                            >
                                {processing ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <Text style={styles.confirmRefundBtnText}>Confirm Refund</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </View>
        </Modal>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={themeColors.primary} />

            {/* Header */}
            <LinearGradient
                colors={[themeColors.primary, themeColors.secondary]}
                style={styles.header}
            >
                <Text style={styles.headerTitle}>Sales</Text>
                <Text style={styles.headerSubtitle}>
                    {filter === 'today' ? "Today's transactions" : filter === 'week' ? "This week's transactions" : filter === 'month' ? "This month's transactions" : 'All transactions'}
                </Text>
            </LinearGradient>

            {/* Summary Cards */}
            <View style={styles.summaryCards}>
                <View style={styles.summaryCard}>
                    <Ionicons name="cash-outline" size={24} color="#10b981" />
                    <Text style={styles.cardValue} numberOfLines={1} adjustsFontSizeToFit>
                        Rs. {totalAmount.toLocaleString()}
                    </Text>
                    <Text style={styles.cardLabel}>
                        {filter === 'today' ? "Today's Sales" : filter === 'week' ? "Week's Sales" : filter === 'month' ? "Month's Sales" : 'Total Sales'}
                    </Text>
                </View>
                <View style={styles.summaryCard}>
                    <Ionicons name="receipt-outline" size={24} color="#3b82f6" />
                    <Text style={styles.cardValue} numberOfLines={1} adjustsFontSizeToFit>
                        {totalTransactions}
                    </Text>
                    <Text style={styles.cardLabel}>Transactions</Text>
                </View>
                <View style={styles.summaryCard}>
                    <Ionicons name="receipt-outline" size={24} color={themeColors.primary} />
                    <Text style={styles.cardValue} numberOfLines={1} adjustsFontSizeToFit>
                        {totalItems}
                    </Text>
                    <Text style={styles.cardLabel}>Items</Text>
                </View>
            </View>

            {/* Filters */}
            <View style={styles.filtersRow}>
                <FilterChip label="Today" value="today" />
                <FilterChip label="This Week" value="week" />
                <FilterChip label="This Month" value="month" />
                <FilterChip label="All" value="all" />
            </View>

            {/* Transaction List */}
            <FlatList
                data={filteredTransactions}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => <TransactionItem item={item} />}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="receipt-outline" size={64} color="#cbd5e1" />
                        <Text style={styles.emptyText}>No sales yet</Text>
                        <Text style={styles.emptySubtext}>Your completed sales will appear here</Text>
                    </View>
                }
            />

            <TransactionDetail />
            <RefundModal />
        </View>
    );
};

export default TransactionsScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    header: {
        paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight + 10,
        paddingBottom: 20,
        paddingHorizontal: 20,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#fff',
    },
    headerSubtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 4,
    },
    summaryCards: {
        flexDirection: 'row',
        padding: 16,
        gap: 10,
    },
    summaryCard: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 14,
        paddingVertical: 14,
        paddingHorizontal: 8,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 90,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    cardValue: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b',
        marginTop: 8,
        textAlign: 'center',
        width: '100%',
    },
    cardLabel: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 4,
        textAlign: 'center',
    },
    filtersRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingBottom: 12,
        gap: 8,
    },
    filterChip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    filterChipActive: {
        backgroundColor: '#f97316',
        borderColor: '#f97316',
    },
    filterText: {
        fontSize: 13,
        color: '#64748b',
        fontWeight: '500',
    },
    filterTextActive: {
        color: '#fff',
    },
    listContent: {
        padding: 16,
        paddingTop: 4,
    },
    transactionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    transactionIconBg: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#fff7ed',
        alignItems: 'center',
        justifyContent: 'center',
    },
    transactionInfo: {
        flex: 1,
        marginLeft: 14,
    },
    transactionCustomer: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1e293b',
    },
    transactionMeta: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 2,
    },
    transactionDate: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 2,
    },
    transactionRight: {
        alignItems: 'flex-end',
    },
    transactionAmount: {
        fontSize: 16,
        fontWeight: '700',
        color: '#f97316',
        marginBottom: 4,
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
        fontSize: 14,
        color: '#cbd5e1',
        marginTop: 4,
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '85%',
        paddingBottom: 30,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1e293b',
    },
    detailSection: {
        padding: 20,
        backgroundColor: '#f8fafc',
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    detailLabel: {
        fontSize: 14,
        color: '#64748b',
    },
    detailValue: {
        fontSize: 14,
        fontWeight: '500',
        color: '#1e293b',
    },
    itemsTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1e293b',
        padding: 20,
        paddingBottom: 10,
    },
    itemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    itemInfo: {
        flex: 1,
    },
    itemName: {
        fontSize: 14,
        fontWeight: '500',
        color: '#1e293b',
    },
    itemQty: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 2,
    },
    itemPrice: {
        fontSize: 14,
        fontWeight: '500',
        color: '#1e293b',
    },
    summarySection: {
        padding: 20,
        backgroundColor: '#f8fafc',
        marginTop: 10,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    summaryLabel: {
        fontSize: 14,
        color: '#64748b',
    },
    summaryValue: {
        fontSize: 14,
        color: '#1e293b',
    },
    totalRow: {
        paddingTop: 12,
        marginTop: 4,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1e293b',
    },
    totalValue: {
        fontSize: 18,
        fontWeight: '700',
        color: '#10b981',
    },
    // Refund styles
    transactionItemRefunded: {
        backgroundColor: '#fef2f2',
        borderWidth: 1,
        borderColor: '#fecaca',
    },
    iconBgRefunded: {
        backgroundColor: '#fee2e2',
    },
    customerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    refundedBadge: {
        backgroundColor: '#ef4444',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    refundedBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#fff',
    },
    // Return receipt styles
    transactionItemReturn: {
        backgroundColor: '#fef2f2',
        borderWidth: 1,
        borderColor: '#fecaca',
    },
    iconBgReturn: {
        backgroundColor: '#fee2e2',
    },
    returnBadge: {
        backgroundColor: '#dc2626',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    returnBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#fff',
    },
    // Has linked returns styles
    transactionItemHasReturns: {
        backgroundColor: '#fffbeb',
        borderWidth: 1,
        borderColor: '#fde68a',
    },
    iconBgHasReturns: {
        backgroundColor: '#fef3c7',
    },
    hasReturnsBadge: {
        backgroundColor: '#d97706',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    hasReturnsBadgeText: {
        fontSize: 9,
        fontWeight: '700',
        color: '#fff',
    },
    originalAmount: {
        fontSize: 12,
        color: '#94a3b8',
        textDecorationLine: 'line-through',
        marginBottom: 2,
    },
    amountRefunded: {
        color: '#ef4444',
        textDecorationLine: 'line-through',
    },
    statusPaid: {
        color: '#10b981',
        fontWeight: '600',
    },
    statusRefunded: {
        color: '#ef4444',
        fontWeight: '600',
    },
    totalRefunded: {
        color: '#ef4444',
        textDecorationLine: 'line-through',
    },
    refundBanner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#fef2f2',
        padding: 16,
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#fecaca',
    },
    refundBannerText: {
        flex: 1,
    },
    refundBannerTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#ef4444',
    },
    refundBannerMeta: {
        fontSize: 12,
        color: '#991b1b',
        marginTop: 2,
    },
    refundBannerReason: {
        fontSize: 13,
        color: '#991b1b',
        marginTop: 4,
    },
    actionButtons: {
        padding: 20,
        gap: 10,
    },
    printButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#3b82f6',
        paddingVertical: 14,
        borderRadius: 12,
        gap: 8,
    },
    printButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    refundButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ef4444',
        paddingVertical: 14,
        borderRadius: 12,
        gap: 8,
    },
    refundButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    refundModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    refundModalContent: {
        backgroundColor: '#fff',
        borderRadius: 16,
    },
    refundModalBody: {
        padding: 20,
    },
    refundAmountBox: {
        backgroundColor: '#fef2f2',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 20,
    },
    refundAmountLabel: {
        fontSize: 13,
        color: '#991b1b',
    },
    refundAmountValue: {
        fontSize: 28,
        fontWeight: '700',
        color: '#ef4444',
        marginTop: 4,
    },
    refundInputLabel: {
        fontSize: 14,
        color: '#64748b',
        marginBottom: 8,
    },
    refundInput: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 10,
        padding: 12,
        fontSize: 15,
        minHeight: 80,
        textAlignVertical: 'top',
    },
    refundModalButtons: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 20,
    },
    cancelRefundBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 10,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
    },
    cancelRefundBtnText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#64748b',
    },
    confirmRefundBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 10,
        backgroundColor: '#ef4444',
        alignItems: 'center',
    },
    confirmRefundBtnText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    btnDisabled: {
        backgroundColor: '#fca5a5',
    },
    // Has Returns Banner styles
    hasReturnsBanner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#fffbeb',
        padding: 16,
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#fde68a',
    },
    hasReturnsBannerTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#d97706',
    },
    hasReturnsBannerMeta: {
        fontSize: 12,
        color: '#92400e',
        marginTop: 2,
    },
    // Item return quantity styles
    itemQtyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    itemQtyReturned: {
        color: '#94a3b8',
    },
    itemReturnedQty: {
        fontSize: 12,
        color: '#ef4444',
        fontWeight: '500',
    },
    // Return history section
    returnHistorySection: {
        padding: 20,
        paddingBottom: 10,
        backgroundColor: '#fefce8',
        borderBottomWidth: 1,
        borderBottomColor: '#fde68a',
    },
    returnHistoryTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#92400e',
        marginBottom: 10,
    },
    returnHistoryItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#fef3c7',
    },
    returnHistoryInfo: {
        flex: 1,
    },
    returnHistoryLabel: {
        fontSize: 13,
        fontWeight: '500',
        color: '#78350f',
    },
    returnHistoryDate: {
        fontSize: 11,
        color: '#a16207',
        marginTop: 2,
    },
    returnHistoryAmount: {
        fontSize: 14,
        fontWeight: '600',
        color: '#ef4444',
    },
    // Net amount row
    netRow: {
        paddingTop: 8,
        marginTop: 4,
        borderTopWidth: 1,
        borderTopColor: '#10b981',
    },
    netLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: '#047857',
    },
    netValue: {
        fontSize: 17,
        fontWeight: '700',
        color: '#10b981',
    },
});
