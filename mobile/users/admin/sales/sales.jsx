import React, { useState, useEffect, useCallback } from 'react';
import {
    StyleSheet,
    Text,
    View,
    FlatList,
    TouchableOpacity,
    TextInput,
    Platform,
    StatusBar,
    ActivityIndicator,
    Alert,
    RefreshControl,
    Modal,
    ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import axios from 'axios';
import * as Print from 'expo-print';

// Business Context
import { useBusiness } from '../../../context/BusinessContext';

const Sales = () => {
    const API_BASE_URL = Constants.expoConfig.extra.API_BASE_URL;

    // Use BusinessContext for business type and config
    const { config, businessType, isRestaurant } = useBusiness();

    // Get colors from config (with fallback)
    const themeColors = {
        primary: config?.colors?.primary || '#06b6d4',
        secondary: config?.colors?.secondary || '#0891b2',
        bg: config?.colors?.light || '#ecfeff',
    };

    // Set status bar on focus
    useFocusEffect(
        useCallback(() => {
            StatusBar.setBarStyle('dark-content');
            return () => {};
        }, [])
    );

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [receipts, setReceipts] = useState([]);
    const [filteredReceipts, setFilteredReceipts] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [businessData, setBusinessData] = useState(null);

    // Detail modal
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [showDetail, setShowDetail] = useState(false);

    // Refund
    const [showRefundModal, setShowRefundModal] = useState(false);
    const [refundReason, setRefundReason] = useState('');
    const [processing, setProcessing] = useState(false);

    // Stats
    const [stats, setStats] = useState({
        totalSales: 0,
        totalOrders: 0,
        todaySales: 0,
        todayOrders: 0,
        monthSales: 0,
        monthOrders: 0,
    });

    useEffect(() => {
        loadBusinessData();
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchReceipts();
        }, [])
    );

    useEffect(() => {
        filterReceipts();
    }, [searchQuery, receipts]);

    const loadBusinessData = async () => {
        try {
            const businessStr = await AsyncStorage.getItem('business');
            if (businessStr) {
                setBusinessData(JSON.parse(businessStr));
            }
        } catch (error) {
            console.log('Error loading business:', error);
        }
    };

    const getToken = async () => {
        try {
            return await AsyncStorage.getItem('token');
        } catch (error) {
            return null;
        }
    };

    const fetchReceipts = async () => {
        try {
            const token = await getToken();
            if (!token) return;

            const headers = { Authorization: `Bearer ${token}` };
            let mappedReceipts = [];

            if (isRestaurant) {
                // Restaurant: Load from orders
                const ordersResponse = await axios.get(`${API_BASE_URL}/order`, { headers });
                const allOrders = ordersResponse.data || [];

                // Only show paid/refunded orders
                mappedReceipts = allOrders
                    .filter(o => o.paymentStatus === 'paid' || o.paymentStatus === 'refunded')
                    .map(o => ({
                        _id: o._id,
                        billNumber: o.orderNumber,
                        customerName: o.customerName || (o.orderType === 'takeaway' ? 'Takeaway' : `Table ${o.table?.tableNumber || ''}`),
                        cashierName: o.paidBy?.name || o.createdBy?.name || 'Staff',
                        totalBill: o.total || 0,
                        totalGST: o.tax || 0,
                        totalQty: o.items?.reduce((sum, i) => sum + (i.quantity || 1), 0) || 0,
                        items: o.items?.map(i => ({
                            name: i.name,
                            price: i.price,
                            qty: i.quantity || 1,
                        })),
                        cashGiven: o.cashGiven || 0,
                        date: new Date(o.paidAt || o.createdAt).toLocaleDateString(),
                        time: new Date(o.paidAt || o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        createdAt: o.paidAt || o.createdAt,
                        orderType: o.orderType,
                        paymentMethod: o.paymentMethod,
                        paymentStatus: o.paymentStatus,
                        isRefunded: o.paymentStatus === 'refunded',
                        refundReason: o.refundReason,
                        refundAmount: o.refundAmount,
                        refundedBy: o.refundedBy?.name || null,
                        refundedAt: o.refundedAt,
                        isRestaurantOrder: true,
                    }));
            } else {
                // Retail/Service: Load from receipts
                const receiptsResponse = await axios.get(`${API_BASE_URL}/receipt?all=true`, { headers });
                // Handle both old (array) and new (object with receipts) response formats
                const allReceipts = receiptsResponse.data?.receipts || receiptsResponse.data || [];

                mappedReceipts = allReceipts.map(r => {
                    const isRefundReceipt = r.receiptType?.includes('_refund');
                    const hasReturns = (r.totalReturned || 0) > 0 || (r.returns && r.returns.length > 0);

                    return {
                        _id: r._id,
                        billNumber: r.billNumber,
                        customerName: r.customerName || 'Walk-in Customer',
                        cashierName: r.cashierName || 'Staff',
                        totalBill: r.totalBill || 0,
                        totalGST: r.totalGST || 0,
                        totalQty: r.totalQty || r.items?.reduce((sum, i) => sum + (i.qty || 1), 0) || 0,
                        items: r.items?.map(i => ({
                            name: i.name,
                            price: i.price,
                            qty: i.qty || 1,
                            returnedQty: i.returnedQty || 0,
                        })),
                        cashGiven: r.cashGiven || 0,
                        date: new Date(r.createdAt).toLocaleDateString(),
                        time: new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        createdAt: r.createdAt,
                        receiptType: r.receiptType,
                        isRefunded: r.isRefunded,
                        isRefundReceipt: isRefundReceipt,
                        hasReturns: hasReturns,
                        totalReturned: r.totalReturned || 0,
                        netAmount: r.netAmount ?? r.totalBill,
                        returns: r.returns || [],
                        refundReason: r.refundReason,
                        refundedBy: r.refundedBy,
                        refundedAt: r.refundedAt,
                        isRestaurantOrder: false,
                    };
                });
            }

            // Sort by date descending
            mappedReceipts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            setReceipts(mappedReceipts);
            setFilteredReceipts(mappedReceipts);

            // Use stats endpoint for accurate totals (includes returns)
            try {
                const statsRes = await axios.get(`${API_BASE_URL}/receipt/stats`, { headers });
                const statsData = statsRes.data;

                setStats({
                    totalSales: statsData.netSales ?? statsData.totalSales ?? 0,
                    totalOrders: statsData.totalOrders ?? 0,
                    todaySales: statsData.netTodaySales ?? statsData.todaySales ?? 0,
                    todayOrders: statsData.todayOrders ?? 0,
                    monthSales: statsData.netMonthSales ?? statsData.monthSales ?? 0,
                    monthOrders: statsData.monthOrders ?? 0,
                });
            } catch (statsError) {
                console.log('Stats endpoint error, calculating locally:', statsError);
                // Fallback to local calculation
                const salesOnly = mappedReceipts.filter(r => !r.isRefundReceipt);
                const refundsOnly = mappedReceipts.filter(r => r.isRefundReceipt);
                const now = new Date();

                const todayData = salesOnly.filter(r => {
                    const d = new Date(r.createdAt);
                    return d.toDateString() === now.toDateString();
                });
                const monthData = salesOnly.filter(r => {
                    const d = new Date(r.createdAt);
                    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                });

                const todayRefunds = refundsOnly.filter(r => {
                    const d = new Date(r.createdAt);
                    return d.toDateString() === now.toDateString();
                });
                const monthRefunds = refundsOnly.filter(r => {
                    const d = new Date(r.createdAt);
                    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                });

                const todayLinkedReturns = todayData.reduce((sum, r) => sum + (r.totalReturned || 0), 0);
                const monthLinkedReturns = monthData.reduce((sum, r) => sum + (r.totalReturned || 0), 0);

                setStats({
                    totalSales: salesOnly.reduce((sum, r) => sum + r.totalBill, 0),
                    totalOrders: salesOnly.length,
                    todaySales: todayData.reduce((sum, r) => sum + r.totalBill, 0) - Math.abs(todayRefunds.reduce((sum, r) => sum + r.totalBill, 0)) - todayLinkedReturns,
                    todayOrders: todayData.length,
                    monthSales: monthData.reduce((sum, r) => sum + r.totalBill, 0) - Math.abs(monthRefunds.reduce((sum, r) => sum + r.totalBill, 0)) - monthLinkedReturns,
                    monthOrders: monthData.length,
                });
            }
        } catch (error) {
            console.log('Error fetching receipts:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const filterReceipts = () => {
        if (!searchQuery.trim()) {
            setFilteredReceipts(receipts);
            return;
        }

        const query = searchQuery.toLowerCase();
        const filtered = receipts.filter((r) => {
            const billMatch = (r.billNumber || '').toString().includes(query);
            const dateMatch = (r.date || '').toLowerCase().includes(query);
            const cashierMatch = (r.cashierName || '').toLowerCase().includes(query);
            const customerMatch = (r.customerName || '').toLowerCase().includes(query);
            const priceMatch = (r.totalBill || 0).toString().includes(query);
            return billMatch || dateMatch || cashierMatch || customerMatch || priceMatch;
        });

        setFilteredReceipts(filtered);
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchReceipts();
    };

    const formatCurrency = (amount) => {
        return `Rs. ${(amount || 0).toLocaleString()}`;
    };

    const openDetail = (order) => {
        setSelectedOrder(order);
        setShowDetail(true);
    };

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
            const token = await getToken();
            await axios.patch(`${API_BASE_URL}/order/${selectedOrder._id}/refund`, {
                reason: refundReason,
                amount: selectedOrder.totalBill,
            }, {
                headers: { Authorization: `Bearer ${token}` },
            });
            Alert.alert('Refund Processed', `${formatCurrency(selectedOrder.totalBill)} has been refunded`);
            setShowRefundModal(false);
            setShowDetail(false);
            fetchReceipts();
        } catch (error) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to process refund');
        } finally {
            setProcessing(false);
        }
    };

    const printReceipt = async (receipt) => {
        const itemsHtml = receipt.items?.map(item => `
            <tr>
                <td>${item.name}</td>
                <td style="text-align: center">${item.qty}</td>
                <td style="text-align: right">${item.price}</td>
            </tr>
        `).join('') || '';

        const html = `
        <html>
        <head>
            <style>
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
            </style>
        </head>
        <body>
            <div class="header">
                <h2>${businessData?.name || 'Business'}</h2>
                <p>${businessData?.address || ''}</p>
                <p>Receipt #${receipt.billNumber}</p>
            </div>
            <div class="divider"></div>
            <div class="info">
                <p>Date: ${receipt.date} ${receipt.time}</p>
                <p>Cashier: ${receipt.cashierName || 'N/A'}</p>
                <p>Customer: ${receipt.customerName || 'Walk-in'}</p>
            </div>
            <div class="divider"></div>
            <table>
                <thead>
                    <tr><th>Item</th><th>Qty</th><th style="text-align: right">Price</th></tr>
                </thead>
                <tbody>${itemsHtml}</tbody>
            </table>
            <div class="divider"></div>
            <div class="totals">
                <p><span>Subtotal:</span><span>${formatCurrency(receipt.totalBill - (receipt.totalGST || 0))}</span></p>
                <p><span>GST:</span><span>${formatCurrency(receipt.totalGST || 0)}</span></p>
                <p class="total-row"><span>Total:</span><span>${formatCurrency(receipt.totalBill)}</span></p>
                <p><span>Cash:</span><span>${formatCurrency(receipt.cashGiven || 0)}</span></p>
                <p><span>Change:</span><span>${formatCurrency((receipt.cashGiven || 0) - receipt.totalBill)}</span></p>
            </div>
            <div class="divider"></div>
            <div class="footer">
                <p>Thank you for your business!</p>
            </div>
        </body>
        </html>
        `;

        try {
            await Print.printAsync({ html });
        } catch (error) {
            console.log('Print error:', error);
        }
    };

    const StatCard = ({ title, value, icon, color }) => (
        <View style={[styles.statCard, { borderLeftColor: color }]}>
            <Ionicons name={icon} size={20} color={color} />
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statTitle}>{title}</Text>
        </View>
    );

    const ReceiptCard = ({ item }) => {
        const isReturn = item.isRefundReceipt;
        const hasLinkedReturns = item.hasReturns && !isReturn;
        const displayAmount = hasLinkedReturns ? (item.netAmount || 0) : Math.abs(item.totalBill || 0);

        return (
            <TouchableOpacity
                style={[
                    styles.receiptCard,
                    item.isRefunded && styles.receiptCardRefunded,
                    isReturn && styles.receiptCardReturn,
                    hasLinkedReturns && styles.receiptCardHasReturns
                ]}
                onPress={() => openDetail(item)}
                activeOpacity={0.7}
            >
                <View style={styles.receiptLeft}>
                    <View style={[
                        styles.receiptIconBg,
                        item.isRefunded ? styles.iconBgRefunded :
                        isReturn ? styles.iconBgReturn :
                        hasLinkedReturns ? styles.iconBgHasReturns :
                        { backgroundColor: themeColors.bg }
                    ]}>
                        <Ionicons
                            name={isReturn ? "arrow-undo-outline" : (item.isRefunded ? "return-down-back-outline" : "receipt-outline")}
                            size={20}
                            color={isReturn ? "#ef4444" : (item.isRefunded ? "#ef4444" : (hasLinkedReturns ? "#d97706" : themeColors.primary))}
                        />
                    </View>
                    <View style={styles.receiptInfo}>
                        <View style={styles.orderTitleRow}>
                            <Text style={[styles.receiptNumber, isReturn && { color: '#ef4444' }]}>
                                {isReturn ? 'Product Return' : (item.isRestaurantOrder ? 'Order' : 'Bill')} #{item.billNumber}
                            </Text>
                            {item.isRefunded && !isReturn && (
                                <View style={styles.refundedBadge}>
                                    <Text style={styles.refundedBadgeText}>REFUNDED</Text>
                                </View>
                            )}
                            {isReturn && (
                                <View style={styles.returnBadge}>
                                    <Text style={styles.returnBadgeText}>RETURN</Text>
                                </View>
                            )}
                            {hasLinkedReturns && (
                                <View style={styles.hasReturnsBadge}>
                                    <Text style={styles.hasReturnsBadgeText}>HAS RETURNS</Text>
                                </View>
                            )}
                        </View>
                        <Text style={styles.receiptCustomer}>
                            {item.customerName || 'Walk-in Customer'}
                        </Text>
                        <Text style={styles.receiptMeta}>
                            {item.cashierName || 'Staff'} • {item.date || 'N/A'}
                        </Text>
                    </View>
                </View>
                <View style={styles.receiptRight}>
                    {hasLinkedReturns && (
                        <Text style={styles.originalAmount}>
                            {formatCurrency(Math.abs(item.totalBill || 0))}
                        </Text>
                    )}
                    <Text style={[
                        styles.receiptAmount,
                        item.isRefunded && styles.amountRefunded,
                        isReturn && { color: '#ef4444' },
                        hasLinkedReturns && { color: '#d97706' }
                    ]}>
                        {isReturn ? '-' : ''}{formatCurrency(displayAmount)}
                    </Text>
                    <Text style={styles.receiptItems}>{item.totalQty} items</Text>
                    <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                </View>
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={themeColors.primary} />
                <Text style={styles.loadingText}>Loading sales...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#fff" />

            {/* Header */}
            <LinearGradient
                colors={[themeColors.primary, themeColors.secondary]}
                style={styles.header}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <View style={styles.headerContent}>
                    <Ionicons name="receipt-outline" size={28} color="#fff" />
                    <Text style={styles.headerTitle}>Sales & Reports</Text>
                </View>
            </LinearGradient>

            {/* Stats Row */}
            <View style={styles.statsContainer}>
                <StatCard
                    title="Today"
                    value={formatCurrency(stats.todaySales)}
                    icon="today-outline"
                    color="#10b981"
                />
                <StatCard
                    title="This Month"
                    value={formatCurrency(stats.monthSales)}
                    icon="calendar-outline"
                    color="#3b82f6"
                />
                <StatCard
                    title="Orders"
                    value={stats.monthOrders.toString()}
                    icon="cart-outline"
                    color="#f59e0b"
                />
            </View>

            {/* Search */}
            <View style={styles.searchContainer}>
                <View style={styles.searchBox}>
                    <Ionicons name="search" size={20} color="#94a3b8" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by invoice, date, cashier..."
                        placeholderTextColor="#94a3b8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={20} color="#94a3b8" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Results count */}
            <View style={styles.resultsHeader}>
                <Text style={styles.resultsText}>
                    {filteredReceipts.length} {filteredReceipts.length === 1 ? 'order' : 'orders'}
                </Text>
            </View>

            {/* Receipts List */}
            <FlatList
                data={filteredReceipts}
                keyExtractor={(item) => item._id || item.billNumber?.toString()}
                renderItem={({ item }) => <ReceiptCard item={item} />}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Ionicons name="receipt-outline" size={64} color={themeColors.primary + '40'} />
                        <Text style={styles.emptyTitle}>No receipts found</Text>
                        <Text style={styles.emptyText}>
                            {searchQuery ? 'Try a different search term' : 'Sales will appear here'}
                        </Text>
                    </View>
                }
            />

            {/* Order Detail Modal */}
            {selectedOrder && (
                <Modal visible={showDetail} animationType="slide" transparent>
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Order Details</Text>
                                <TouchableOpacity onPress={() => setShowDetail(false)}>
                                    <Ionicons name="close" size={24} color="#64748b" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView showsVerticalScrollIndicator={false}>
                                {/* Refunded Banner */}
                                {selectedOrder.isRefunded && (
                                    <View style={styles.refundBanner}>
                                        <Ionicons name="alert-circle" size={20} color="#ef4444" />
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.refundBannerTitle}>This order was refunded</Text>
                                            {selectedOrder.refundedBy && (
                                                <Text style={styles.refundBannerMeta}>
                                                    By: {selectedOrder.refundedBy}
                                                </Text>
                                            )}
                                            {selectedOrder.refundedAt && (
                                                <Text style={styles.refundBannerMeta}>
                                                    On: {new Date(selectedOrder.refundedAt).toLocaleDateString()} {new Date(selectedOrder.refundedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </Text>
                                            )}
                                            <Text style={styles.refundBannerReason}>
                                                Reason: {selectedOrder.refundReason || 'Not specified'}
                                            </Text>
                                        </View>
                                    </View>
                                )}

                                {/* Order Info */}
                                <View style={styles.detailSection}>
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>Order Number</Text>
                                        <Text style={styles.detailValue}>#{selectedOrder.billNumber}</Text>
                                    </View>
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>Date</Text>
                                        <Text style={styles.detailValue}>{selectedOrder.date} {selectedOrder.time}</Text>
                                    </View>
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>Customer</Text>
                                        <Text style={styles.detailValue}>{selectedOrder.customerName || 'Walk-in'}</Text>
                                    </View>
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>Cashier</Text>
                                        <Text style={styles.detailValue}>{selectedOrder.cashierName || 'Staff'}</Text>
                                    </View>
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>Payment</Text>
                                        <Text style={styles.detailValue}>{selectedOrder.paymentMethod || 'cash'}</Text>
                                    </View>
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>Status</Text>
                                        <Text style={[styles.detailValue, selectedOrder.isRefunded ? styles.statusRefunded : styles.statusPaid]}>
                                            {selectedOrder.isRefunded ? 'Refunded' : 'Paid'}
                                        </Text>
                                    </View>
                                </View>

                                {/* Items */}
                                <Text style={styles.itemsTitle}>Items ({selectedOrder.items?.length})</Text>
                                {selectedOrder.items?.map((item, index) => (
                                    <View key={index} style={styles.itemRow}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.itemName}>{item.name}</Text>
                                            <Text style={styles.itemQty}>x{item.qty}</Text>
                                        </View>
                                        <Text style={styles.itemPrice}>{formatCurrency(item.price)}</Text>
                                    </View>
                                ))}

                                {/* Summary */}
                                <View style={styles.summarySection}>
                                    <View style={styles.summaryRow}>
                                        <Text style={styles.summaryLabel}>Subtotal</Text>
                                        <Text style={styles.summaryValue}>
                                            {formatCurrency(selectedOrder.totalBill - (selectedOrder.totalGST || 0))}
                                        </Text>
                                    </View>
                                    <View style={styles.summaryRow}>
                                        <Text style={styles.summaryLabel}>Tax (GST)</Text>
                                        <Text style={styles.summaryValue}>{formatCurrency(selectedOrder.totalGST)}</Text>
                                    </View>
                                    <View style={[styles.summaryRow, styles.totalRow]}>
                                        <Text style={styles.totalLabel}>Total</Text>
                                        <Text style={[styles.totalValue, selectedOrder.isRefunded && styles.totalRefunded]}>
                                            {formatCurrency(selectedOrder.totalBill)}
                                        </Text>
                                    </View>
                                    {selectedOrder.cashGiven > 0 && (
                                        <>
                                            <View style={styles.summaryRow}>
                                                <Text style={styles.summaryLabel}>Cash Given</Text>
                                                <Text style={styles.summaryValue}>{formatCurrency(selectedOrder.cashGiven)}</Text>
                                            </View>
                                            <View style={styles.summaryRow}>
                                                <Text style={styles.summaryLabel}>Change</Text>
                                                <Text style={styles.summaryValue}>
                                                    {formatCurrency((selectedOrder.cashGiven || 0) - selectedOrder.totalBill)}
                                                </Text>
                                            </View>
                                        </>
                                    )}
                                </View>

                                {/* Action Buttons */}
                                <View style={styles.actionButtons}>
                                    <TouchableOpacity
                                        style={styles.printButton}
                                        onPress={() => printReceipt(selectedOrder)}
                                    >
                                        <Ionicons name="print" size={20} color="#fff" />
                                        <Text style={styles.printButtonText}>Print Receipt</Text>
                                    </TouchableOpacity>
                                    {!selectedOrder.isRefunded && (
                                        <TouchableOpacity
                                            style={styles.refundButton}
                                            onPress={handleRefund}
                                        >
                                            <Ionicons name="return-down-back" size={20} color="#fff" />
                                            <Text style={styles.refundButtonText}>Process Refund</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            )}

            {/* Refund Modal */}
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
                                    {formatCurrency(selectedOrder?.totalBill)}
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
        </View>
    );
};

export default Sales;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#64748b',
    },
    header: {
        paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 0) + 20,
        paddingBottom: 20,
        paddingHorizontal: 20,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#fff',
    },
    statsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 16,
        gap: 10,
    },
    statCard: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 12,
        alignItems: 'center',
        borderLeftWidth: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    statValue: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1e293b',
        marginTop: 6,
    },
    statTitle: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2,
    },
    searchContainer: {
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        paddingHorizontal: 14,
        height: 48,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        marginLeft: 10,
        color: '#1e293b',
    },
    resultsHeader: {
        paddingHorizontal: 16,
        paddingBottom: 8,
    },
    resultsText: {
        fontSize: 13,
        color: '#64748b',
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 100,
    },
    receiptCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
    },
    receiptLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    receiptIconBg: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#ecfeff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    receiptInfo: {
        marginLeft: 12,
        flex: 1,
    },
    receiptNumber: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1e293b',
    },
    receiptCustomer: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 2,
    },
    receiptMeta: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 2,
    },
    receiptRight: {
        alignItems: 'flex-end',
    },
    receiptAmount: {
        fontSize: 16,
        fontWeight: '700',
        color: '#10b981',
    },
    receiptItems: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 2,
        marginBottom: 4,
    },
    receiptCardRefunded: {
        backgroundColor: '#fef2f2',
        borderWidth: 1,
        borderColor: '#fecaca',
    },
    receiptCardReturn: {
        backgroundColor: '#fef2f2',
        borderWidth: 1,
        borderColor: '#fecaca',
    },
    receiptCardHasReturns: {
        backgroundColor: '#fffbeb',
        borderWidth: 1,
        borderColor: '#fde68a',
    },
    iconBgRefunded: {
        backgroundColor: '#fee2e2',
    },
    iconBgReturn: {
        backgroundColor: '#fee2e2',
    },
    iconBgHasReturns: {
        backgroundColor: '#fef3c7',
    },
    orderTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
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
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#64748b',
        marginTop: 16,
    },
    emptyText: {
        fontSize: 14,
        color: '#94a3b8',
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
    refundBanner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#fef2f2',
        padding: 16,
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#fecaca',
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
    statusPaid: {
        color: '#10b981',
        fontWeight: '600',
    },
    statusRefunded: {
        color: '#ef4444',
        fontWeight: '600',
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
    totalRefunded: {
        color: '#ef4444',
        textDecorationLine: 'line-through',
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
    // Refund modal
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
});
