import React, { useState, useEffect, useCallback } from 'react';
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Platform,
    StatusBar,
    RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import api from '../../../constants/api';
import * as Print from 'expo-print';

const DailyReports = ({ navigation, businessType }) => {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [reportData, setReportData] = useState({
        totalSales: 0,
        totalOrders: 0,
        totalItems: 0,
        averageOrderValue: 0,
        paymentBreakdown: { cash: 0, card: 0, upi: 0 },
        refunds: { count: 0, total: 0 },
        topItems: [],
        salesByHour: [],
        employees: [],
    });

    useFocusEffect(
        useCallback(() => {
            loadReportData();
        }, [selectedDate])
    );

    const loadReportData = async () => {
        try {
            // Get orders for the selected date
            const response = await api.get('/order');
            const allOrders = response.data || [];

            // Filter orders for the selected date
            const startOfDay = new Date(selectedDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(selectedDate);
            endOfDay.setHours(23, 59, 59, 999);

            const dayOrders = allOrders.filter(order => {
                const orderDate = new Date(order.createdAt);
                return orderDate >= startOfDay && orderDate <= endOfDay;
            });

            // Calculate stats
            const paidOrders = dayOrders.filter(o => o.paymentStatus === 'paid');
            const refundedOrders = dayOrders.filter(o => o.paymentStatus === 'refunded');

            const totalSales = paidOrders.reduce((sum, o) => sum + (o.total || 0), 0);
            const totalOrders = paidOrders.length;
            const totalItems = paidOrders.reduce((sum, o) =>
                sum + (o.items?.reduce((s, i) => s + (i.quantity || 1), 0) || 0), 0
            );
            const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

            // Payment breakdown
            const paymentBreakdown = {
                cash: paidOrders.filter(o => o.paymentMethod === 'cash').reduce((s, o) => s + o.total, 0),
                card: paidOrders.filter(o => o.paymentMethod === 'card').reduce((s, o) => s + o.total, 0),
                upi: paidOrders.filter(o => o.paymentMethod === 'upi').reduce((s, o) => s + o.total, 0),
            };

            // Refunds
            const refunds = {
                count: refundedOrders.length,
                total: refundedOrders.reduce((s, o) => s + (o.refundAmount || o.total || 0), 0),
            };

            // Top items
            const itemCounts = {};
            paidOrders.forEach(order => {
                order.items?.forEach(item => {
                    const key = item.name;
                    if (!itemCounts[key]) {
                        itemCounts[key] = { name: item.name, quantity: 0, revenue: 0 };
                    }
                    itemCounts[key].quantity += item.quantity || 1;
                    itemCounts[key].revenue += (item.price || 0) * (item.quantity || 1);
                });
            });
            const topItems = Object.values(itemCounts)
                .sort((a, b) => b.quantity - a.quantity)
                .slice(0, 5);

            // Sales by hour
            const salesByHour = Array(24).fill(0);
            paidOrders.forEach(order => {
                const hour = new Date(order.createdAt).getHours();
                salesByHour[hour] += order.total || 0;
            });

            // Employee performance
            const employeeStats = {};
            paidOrders.forEach(order => {
                const employeeId = order.paidBy?._id || order.createdBy?._id || 'unknown';
                const employeeName = order.paidBy?.name || order.createdBy?.name || 'Unknown';
                if (!employeeStats[employeeId]) {
                    employeeStats[employeeId] = { name: employeeName, orders: 0, sales: 0 };
                }
                employeeStats[employeeId].orders++;
                employeeStats[employeeId].sales += order.total || 0;
            });
            const employees = Object.values(employeeStats).sort((a, b) => b.sales - a.sales);

            setReportData({
                totalSales,
                totalOrders,
                totalItems,
                averageOrderValue,
                paymentBreakdown,
                refunds,
                topItems,
                salesByHour,
                employees,
            });
        } catch (error) {
            console.error('Error loading report data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadReportData();
    };

    const changeDate = (days) => {
        const newDate = new Date(selectedDate);
        newDate.setDate(newDate.getDate() + days);
        if (newDate <= new Date()) {
            setSelectedDate(newDate);
            setLoading(true);
        }
    };

    const formatDate = (date) => {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) return 'Today';
        if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
        return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    };

    const generateReportHTML = () => {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Daily Report - ${formatDate(selectedDate)}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
                    h1 { color: #1e293b; border-bottom: 2px solid #f97316; padding-bottom: 10px; }
                    .summary { display: flex; flex-wrap: wrap; gap: 20px; margin: 20px 0; }
                    .stat-card { background: #f8fafc; padding: 15px; border-radius: 8px; flex: 1; min-width: 150px; }
                    .stat-value { font-size: 24px; font-weight: bold; color: #f97316; }
                    .stat-label { font-size: 14px; color: #64748b; }
                    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e2e8f0; }
                    th { background: #f8fafc; font-weight: 600; }
                    .section-title { font-size: 18px; font-weight: 600; margin-top: 30px; color: #1e293b; }
                </style>
            </head>
            <body>
                <h1>Daily Sales Report</h1>
                <p>${formatDate(selectedDate)} - ${selectedDate.toLocaleDateString()}</p>

                <div class="summary">
                    <div class="stat-card">
                        <div class="stat-value">Rs. ${reportData.totalSales.toLocaleString()}</div>
                        <div class="stat-label">Total Sales</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${reportData.totalOrders}</div>
                        <div class="stat-label">Orders</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${reportData.totalItems}</div>
                        <div class="stat-label">Items Sold</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">Rs. ${Math.round(reportData.averageOrderValue)}</div>
                        <div class="stat-label">Avg Order Value</div>
                    </div>
                </div>

                <div class="section-title">Payment Breakdown</div>
                <table>
                    <tr><th>Method</th><th>Amount</th></tr>
                    <tr><td>Cash</td><td>Rs. ${reportData.paymentBreakdown.cash.toLocaleString()}</td></tr>
                    <tr><td>Card</td><td>Rs. ${reportData.paymentBreakdown.card.toLocaleString()}</td></tr>
                    <tr><td>UPI</td><td>Rs. ${reportData.paymentBreakdown.upi.toLocaleString()}</td></tr>
                </table>

                ${reportData.refunds.count > 0 ? `
                    <div class="section-title">Refunds</div>
                    <p>${reportData.refunds.count} refund(s) totaling Rs. ${reportData.refunds.total.toLocaleString()}</p>
                ` : ''}

                <div class="section-title">Top Selling Items</div>
                <table>
                    <tr><th>Item</th><th>Qty Sold</th><th>Revenue</th></tr>
                    ${reportData.topItems.map(item => `
                        <tr>
                            <td>${item.name}</td>
                            <td>${item.quantity}</td>
                            <td>Rs. ${item.revenue.toLocaleString()}</td>
                        </tr>
                    `).join('')}
                </table>

                ${reportData.employees.length > 0 ? `
                    <div class="section-title">Employee Performance</div>
                    <table>
                        <tr><th>Employee</th><th>Orders</th><th>Sales</th></tr>
                        ${reportData.employees.map(emp => `
                            <tr>
                                <td>${emp.name}</td>
                                <td>${emp.orders}</td>
                                <td>Rs. ${emp.sales.toLocaleString()}</td>
                            </tr>
                        `).join('')}
                    </table>
                ` : ''}
            </body>
            </html>
        `;
    };

    const printReport = async () => {
        try {
            const html = generateReportHTML();
            await Print.printAsync({ html });
        } catch (error) {
            console.error('Print error:', error);
        }
    };

    const getAccentColor = () => {
        switch (businessType) {
            case 'service': return ['#06b6d4', '#0891b2'];
            case 'retail': return ['#8b5cf6', '#7c3aed'];
            default: return ['#f97316', '#ea580c'];
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#f97316" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* Header */}
            <LinearGradient colors={getAccentColor()} style={styles.header}>
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Daily Reports</Text>
                    <TouchableOpacity onPress={printReport} style={styles.printBtn}>
                        <Ionicons name="print-outline" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>

                {/* Date Selector */}
                <View style={styles.dateSelector}>
                    <TouchableOpacity onPress={() => changeDate(-1)} style={styles.dateArrow}>
                        <Ionicons name="chevron-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <View style={styles.dateDisplay}>
                        <Text style={styles.dateText}>{formatDate(selectedDate)}</Text>
                        <Text style={styles.dateSubtext}>{selectedDate.toLocaleDateString()}</Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => changeDate(1)}
                        style={styles.dateArrow}
                        disabled={selectedDate.toDateString() === new Date().toDateString()}
                    >
                        <Ionicons
                            name="chevron-forward"
                            size={24}
                            color={selectedDate.toDateString() === new Date().toDateString() ? 'rgba(255,255,255,0.3)' : '#fff'}
                        />
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            <ScrollView
                style={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {/* Summary Cards */}
                <View style={styles.summaryGrid}>
                    <View style={styles.summaryCard}>
                        <Ionicons name="cash-outline" size={24} color="#10b981" />
                        <Text style={styles.summaryValue}>Rs. {reportData.totalSales.toLocaleString()}</Text>
                        <Text style={styles.summaryLabel}>Total Sales</Text>
                    </View>
                    <View style={styles.summaryCard}>
                        <Ionicons name="receipt-outline" size={24} color="#3b82f6" />
                        <Text style={styles.summaryValue}>{reportData.totalOrders}</Text>
                        <Text style={styles.summaryLabel}>Orders</Text>
                    </View>
                    <View style={styles.summaryCard}>
                        <Ionicons name="fast-food-outline" size={24} color="#f97316" />
                        <Text style={styles.summaryValue}>{reportData.totalItems}</Text>
                        <Text style={styles.summaryLabel}>Items Sold</Text>
                    </View>
                    <View style={styles.summaryCard}>
                        <Ionicons name="trending-up" size={24} color="#8b5cf6" />
                        <Text style={styles.summaryValue}>Rs. {Math.round(reportData.averageOrderValue)}</Text>
                        <Text style={styles.summaryLabel}>Avg Order</Text>
                    </View>
                </View>

                {/* Payment Breakdown */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Payment Methods</Text>
                    <View style={styles.paymentCard}>
                        <View style={styles.paymentRow}>
                            <View style={styles.paymentLabel}>
                                <Ionicons name="cash" size={20} color="#10b981" />
                                <Text style={styles.paymentText}>Cash</Text>
                            </View>
                            <Text style={styles.paymentAmount}>Rs. {reportData.paymentBreakdown.cash.toLocaleString()}</Text>
                        </View>
                        <View style={styles.paymentRow}>
                            <View style={styles.paymentLabel}>
                                <Ionicons name="card" size={20} color="#3b82f6" />
                                <Text style={styles.paymentText}>Card</Text>
                            </View>
                            <Text style={styles.paymentAmount}>Rs. {reportData.paymentBreakdown.card.toLocaleString()}</Text>
                        </View>
                        <View style={styles.paymentRow}>
                            <View style={styles.paymentLabel}>
                                <Ionicons name="phone-portrait" size={20} color="#8b5cf6" />
                                <Text style={styles.paymentText}>UPI</Text>
                            </View>
                            <Text style={styles.paymentAmount}>Rs. {reportData.paymentBreakdown.upi.toLocaleString()}</Text>
                        </View>
                    </View>
                </View>

                {/* Refunds */}
                {reportData.refunds.count > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Refunds</Text>
                        <View style={styles.refundCard}>
                            <View style={styles.refundStat}>
                                <Text style={styles.refundValue}>{reportData.refunds.count}</Text>
                                <Text style={styles.refundLabel}>Refunds</Text>
                            </View>
                            <View style={styles.refundStat}>
                                <Text style={styles.refundValueRed}>Rs. {reportData.refunds.total.toLocaleString()}</Text>
                                <Text style={styles.refundLabel}>Total Amount</Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* Top Items */}
                {reportData.topItems.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Top Selling Items</Text>
                        <View style={styles.itemsCard}>
                            {reportData.topItems.map((item, index) => (
                                <View key={index} style={styles.topItemRow}>
                                    <View style={styles.topItemRank}>
                                        <Text style={styles.rankText}>{index + 1}</Text>
                                    </View>
                                    <View style={styles.topItemInfo}>
                                        <Text style={styles.topItemName}>{item.name}</Text>
                                        <Text style={styles.topItemQty}>{item.quantity} sold</Text>
                                    </View>
                                    <Text style={styles.topItemRevenue}>Rs. {item.revenue.toLocaleString()}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* Employee Performance */}
                {reportData.employees.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Employee Performance</Text>
                        <View style={styles.employeesCard}>
                            {reportData.employees.map((emp, index) => (
                                <View key={index} style={styles.employeeRow}>
                                    <View style={styles.employeeInfo}>
                                        <Ionicons name="person-circle" size={36} color="#94a3b8" />
                                        <View>
                                            <Text style={styles.employeeName}>{emp.name}</Text>
                                            <Text style={styles.employeeOrders}>{emp.orders} orders</Text>
                                        </View>
                                    </View>
                                    <Text style={styles.employeeSales}>Rs. {emp.sales.toLocaleString()}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* Empty State */}
                {reportData.totalOrders === 0 && (
                    <View style={styles.emptyState}>
                        <Ionicons name="calendar-outline" size={64} color="#cbd5e1" />
                        <Text style={styles.emptyTitle}>No Sales Data</Text>
                        <Text style={styles.emptyText}>No orders recorded for this day</Text>
                    </View>
                )}

                <View style={{ height: 100 }} />
            </ScrollView>
        </View>
    );
};

export default DailyReports;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
    },
    header: {
        paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight + 10,
        paddingBottom: 20,
        paddingHorizontal: 16,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
    },
    printBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    dateSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
    },
    dateArrow: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    dateDisplay: {
        alignItems: 'center',
    },
    dateText: {
        fontSize: 24,
        fontWeight: '700',
        color: '#fff',
    },
    dateSubtext: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    summaryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 20,
    },
    summaryCard: {
        flex: 1,
        minWidth: '45%',
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    summaryValue: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1e293b',
        marginTop: 8,
    },
    summaryLabel: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 4,
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1e293b',
        marginBottom: 12,
    },
    paymentCard: {
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 16,
    },
    paymentRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    paymentLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    paymentText: {
        fontSize: 15,
        color: '#1e293b',
    },
    paymentAmount: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1e293b',
    },
    refundCard: {
        flexDirection: 'row',
        backgroundColor: '#fef2f2',
        borderRadius: 14,
        padding: 16,
    },
    refundStat: {
        flex: 1,
        alignItems: 'center',
    },
    refundValue: {
        fontSize: 24,
        fontWeight: '700',
        color: '#1e293b',
    },
    refundValueRed: {
        fontSize: 24,
        fontWeight: '700',
        color: '#ef4444',
    },
    refundLabel: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 4,
    },
    itemsCard: {
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 16,
    },
    topItemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    topItemRank: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#f97316',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    rankText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#fff',
    },
    topItemInfo: {
        flex: 1,
    },
    topItemName: {
        fontSize: 15,
        fontWeight: '500',
        color: '#1e293b',
    },
    topItemQty: {
        fontSize: 13,
        color: '#64748b',
    },
    topItemRevenue: {
        fontSize: 15,
        fontWeight: '600',
        color: '#10b981',
    },
    employeesCard: {
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 16,
    },
    employeeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    employeeInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    employeeName: {
        fontSize: 15,
        fontWeight: '500',
        color: '#1e293b',
    },
    employeeOrders: {
        fontSize: 13,
        color: '#64748b',
    },
    employeeSales: {
        fontSize: 16,
        fontWeight: '600',
        color: '#10b981',
    },
    emptyState: {
        alignItems: 'center',
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
});
