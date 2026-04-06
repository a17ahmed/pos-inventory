import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Platform,
    StatusBar,
    Dimensions,
    RefreshControl,
    Modal,
    Animated,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LineChart, BarChart } from 'react-native-chart-kit';
import api from '../../constants/api';

import { colors, shadows, getBusinessConfig } from '../../constants/theme';

const { width } = Dimensions.get('window');
const chartWidth = width - 32;

// Skeleton Component
const Skeleton = ({ width: w, height: h, borderRadius = 8, style }) => {
    const animatedValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(animatedValue, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(animatedValue, {
                    toValue: 0,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        );
        animation.start();
        return () => animation.stop();
    }, []);

    const opacity = animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.7],
    });

    return (
        <Animated.View
            style={[
                {
                    width: w,
                    height: h,
                    borderRadius,
                    backgroundColor: '#e2e8f0',
                    opacity,
                },
                style,
            ]}
        />
    );
};

const InsightsScreen = ({ navigation }) => {

    const [loading, setLoading] = useState(true);
    const [dataLoading, setDataLoading] = useState(false); // For filter changes
    const [refreshing, setRefreshing] = useState(false);
    const [businessData, setBusinessData] = useState(null);
    const [businessConfig, setBusinessConfig] = useState(null);

    // Filter state - default to month to match dashboard
    const [timeFilter, setTimeFilter] = useState('month'); // week, month, 3months, year, custom

    // Custom date range state
    const [customStartDate, setCustomStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 7)));
    const [customEndDate, setCustomEndDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [datePickerMode, setDatePickerMode] = useState('start'); // 'start' or 'end'
    const [showDateModal, setShowDateModal] = useState(false);

    // Data
    const [salesData, setSalesData] = useState({ labels: [], datasets: [{ data: [0] }] });
    const [ordersData, setOrdersData] = useState({ labels: [], datasets: [{ data: [0] }] });
    const [topItems, setTopItems] = useState([]);
    const [employeeStats, setEmployeeStats] = useState([]);
    const [summaryStats, setSummaryStats] = useState({
        totalSales: 0,
        totalOrders: 0,
        avgOrderValue: 0,
        growth: 0,
    });

    // P&L Data
    const [expenseStats, setExpenseStats] = useState(null);
    const [profitLoss, setProfitLoss] = useState({
        grossRevenue: 0,
        returns: 0,
        netRevenue: 0,
        costOfGoods: 0,          // COGS - sum of cost prices
        grossProfit: 0,          // Net Revenue - COGS
        grossProfitMargin: 0,    // Gross Profit / Net Revenue %
        totalExpenses: 0,
        netProfit: 0,
        profitMargin: 0,
    });

    useEffect(() => {
        loadBusinessData();
    }, []);

    useFocusEffect(
        useCallback(() => {
            StatusBar.setBarStyle('light-content');
            if (businessData) {
                fetchInsightsData();
            }
            return () => {};
        }, [businessData, timeFilter, customStartDate, customEndDate])
    );

    const loadBusinessData = async () => {
        try {
            const businessStr = await AsyncStorage.getItem('business');
            if (businessStr) {
                const business = JSON.parse(businessStr);
                setBusinessData(business);
                setBusinessConfig(getBusinessConfig(business.businessType?.code || 'restaurant'));
            }
        } catch (error) {
            console.log('Error loading business data:', error);
        }
    };


    const getDateRange = () => {
        const now = new Date();
        let startDate = new Date();

        switch (timeFilter) {
            case 'week':
                // Last 7 days
                startDate.setDate(now.getDate() - 7);
                startDate.setHours(0, 0, 0, 0);
                break;
            case 'month':
                // Current calendar month (same as Dashboard's "This Month")
                startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
                break;
            case '3months':
                // Last 3 calendar months
                startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0);
                break;
            case 'year':
                // Last 12 months
                startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1, 0, 0, 0, 0);
                break;
            case 'custom':
                // Custom date range
                return { startDate: customStartDate, endDate: customEndDate };
        }

        return { startDate, endDate: now };
    };

    const fetchInsightsData = async () => {
        setDataLoading(true);
        try {
            const { startDate, endDate } = getDateRange();

            console.log('Insights: Fetching data for range:', startDate, 'to', endDate);

            // Fetch all receipts using api module (single source of truth for financial data)
            // Use all=true to get all receipts for analytics (no pagination limit)
            const receiptsRes = await api.get('/receipt?all=true');
            // Handle both old (array) and new (object with receipts) response formats
            const allReceipts = receiptsRes.data?.receipts || receiptsRes.data || [];

            console.log('Insights: Total receipts fetched:', allReceipts.length);

            // Filter by date range
            const filteredReceipts = allReceipts.filter(r => {
                const receiptDate = new Date(r.createdAt);
                return receiptDate >= startDate && receiptDate <= endDate;
            });

            console.log('Insights: Receipts in date range:', filteredReceipts.length);

            // Map to transactions (receipts have totalBill, refunds have negative amounts)
            const allTransactions = filteredReceipts.map(r => ({
                _id: r._id,
                total: r.totalBill || 0,
                date: new Date(r.createdAt),
                items: r.items || [],
                createdBy: r.cashierId,
                cashierName: r.cashierName,
                isRefund: r.receiptType?.includes('_refund') || false,
            }));

            // Calculate summary stats (refunds have negative amounts, so they naturally subtract)
            const totalSales = allTransactions.reduce((sum, t) => sum + (t.total || 0), 0);
            // Count only non-refund transactions
            const totalOrders = allTransactions.filter(t => !t.isRefund).length;
            const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

            console.log('Insights: Total sales:', totalSales, 'Total orders:', totalOrders);

            // Calculate growth (compare to previous period)
            const periodLength = endDate.getTime() - startDate.getTime();
            const previousStartDate = new Date(startDate.getTime() - periodLength);

            const previousReceipts = allReceipts.filter(r => {
                const receiptDate = new Date(r.createdAt);
                return receiptDate >= previousStartDate && receiptDate < startDate;
            });

            const previousSales = previousReceipts.reduce((sum, r) => sum + (r.totalBill || 0), 0);
            const growth = previousSales > 0
                ? ((totalSales - previousSales) / previousSales) * 100
                : (totalSales > 0 ? 100 : 0);

            setSummaryStats({ totalSales, totalOrders, avgOrderValue, growth });

            // Generate chart data
            generateChartData(allTransactions, startDate, endDate);

            // Top selling items (skip refund transactions for item counts)
            const itemCounts = {};
            allTransactions.filter(t => !t.isRefund).forEach(transaction => {
                (transaction.items || []).forEach(item => {
                    const name = item.name || 'Unknown';
                    if (!itemCounts[name]) {
                        itemCounts[name] = { name, quantity: 0, revenue: 0 };
                    }
                    itemCounts[name].quantity += item.qty || item.quantity || 1;
                    itemCounts[name].revenue += (item.price || 0) * (item.qty || item.quantity || 1);
                });
            });

            const topItemsList = Object.values(itemCounts)
                .sort((a, b) => b.quantity - a.quantity)
                .slice(0, 5);
            setTopItems(topItemsList);

            // Get employee performance (based on cashier who processed the sale)
            try {
                const employeesRes = await api.get('/employee');
                const employees = employeesRes.data || [];

                const employeePerformance = employees.map(emp => {
                    // Filter transactions where this employee was the cashier (skip refunds)
                    const empTransactions = allTransactions.filter(t =>
                        !t.isRefund && (
                            t.createdBy === emp._id ||
                            t.createdBy?._id === emp._id ||
                            String(t.createdBy) === String(emp._id)
                        )
                    );
                    const empSales = empTransactions.reduce((sum, t) => sum + (t.total || 0), 0);
                    return {
                        name: emp.name,
                        orders: empTransactions.length,
                        sales: empSales,
                    };
                }).filter(e => e.orders > 0)
                  .sort((a, b) => b.sales - a.sales)
                  .slice(0, 5);

                setEmployeeStats(employeePerformance);
            } catch (e) {
                console.log('Error fetching employees:', e);
            }

            // Fetch expense stats for P&L calculation
            try {
                const expenseRes = await api.get('/expense/stats', {
                    params: {
                        startDate: startDate.toISOString(),
                        endDate: endDate.toISOString()
                    }
                });
                const expenseData = expenseRes.data;
                setExpenseStats(expenseData);

                // Calculate refunds from TWO sources:
                // 1. Refund receipts (negative totalBill with receiptType containing '_refund')
                const refundReceipts = allTransactions.filter(t => t.isRefund);
                const refundReceiptsTotal = Math.abs(refundReceipts.reduce((sum, t) => sum + (t.total || 0), 0));

                // 2. Linked returns on original receipts (totalReturned field)
                const linkedReturns = filteredReceipts
                    .filter(r => !r.receiptType?.includes('_refund'))
                    .reduce((sum, r) => sum + (r.totalReturned || 0), 0);

                // Total returns = refund receipts + linked returns
                const totalRefunds = refundReceiptsTotal + linkedReturns;

                // Calculate gross sales (positive transactions only, before any returns)
                // For receipts with linked returns, use original totalBill (not netAmount)
                const salesReceipts = filteredReceipts.filter(r => !r.receiptType?.includes('_refund'));
                const grossRevenue = salesReceipts.reduce((sum, r) => sum + (r.totalBill || 0), 0);

                // Calculate Cost of Goods Sold from receipts
                const costOfGoods = salesReceipts.reduce((sum, r) => sum + (r.totalCostOfGoods || 0), 0);

                const netRevenue = grossRevenue - totalRefunds;
                const grossProfit = netRevenue - costOfGoods;
                const grossProfitMargin = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;
                const totalExpenses = expenseData.totalExpenses || 0;
                const netProfit = grossProfit - totalExpenses;
                const profitMargin = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;

                setProfitLoss({
                    grossRevenue,
                    returns: totalRefunds,
                    netRevenue,
                    costOfGoods,
                    grossProfit,
                    grossProfitMargin,
                    totalExpenses,
                    netProfit,
                    profitMargin,
                });
            } catch (e) {
                console.log('Error fetching expense stats:', e);
            }

        } catch (error) {
            console.log('Error fetching insights:', error);
        } finally {
            setLoading(false);
            setDataLoading(false);
            setRefreshing(false);
        }
    };

    const generateChartData = (transactions, startDate, endDate) => {
        const labels = [];
        const salesValues = [];
        const orderCounts = [];

        // Use timeFilter directly to determine grouping
        if (timeFilter === 'week') {
            // Group by day for last 7 days - show Mon, Tue, Wed, etc.
            for (let i = 0; i < 7; i++) {
                const date = new Date(startDate);
                date.setDate(startDate.getDate() + i);
                const dayName = date.toLocaleDateString('en', { weekday: 'short' });
                labels.push(dayName);

                const dayTransactions = transactions.filter(t => {
                    const tDate = t.date || new Date(t.createdAt);
                    return tDate.toDateString() === date.toDateString();
                });

                salesValues.push(dayTransactions.reduce((sum, t) => sum + (t.total || 0), 0));
                orderCounts.push(dayTransactions.length);
            }
        } else if (timeFilter === 'month') {
            // Group by week for current month - only show weeks up to today
            const now = new Date();
            const dayOfMonth = now.getDate();
            const weeksToShow = Math.ceil(dayOfMonth / 7); // How many weeks have passed

            for (let i = 0; i < weeksToShow; i++) {
                const weekStart = new Date(startDate);
                weekStart.setDate(startDate.getDate() + (i * 7));
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekStart.getDate() + 7);

                // Limit weekEnd to today if it's in the future
                const effectiveEnd = weekEnd > now ? now : weekEnd;

                labels.push(`W${i + 1}`);

                const weekTransactions = transactions.filter(t => {
                    const tDate = t.date || new Date(t.createdAt);
                    return tDate >= weekStart && tDate <= effectiveEnd;
                });

                salesValues.push(weekTransactions.reduce((sum, t) => sum + (t.total || 0), 0));
                orderCounts.push(weekTransactions.length);
            }
        } else if (timeFilter === '3months') {
            // Group by month for 3 months
            for (let i = 0; i < 3; i++) {
                const monthStart = new Date(startDate);
                monthStart.setMonth(startDate.getMonth() + i);
                const monthName = monthStart.toLocaleDateString('en', { month: 'short' });
                labels.push(monthName);

                const monthTransactions = transactions.filter(t => {
                    const tDate = t.date || new Date(t.createdAt);
                    return tDate.getMonth() === monthStart.getMonth() &&
                           tDate.getFullYear() === monthStart.getFullYear();
                });

                salesValues.push(monthTransactions.reduce((sum, t) => sum + (t.total || 0), 0));
                orderCounts.push(monthTransactions.length);
            }
        } else if (timeFilter === 'year') {
            // Year - group by month
            for (let i = 0; i < 12; i++) {
                const monthStart = new Date(startDate);
                monthStart.setMonth(startDate.getMonth() + i);
                const monthName = monthStart.toLocaleDateString('en', { month: 'short' });
                labels.push(monthName);

                const monthTransactions = transactions.filter(t => {
                    const tDate = t.date || new Date(t.createdAt);
                    return tDate.getMonth() === monthStart.getMonth() &&
                           tDate.getFullYear() === monthStart.getFullYear();
                });

                salesValues.push(monthTransactions.reduce((sum, t) => sum + (t.total || 0), 0));
                orderCounts.push(monthTransactions.length);
            }
        } else if (timeFilter === 'custom') {
            // Custom - determine grouping based on date range
            const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

            if (daysDiff <= 14) {
                // Show by day
                for (let i = 0; i <= daysDiff; i++) {
                    const date = new Date(startDate);
                    date.setDate(startDate.getDate() + i);
                    const dayLabel = date.toLocaleDateString('en', { day: 'numeric', month: 'short' });
                    labels.push(dayLabel);

                    const dayTransactions = transactions.filter(t => {
                        const tDate = t.date || new Date(t.createdAt);
                        return tDate.toDateString() === date.toDateString();
                    });

                    salesValues.push(dayTransactions.reduce((sum, t) => sum + (t.total || 0), 0));
                    orderCounts.push(dayTransactions.length);
                }
            } else if (daysDiff <= 60) {
                // Show by week
                const weeks = Math.ceil(daysDiff / 7);
                for (let i = 0; i < weeks; i++) {
                    const weekStart = new Date(startDate);
                    weekStart.setDate(startDate.getDate() + (i * 7));
                    const weekLabel = weekStart.toLocaleDateString('en', { day: 'numeric', month: 'short' });
                    labels.push(weekLabel);

                    const weekEnd = new Date(weekStart);
                    weekEnd.setDate(weekStart.getDate() + 7);

                    const weekTransactions = transactions.filter(t => {
                        const tDate = t.date || new Date(t.createdAt);
                        return tDate >= weekStart && tDate < weekEnd;
                    });

                    salesValues.push(weekTransactions.reduce((sum, t) => sum + (t.total || 0), 0));
                    orderCounts.push(weekTransactions.length);
                }
            } else {
                // Show by month
                let current = new Date(startDate);
                while (current <= endDate) {
                    const monthName = current.toLocaleDateString('en', { month: 'short', year: '2-digit' });
                    labels.push(monthName);

                    const monthTransactions = transactions.filter(t => {
                        const tDate = t.date || new Date(t.createdAt);
                        return tDate.getMonth() === current.getMonth() &&
                               tDate.getFullYear() === current.getFullYear();
                    });

                    salesValues.push(monthTransactions.reduce((sum, t) => sum + (t.total || 0), 0));
                    orderCounts.push(monthTransactions.length);

                    current.setMonth(current.getMonth() + 1);
                }
            }
        }

        // Ensure we always have data for charts
        const finalSales = salesValues.some(v => v > 0) ? salesValues : [0];
        const finalOrders = orderCounts.some(v => v > 0) ? orderCounts : [0];
        const finalLabels = labels.length > 0 ? labels : ['No Data'];

        setSalesData({
            labels: finalLabels,
            datasets: [{ data: finalSales }],
        });

        setOrdersData({
            labels: finalLabels,
            datasets: [{ data: finalOrders }],
        });
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchInsightsData();
    };

    const handleDateChange = (event, selectedDate) => {
        if (Platform.OS === 'android') {
            setShowDatePicker(false);
        }

        if (selectedDate) {
            if (datePickerMode === 'start') {
                setCustomStartDate(selectedDate);
                // Ensure end date is not before start date
                if (selectedDate > customEndDate) {
                    setCustomEndDate(selectedDate);
                }
            } else {
                setCustomEndDate(selectedDate);
            }
        }
    };

    const applyCustomDateRange = () => {
        setShowDateModal(false);
        setTimeFilter('custom');
    };

    const formatCurrency = (amount) => {
        const num = amount || 0;
        if (num >= 1000000) {
            return `${(num / 1000000).toFixed(1)}M`;
        } else if (num >= 1000) {
            return `${(num / 1000).toFixed(1)}K`;
        }
        return num.toLocaleString();
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    const businessColor = businessConfig?.color || colors.restaurant;
    const currency = businessData?.currency || 'PKR';

    const chartConfig = {
        backgroundColor: '#fff',
        backgroundGradientFrom: '#fff',
        backgroundGradientTo: '#fff',
        decimalPlaces: 0,
        color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
        labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
        style: {
            borderRadius: 16,
        },
        propsForDots: {
            r: '4',
            strokeWidth: '2',
            stroke: '#6366f1',
        },
    };

    const FilterButton = ({ label, value }) => (
        <TouchableOpacity
            style={[
                styles.filterBtn,
                timeFilter === value && styles.filterBtnActive,
            ]}
            onPress={() => setTimeFilter(value)}
        >
            <Text style={[
                styles.filterBtnText,
                timeFilter === value && styles.filterBtnTextActive,
            ]}>
                {label}
            </Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#6366f1" />

            {/* Header */}
            <LinearGradient
                colors={['#6366f1', '#8b5cf6']}
                style={styles.header}
            >
                <View style={styles.headerTop}>
                    <TouchableOpacity
                        style={styles.backBtn}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Insights</Text>
                    <View style={{ width: 40 }} />
                </View>

                {/* Time Filter */}
                <View style={styles.filterContainer}>
                    <FilterButton label="Week" value="week" />
                    <FilterButton label="Month" value="month" />
                    <FilterButton label="3M" value="3months" />
                    <FilterButton label="Year" value="year" />
                    <TouchableOpacity
                        style={[
                            styles.filterBtn,
                            timeFilter === 'custom' && styles.filterBtnActive,
                        ]}
                        onPress={() => setShowDateModal(true)}
                    >
                        <Ionicons
                            name="calendar-outline"
                            size={16}
                            color={timeFilter === 'custom' ? '#6366f1' : 'rgba(255,255,255,0.8)'}
                        />
                    </TouchableOpacity>
                </View>

                {/* Show custom date range if selected */}
                {timeFilter === 'custom' && (
                    <TouchableOpacity
                        style={styles.customDateDisplay}
                        onPress={() => setShowDateModal(true)}
                    >
                        <Text style={styles.customDateText}>
                            {customStartDate.toLocaleDateString('en', { day: 'numeric', month: 'short' })} - {customEndDate.toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </Text>
                        <Ionicons name="chevron-down" size={16} color="#fff" />
                    </TouchableOpacity>
                )}
            </LinearGradient>

            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {/* Summary Cards */}
                {dataLoading ? (
                    <View style={styles.summaryGrid}>
                        <View style={styles.summaryCard}>
                            <Skeleton width={60} height={12} style={{ marginBottom: 8 }} />
                            <Skeleton width={80} height={22} style={{ marginBottom: 8 }} />
                            <Skeleton width={50} height={20} borderRadius={12} />
                        </View>
                        <View style={styles.summaryCard}>
                            <Skeleton width={60} height={12} style={{ marginBottom: 8 }} />
                            <Skeleton width={40} height={22} />
                        </View>
                        <View style={styles.summaryCard}>
                            <Skeleton width={60} height={12} style={{ marginBottom: 8 }} />
                            <Skeleton width={70} height={22} />
                        </View>
                    </View>
                ) : (
                <View style={styles.summaryGrid}>
                    <View style={styles.summaryCard}>
                        <Text style={styles.summaryLabel}>Total Revenue</Text>
                        <Text style={styles.summaryValue}>{currency} {formatCurrency(summaryStats.totalSales)}</Text>
                        <View style={[styles.growthBadge, { backgroundColor: summaryStats.growth >= 0 ? '#dcfce7' : '#fee2e2' }]}>
                            <Ionicons
                                name={summaryStats.growth >= 0 ? 'trending-up' : 'trending-down'}
                                size={14}
                                color={summaryStats.growth >= 0 ? '#22c55e' : '#ef4444'}
                            />
                            <Text style={[styles.growthText, { color: summaryStats.growth >= 0 ? '#22c55e' : '#ef4444' }]}>
                                {Math.abs(summaryStats.growth).toFixed(1)}%
                            </Text>
                        </View>
                    </View>

                    <View style={styles.summaryCard}>
                        <Text style={styles.summaryLabel}>Total Orders</Text>
                        <Text style={styles.summaryValue}>{summaryStats.totalOrders}</Text>
                    </View>

                    <View style={styles.summaryCard}>
                        <Text style={styles.summaryLabel}>Avg Order</Text>
                        <Text style={styles.summaryValue}>{currency} {formatCurrency(summaryStats.avgOrderValue)}</Text>
                    </View>
                </View>
                )}

                {/* Sales Chart */}
                {dataLoading ? (
                    <View style={styles.chartCard}>
                        <Skeleton width={120} height={18} style={{ marginBottom: 16 }} />
                        <Skeleton width={chartWidth - 64} height={200} borderRadius={12} />
                    </View>
                ) : (
                <View style={styles.chartCard}>
                    <Text style={styles.chartTitle}>Revenue Trend</Text>
                    <LineChart
                        data={salesData}
                        width={chartWidth - 32}
                        height={200}
                        chartConfig={chartConfig}
                        bezier
                        style={styles.chart}
                        withInnerLines={false}
                        withOuterLines={false}
                        withShadow={false}
                        formatYLabel={(value) => formatCurrency(parseInt(value))}
                    />
                </View>
                )}

                {/* Orders Chart */}
                {dataLoading ? (
                    <View style={styles.chartCard}>
                        <Skeleton width={100} height={18} style={{ marginBottom: 16 }} />
                        <Skeleton width={chartWidth - 64} height={200} borderRadius={12} />
                    </View>
                ) : (
                <View style={styles.chartCard}>
                    <Text style={styles.chartTitle}>Orders Trend</Text>
                    <BarChart
                        data={ordersData}
                        width={chartWidth - 32}
                        height={200}
                        chartConfig={{
                            ...chartConfig,
                            color: (opacity = 1) => `rgba(34, 197, 94, ${opacity})`,
                        }}
                        style={styles.chart}
                        withInnerLines={false}
                        showValuesOnTopOfBars
                        fromZero
                    />
                </View>
                )}

                {/* Top Selling Items */}
                {dataLoading ? (
                    <View style={styles.listCard}>
                        <Skeleton width={130} height={18} style={{ marginBottom: 16 }} />
                        {[1, 2, 3].map((_, i) => (
                            <View key={i} style={styles.listItem}>
                                <Skeleton width={28} height={28} borderRadius={8} />
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Skeleton width={120} height={14} style={{ marginBottom: 6 }} />
                                    <Skeleton width={60} height={12} />
                                </View>
                                <Skeleton width={70} height={16} />
                            </View>
                        ))}
                    </View>
                ) : (
                <View style={styles.listCard}>
                    <Text style={styles.chartTitle}>Top Selling Items</Text>
                    {topItems.length === 0 ? (
                        <Text style={styles.emptyText}>No data available</Text>
                    ) : (
                        topItems.map((item, index) => (
                            <View key={index} style={styles.listItem}>
                                <View style={styles.rankBadge}>
                                    <Text style={styles.rankText}>{index + 1}</Text>
                                </View>
                                <View style={styles.listItemInfo}>
                                    <Text style={styles.listItemName}>{item.name}</Text>
                                    <Text style={styles.listItemMeta}>{item.quantity} sold</Text>
                                </View>
                                <Text style={styles.listItemValue}>{currency} {formatCurrency(item.revenue)}</Text>
                            </View>
                        ))
                    )}
                </View>
                )}

                {/* Employee Performance */}
                {dataLoading ? (
                    <View style={styles.listCard}>
                        <Skeleton width={160} height={18} style={{ marginBottom: 16 }} />
                        {[1, 2, 3].map((_, i) => (
                            <View key={i} style={styles.listItem}>
                                <Skeleton width={40} height={40} borderRadius={12} />
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Skeleton width={100} height={14} style={{ marginBottom: 6 }} />
                                    <Skeleton width={70} height={12} />
                                </View>
                                <Skeleton width={70} height={16} />
                            </View>
                        ))}
                    </View>
                ) : (
                <View style={styles.listCard}>
                    <Text style={styles.chartTitle}>Employee Performance</Text>
                    {employeeStats.length === 0 ? (
                        <Text style={styles.emptyText}>No data available</Text>
                    ) : (
                        employeeStats.map((emp, index) => (
                            <View key={index} style={styles.listItem}>
                                <View style={[styles.empAvatar, { backgroundColor: ['#dbeafe', '#dcfce7', '#fef3c7', '#fce7f3', '#e0e7ff'][index % 5] }]}>
                                    <Text style={[styles.empInitial, { color: ['#3b82f6', '#22c55e', '#f59e0b', '#ec4899', '#6366f1'][index % 5] }]}>
                                        {emp.name.charAt(0).toUpperCase()}
                                    </Text>
                                </View>
                                <View style={styles.listItemInfo}>
                                    <Text style={styles.listItemName}>{emp.name}</Text>
                                    <Text style={styles.listItemMeta}>{emp.orders} orders</Text>
                                </View>
                                <Text style={styles.listItemValue}>{currency} {formatCurrency(emp.sales)}</Text>
                            </View>
                        ))
                    )}
                </View>
                )}

                {/* Profit & Loss Statement */}
                {dataLoading ? (
                    <View style={styles.plCard}>
                        <View style={styles.plHeader}>
                            <Skeleton width={120} height={20} />
                            <Skeleton width={100} height={26} borderRadius={12} />
                        </View>
                        <View style={[styles.netProfitCard, { backgroundColor: '#f1f5f9' }]}>
                            <Skeleton width={80} height={14} style={{ marginBottom: 8 }} />
                            <Skeleton width={140} height={32} />
                        </View>
                        <View style={styles.plBreakdown}>
                            {[1, 2, 3, 4].map((_, i) => (
                                <View key={i} style={styles.plRow}>
                                    <View style={styles.plRowLeft}>
                                        <Skeleton width={28} height={28} borderRadius={8} />
                                        <Skeleton width={100} height={14} style={{ marginLeft: 10 }} />
                                    </View>
                                    <Skeleton width={80} height={16} />
                                </View>
                            ))}
                        </View>
                    </View>
                ) : (
                <View style={styles.plCard}>
                    <View style={styles.plHeader}>
                        <View style={styles.plTitleRow}>
                            <Ionicons name="stats-chart" size={20} color="#6366f1" />
                            <Text style={styles.plTitle}>Profit & Loss</Text>
                        </View>
                        <View style={[
                            styles.plBadge,
                            { backgroundColor: profitLoss.netProfit >= 0 ? '#dcfce7' : '#fee2e2' }
                        ]}>
                            <Ionicons
                                name={profitLoss.netProfit >= 0 ? 'trending-up' : 'trending-down'}
                                size={14}
                                color={profitLoss.netProfit >= 0 ? '#16a34a' : '#dc2626'}
                            />
                            <Text style={[
                                styles.plBadgeText,
                                { color: profitLoss.netProfit >= 0 ? '#16a34a' : '#dc2626' }
                            ]}>
                                {profitLoss.profitMargin.toFixed(1)}% margin
                            </Text>
                        </View>
                    </View>

                    {/* Net Profit Highlight */}
                    <View style={[
                        styles.netProfitCard,
                        { backgroundColor: profitLoss.netProfit >= 0 ? '#dcfce7' : '#fee2e2' }
                    ]}>
                        <Text style={styles.netProfitLabel}>Net Profit</Text>
                        <Text style={[
                            styles.netProfitValue,
                            { color: profitLoss.netProfit >= 0 ? '#16a34a' : '#dc2626' }
                        ]}>
                            {currency} {formatCurrency(Math.abs(profitLoss.netProfit))}
                            {profitLoss.netProfit < 0 ? ' (Loss)' : ''}
                        </Text>
                    </View>

                    {/* P&L Breakdown */}
                    <View style={styles.plBreakdown}>
                        <View style={styles.plRow}>
                            <View style={styles.plRowLeft}>
                                <View style={[styles.plIcon, { backgroundColor: '#dbeafe' }]}>
                                    <Ionicons name="arrow-up" size={14} color="#3b82f6" />
                                </View>
                                <Text style={styles.plRowLabel}>Gross Revenue</Text>
                            </View>
                            <Text style={styles.plRowValue}>{currency} {formatCurrency(profitLoss.grossRevenue)}</Text>
                        </View>

                        <View style={styles.plRow}>
                            <View style={styles.plRowLeft}>
                                <View style={[styles.plIcon, { backgroundColor: '#fef3c7' }]}>
                                    <Ionicons name="arrow-undo" size={14} color="#d97706" />
                                </View>
                                <Text style={styles.plRowLabel}>Returns/Refunds</Text>
                            </View>
                            <Text style={[styles.plRowValue, { color: '#d97706' }]}>
                                - {currency} {formatCurrency(profitLoss.returns)}
                            </Text>
                        </View>

                        <View style={[styles.plRow, styles.plSubtotal]}>
                            <Text style={styles.plSubtotalLabel}>Net Revenue</Text>
                            <Text style={styles.plSubtotalValue}>{currency} {formatCurrency(profitLoss.netRevenue)}</Text>
                        </View>

                        {/* Cost of Goods Sold */}
                        <View style={styles.plRow}>
                            <View style={styles.plRowLeft}>
                                <View style={[styles.plIcon, { backgroundColor: '#fef3c7' }]}>
                                    <Ionicons name="cube" size={14} color="#d97706" />
                                </View>
                                <Text style={styles.plRowLabel}>Cost of Goods Sold</Text>
                            </View>
                            <Text style={[styles.plRowValue, { color: '#d97706' }]}>
                                - {currency} {formatCurrency(profitLoss.costOfGoods)}
                            </Text>
                        </View>

                        {/* Gross Profit Subtotal */}
                        <View style={[styles.plRow, styles.plSubtotal]}>
                            <Text style={styles.plSubtotalLabel}>Gross Profit</Text>
                            <Text style={[
                                styles.plSubtotalValue,
                                { color: profitLoss.grossProfit >= 0 ? '#16a34a' : '#dc2626' }
                            ]}>
                                {currency} {formatCurrency(profitLoss.grossProfit)}
                                <Text style={{ fontSize: 12, fontWeight: '400' }}>
                                    {' '}({profitLoss.grossProfitMargin.toFixed(1)}%)
                                </Text>
                            </Text>
                        </View>

                        <View style={styles.plRow}>
                            <View style={styles.plRowLeft}>
                                <View style={[styles.plIcon, { backgroundColor: '#fee2e2' }]}>
                                    <Ionicons name="wallet" size={14} color="#dc2626" />
                                </View>
                                <Text style={styles.plRowLabel}>Operating Expenses</Text>
                            </View>
                            <Text style={[styles.plRowValue, { color: '#dc2626' }]}>
                                - {currency} {formatCurrency(profitLoss.totalExpenses)}
                            </Text>
                        </View>
                    </View>

                    {/* Expense Categories */}
                    {expenseStats?.byCategory && expenseStats.byCategory.length > 0 && (
                        <View style={styles.expenseCategories}>
                            <Text style={styles.expenseCatTitle}>Expense Breakdown</Text>
                            {expenseStats.byCategory.slice(0, 5).map((cat, index) => (
                                <View key={index} style={styles.expenseCatRow}>
                                    <View style={styles.expenseCatLeft}>
                                        <View style={[
                                            styles.expenseCatDot,
                                            { backgroundColor: ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#8b5cf6'][index % 5] }
                                        ]} />
                                        <Text style={styles.expenseCatName}>{cat.label}</Text>
                                    </View>
                                    <Text style={styles.expenseCatValue}>{currency} {formatCurrency(cat.total)}</Text>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
                )}

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Custom Date Range Modal */}
            <Modal
                visible={showDateModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowDateModal(false)}
            >
                <View style={styles.dateModalOverlay}>
                    <View style={styles.dateModalContent}>
                        <View style={styles.dateModalHeader}>
                            <Text style={styles.dateModalTitle}>Select Date Range</Text>
                            <TouchableOpacity onPress={() => setShowDateModal(false)}>
                                <Ionicons name="close" size={24} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        {/* Start Date */}
                        <View style={styles.datePickerRow}>
                            <Text style={styles.dateLabel}>From</Text>
                            <TouchableOpacity
                                style={styles.dateButton}
                                onPress={() => {
                                    setDatePickerMode('start');
                                    setShowDatePicker(true);
                                }}
                            >
                                <Ionicons name="calendar-outline" size={18} color="#6366f1" />
                                <Text style={styles.dateButtonText}>
                                    {customStartDate.toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* End Date */}
                        <View style={styles.datePickerRow}>
                            <Text style={styles.dateLabel}>To</Text>
                            <TouchableOpacity
                                style={styles.dateButton}
                                onPress={() => {
                                    setDatePickerMode('end');
                                    setShowDatePicker(true);
                                }}
                            >
                                <Ionicons name="calendar-outline" size={18} color="#6366f1" />
                                <Text style={styles.dateButtonText}>
                                    {customEndDate.toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Date Picker */}
                        {showDatePicker && (
                            <DateTimePicker
                                value={datePickerMode === 'start' ? customStartDate : customEndDate}
                                mode="date"
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                onChange={handleDateChange}
                                maximumDate={new Date()}
                            />
                        )}

                        {/* Apply Button */}
                        <TouchableOpacity
                            style={styles.applyButton}
                            onPress={applyCustomDateRange}
                        >
                            <Text style={styles.applyButtonText}>Apply</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

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
    header: {
        paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight + 10,
        paddingBottom: 16,
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
    filterContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: 12,
        padding: 4,
    },
    filterBtn: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 10,
    },
    filterBtnActive: {
        backgroundColor: '#fff',
    },
    filterBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.8)',
    },
    filterBtnTextActive: {
        color: '#6366f1',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    summaryGrid: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 16,
    },
    summaryCard: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 14,
        ...shadows.sm,
    },
    summaryLabel: {
        fontSize: 12,
        color: '#64748b',
        marginBottom: 4,
    },
    summaryValue: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
    },
    growthBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        marginTop: 6,
        gap: 4,
    },
    growthText: {
        fontSize: 12,
        fontWeight: '600',
    },
    chartCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        ...shadows.sm,
    },
    chartTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1e293b',
        marginBottom: 16,
    },
    chart: {
        marginLeft: -16,
        borderRadius: 16,
    },
    listCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        ...shadows.sm,
    },
    emptyText: {
        fontSize: 14,
        color: '#94a3b8',
        textAlign: 'center',
        paddingVertical: 20,
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    rankBadge: {
        width: 28,
        height: 28,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    rankText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#64748b',
    },
    empAvatar: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    empInitial: {
        fontSize: 16,
        fontWeight: '700',
    },
    listItemInfo: {
        flex: 1,
        marginLeft: 12,
    },
    listItemName: {
        fontSize: 15,
        fontWeight: '500',
        color: '#1e293b',
    },
    listItemMeta: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 2,
    },
    listItemValue: {
        fontSize: 15,
        fontWeight: '600',
        color: '#22c55e',
    },
    // Custom date styles
    customDateDisplay: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 20,
        marginTop: 12,
        gap: 6,
        alignSelf: 'center',
    },
    customDateText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#fff',
    },
    dateModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    dateModalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    },
    dateModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    dateModalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1e293b',
    },
    datePickerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    dateLabel: {
        fontSize: 15,
        color: '#64748b',
        width: 50,
    },
    dateButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        gap: 10,
    },
    dateButtonText: {
        fontSize: 15,
        color: '#1e293b',
        fontWeight: '500',
    },
    applyButton: {
        backgroundColor: '#6366f1',
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
        marginTop: 16,
    },
    applyButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    // P&L Styles
    plCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        ...shadows.sm,
    },
    plHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    plTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    plTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1e293b',
    },
    plBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        gap: 4,
    },
    plBadgeText: {
        fontSize: 12,
        fontWeight: '600',
    },
    netProfitCard: {
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginBottom: 16,
    },
    netProfitLabel: {
        fontSize: 13,
        color: '#64748b',
        marginBottom: 4,
    },
    netProfitValue: {
        fontSize: 28,
        fontWeight: '700',
    },
    plBreakdown: {
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        paddingTop: 12,
    },
    plRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
    },
    plRowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    plIcon: {
        width: 28,
        height: 28,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    plRowLabel: {
        fontSize: 14,
        color: '#64748b',
    },
    plRowValue: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1e293b',
    },
    plSubtotal: {
        backgroundColor: '#f8fafc',
        marginHorizontal: -16,
        paddingHorizontal: 16,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#e2e8f0',
    },
    plSubtotalLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1e293b',
    },
    plSubtotalValue: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b',
    },
    expenseCategories: {
        marginTop: 16,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    expenseCatTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748b',
        marginBottom: 10,
    },
    expenseCatRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
    },
    expenseCatLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    expenseCatDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    expenseCatName: {
        fontSize: 14,
        color: '#64748b',
    },
    expenseCatValue: {
        fontSize: 14,
        fontWeight: '500',
        color: '#1e293b',
    },
});

export default InsightsScreen;
