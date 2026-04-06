import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    StyleSheet,
    Text,
    View,
    RefreshControl,
    TouchableOpacity,
    ActivityIndicator,
    Platform,
    StatusBar,
    Animated,
    Alert,
    Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import axios from 'axios';
import { useFocusEffect } from '@react-navigation/native';

import { StatCard } from '../../components/common';
import { colors, typography, spacing, borderRadius, shadows, getBusinessConfig } from '../../constants/theme';

// Business Context
import { useBusiness } from '../../context/BusinessContext';

const AdminDashboard = ({ navigation }) => {
    const API_BASE_URL = Constants.expoConfig.extra.API_BASE_URL;

    // Use BusinessContext
    const { businessData, businessType, config, isRestaurant, isRetail, isService } = useBusiness();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [businessConfig, setBusinessConfig] = useState(null);
    const [stats, setStats] = useState({
        monthSales: 0,
        todaySales: 0,
        todayOrders: 0,
        inKitchen: 0,
        readyToServe: 0,
        activeEmployees: 0,
        totalEmployees: 0,
        avgOrderValue: 0,
        lowStockCount: 0,
        totalProducts: 0,
    });
    const [recentOrders, setRecentOrders] = useState([]);

    // Modal state for showing exact values
    const [detailModal, setDetailModal] = useState({ visible: false, title: '', value: '', color: colors.primary });
    const modalScale = useRef(new Animated.Value(0)).current;
    const modalOpacity = useRef(new Animated.Value(0)).current;

    // Scroll animation ref
    const scrollY = React.useRef(new Animated.Value(0)).current;

    useEffect(() => {
        loadBusinessData();
    }, [config]);

    useFocusEffect(
        useCallback(() => {
            StatusBar.setBarStyle('dark-content');
            return () => {};
        }, [])
    );

    useFocusEffect(
        useCallback(() => {
            if (businessData || businessType) {
                fetchDashboardData();
            }
        }, [businessData, businessType])
    );

    const loadBusinessData = async () => {
        try {
            // Use config from BusinessContext, fallback to theme config
            if (config) {
                setBusinessConfig({
                    name: config.name,
                    icon: config.icon,
                    color: config.colors,
                });
            } else {
                const businessStr = await AsyncStorage.getItem('business');
                if (businessStr) {
                    const business = JSON.parse(businessStr);
                    const typeCode = business.businessType?.code || 'restaurant';
                    setBusinessConfig(getBusinessConfig(typeCode));
                }
            }
        } catch (error) {
            console.log('Error loading business data:', error);
        }
    };

    const getToken = async () => {
        try {
            return await AsyncStorage.getItem('token');
        } catch (error) {
            return null;
        }
    };

    const fetchDashboardData = async () => {
        try {
            const token = await getToken();
            if (!token) return;

            const headers = { Authorization: `Bearer ${token}` };

            // Fetch stats from centralized endpoint - single source of truth
            const statsRes = await axios.get(`${API_BASE_URL}/receipt/stats`, { headers });
            const salesStats = statsRes.data;

            // Use net sales (after returns) from the stats endpoint
            const monthSales = salesStats.netMonthSales ?? salesStats.monthSales ?? 0;
            const todaySales = salesStats.netTodaySales ?? salesStats.todaySales ?? 0;
            const todayOrders = salesStats.todayOrders ?? 0;

            // Fetch receipts only for recent receipts list
            const receiptsRes = await axios.get(`${API_BASE_URL}/receipt?limit=10`, { headers });
            // Handle both old (array) and new (object with receipts) response formats
            const allReceipts = receiptsRes.data?.receipts || receiptsRes.data || [];

            // Only fetch orders for restaurant (kitchen/ready to serve stats)
            let allOrders = [];
            if (isRestaurant) {
                try {
                    const ordersRes = await axios.get(`${API_BASE_URL}/order`, { headers });
                    allOrders = ordersRes.data || [];
                } catch (e) {
                    console.log('Error fetching orders:', e);
                }
            }

            // Fetch products for retail (low stock count)
            let lowStockCount = 0;
            let totalProducts = 0;
            if (isRetail) {
                try {
                    const productsRes = await axios.get(`${API_BASE_URL}/product`, { headers });
                    const products = productsRes.data || [];
                    totalProducts = products.length;
                    lowStockCount = products.filter(p => p.trackStock && p.stockQuantity <= (p.lowStockAlert || 5)).length;
                } catch (e) {
                    console.log('Error fetching products:', e);
                }
            }

            // Live operational stats - only for restaurant
            const inKitchen = isRestaurant ? allOrders.filter(o =>
                o.status === 'preparing' || o.status === 'pending'
            ).length : 0;

            const readyToServe = isRestaurant ? allOrders.filter(o =>
                o.status === 'ready'
            ).length : 0;

            // Average transaction value (use stats from endpoint)
            const avgOrderValue = todayOrders > 0 ? todaySales / todayOrders : 0;

            // Get employees/counter users
            // Note: All business types use /employee endpoint - retail "counter users" are stored as employees
            let totalEmployees = 0;
            let activeEmployees = 0;
            try {
                const employeesRes = await axios.get(`${API_BASE_URL}/employee`, { headers });
                const employees = employeesRes.data || [];
                totalEmployees = employees.length;
                activeEmployees = employees.filter(e => e.workStatus === 'active').length;
            } catch (e) {
                console.log('Error fetching staff:', e.message);
            }

            setStats({
                monthSales,
                todaySales,
                todayOrders,
                inKitchen,
                readyToServe,
                activeEmployees,
                totalEmployees,
                avgOrderValue,
                lowStockCount,
                totalProducts,
            });

            // Recent receipts (last 5, excluding refunds)
            const recentReceipts = allReceipts
                .filter(r => !r.receiptType?.includes('_refund'))
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, 5)
                .map(r => ({
                    _id: r._id,
                    billNumber: r.billNumber,
                    customerName: r.customerName || 'Walk-in Customer',
                    totalBill: r.totalBill || 0,
                    totalQty: r.totalQty || r.items?.reduce((sum, i) => sum + (i.qty || 1), 0) || 0,
                    time: new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                }));
            setRecentOrders(recentReceipts);

        } catch (error) {
            console.log('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchDashboardData();
    };

    const formatCurrency = (amount) => {
        const num = amount || 0;
        return `${businessData?.currency || 'PKR'} ${num.toLocaleString()}`;
    };

    const formatAbbreviatedCurrency = (amount) => {
        const num = amount || 0;
        const currency = businessData?.currency || 'PKR';
        if (num >= 1000000) {
            return `${currency} ${(num / 1000000).toFixed(1)}M`;
        } else if (num >= 1000) {
            const thousands = num / 1000;
            if (thousands % 1 === 0) {
                return `${currency} ${thousands.toFixed(0)}K`;
            }
            return `${currency} ${thousands.toFixed(1)}K`;
        }
        return `${currency} ${Math.round(num)}`;
    };

    const showDetailModal = (title, value, color) => {
        setDetailModal({ visible: true, title, value, color });
        Animated.parallel([
            Animated.spring(modalScale, {
                toValue: 1,
                friction: 8,
                tension: 40,
                useNativeDriver: true,
            }),
            Animated.timing(modalOpacity, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start();
    };

    const hideDetailModal = () => {
        Animated.parallel([
            Animated.timing(modalScale, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
            }),
            Animated.timing(modalOpacity, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
            }),
        ]).start(() => {
            setDetailModal({ visible: false, title: '', value: '', color: colors.primary });
        });
    };

    const navigateToTab = (tabName) => {
        const parent = navigation.getParent();
        if (parent) {
            parent.navigate(tabName);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    const businessColor = businessConfig?.color || colors.restaurant;

    const headerOpacity = scrollY.interpolate({
        inputRange: [0, 100],
        outputRange: [0, 1],
        extrapolate: 'clamp',
    });

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={businessColor.primary} />

            {/* Fixed Header on scroll */}
            <Animated.View style={[styles.fixedHeader, { opacity: headerOpacity }]}>
                <LinearGradient
                    colors={[businessColor.primary, businessColor.secondary]}
                    style={styles.glassHeader}
                >
                    <Text style={styles.glassHeaderTitle}>{businessData?.name || 'Dashboard'}</Text>
                    <MaterialIcons name={businessConfig?.icon || 'store'} size={20} color="#fff" />
                </LinearGradient>
            </Animated.View>

            <Animated.ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                showsVerticalScrollIndicator={false}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                    { useNativeDriver: true }
                )}
                scrollEventThrottle={16}
            >
                {/* Header */}
                <LinearGradient
                    colors={[businessColor.primary, businessColor.secondary]}
                    style={styles.header}
                >
                    <View style={styles.headerTop}>
                        <View>
                            <Text style={styles.greeting}>Welcome back!</Text>
                            <Text style={styles.businessName}>{businessData?.name || 'Your Business'}</Text>
                        </View>
                        <View style={styles.businessBadge}>
                            <MaterialIcons name={businessConfig?.icon || 'store'} size={16} color={businessColor.primary} />
                            <Text style={styles.businessType}>{businessConfig?.name}</Text>
                        </View>
                    </View>
                </LinearGradient>

                {/* Sales Overview */}
                <View style={styles.salesSection}>
                    <View style={styles.salesRow}>
                        <StatCard
                            title="This Month"
                            value={formatAbbreviatedCurrency(stats.monthSales)}
                            icon="account-balance-wallet"
                            color={colors.primary}
                            secondaryColor={colors.primaryDark}
                            style={styles.salesCard}
                            onPress={() => showDetailModal('This Month Sales', formatCurrency(stats.monthSales), colors.primary)}
                        />
                        <StatCard
                            title="Today"
                            value={formatAbbreviatedCurrency(stats.todaySales)}
                            icon="today"
                            color={colors.success}
                            secondaryColor="#059669"
                            style={styles.salesCard}
                            onPress={() => showDetailModal("Today's Sales", formatCurrency(stats.todaySales), colors.success)}
                        />
                    </View>
                </View>

                {/* Live Status Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Live Status</Text>
                    <View style={styles.liveStatusGrid}>
                        {/* Restaurant: In Kitchen */}
                        {isRestaurant && (
                            <TouchableOpacity
                                style={styles.liveStatusCard}
                                onPress={() => showDetailModal('In Kitchen', stats.inKitchen.toString(), '#f59e0b')}
                                activeOpacity={0.8}
                            >
                                <View style={[styles.liveStatusIcon, { backgroundColor: '#fef3c7' }]}>
                                    <MaterialIcons name="outdoor-grill" size={22} color="#f59e0b" />
                                </View>
                                <View style={styles.liveStatusInfo}>
                                    <Text style={[styles.liveStatusValue, { color: '#f59e0b' }]}>{stats.inKitchen}</Text>
                                    <Text style={styles.liveStatusLabel}>In Kitchen</Text>
                                </View>
                                {stats.inKitchen > 0 && <View style={[styles.liveDot, { backgroundColor: '#f59e0b' }]} />}
                            </TouchableOpacity>
                        )}

                        {/* Restaurant: Ready to Serve */}
                        {isRestaurant && (
                            <TouchableOpacity
                                style={styles.liveStatusCard}
                                onPress={() => showDetailModal('Ready to Serve', stats.readyToServe.toString(), '#22c55e')}
                                activeOpacity={0.8}
                            >
                                <View style={[styles.liveStatusIcon, { backgroundColor: '#dcfce7' }]}>
                                    <MaterialIcons name="check-circle" size={22} color="#22c55e" />
                                </View>
                                <View style={styles.liveStatusInfo}>
                                    <Text style={[styles.liveStatusValue, { color: '#22c55e' }]}>{stats.readyToServe}</Text>
                                    <Text style={styles.liveStatusLabel}>Ready to Serve</Text>
                                </View>
                                {stats.readyToServe > 0 && <View style={[styles.liveDot, { backgroundColor: '#22c55e' }]} />}
                            </TouchableOpacity>
                        )}

                        {/* Retail: Low Stock Alert */}
                        {isRetail && (
                            <TouchableOpacity
                                style={styles.liveStatusCard}
                                onPress={() => showDetailModal('Low Stock Items', stats.lowStockCount.toString(), '#ef4444')}
                                activeOpacity={0.8}
                            >
                                <View style={[styles.liveStatusIcon, { backgroundColor: '#fee2e2' }]}>
                                    <MaterialIcons name="warning" size={22} color="#ef4444" />
                                </View>
                                <View style={styles.liveStatusInfo}>
                                    <Text style={[styles.liveStatusValue, { color: '#ef4444' }]}>{stats.lowStockCount}</Text>
                                    <Text style={styles.liveStatusLabel}>Low Stock</Text>
                                </View>
                                {stats.lowStockCount > 0 && <View style={[styles.liveDot, { backgroundColor: '#ef4444' }]} />}
                            </TouchableOpacity>
                        )}

                        {/* Retail: Total Products */}
                        {isRetail && (
                            <TouchableOpacity
                                style={styles.liveStatusCard}
                                onPress={() => showDetailModal('Total Products', stats.totalProducts.toString(), '#8b5cf6')}
                                activeOpacity={0.8}
                            >
                                <View style={[styles.liveStatusIcon, { backgroundColor: '#ede9fe' }]}>
                                    <MaterialIcons name="inventory-2" size={22} color="#8b5cf6" />
                                </View>
                                <View style={styles.liveStatusInfo}>
                                    <Text style={[styles.liveStatusValue, { color: '#8b5cf6' }]}>{stats.totalProducts}</Text>
                                    <Text style={styles.liveStatusLabel}>Products</Text>
                                </View>
                            </TouchableOpacity>
                        )}

                        {/* Service: Appointments Today (placeholder) */}
                        {isService && (
                            <TouchableOpacity
                                style={styles.liveStatusCard}
                                onPress={() => showDetailModal("Today's Bills", stats.todayOrders.toString(), '#06b6d4')}
                                activeOpacity={0.8}
                            >
                                <View style={[styles.liveStatusIcon, { backgroundColor: '#cffafe' }]}>
                                    <MaterialIcons name="event-note" size={22} color="#06b6d4" />
                                </View>
                                <View style={styles.liveStatusInfo}>
                                    <Text style={[styles.liveStatusValue, { color: '#06b6d4' }]}>{stats.todayOrders}</Text>
                                    <Text style={styles.liveStatusLabel}>Today's Bills</Text>
                                </View>
                            </TouchableOpacity>
                        )}

                        {/* Common: Active Staff */}
                        <TouchableOpacity
                            style={styles.liveStatusCard}
                            onPress={() => showDetailModal(isRetail ? 'Active Counter Users' : 'Active Staff', `${stats.activeEmployees} of ${stats.totalEmployees}`, config?.colors?.primary || '#8b5cf6')}
                            activeOpacity={0.8}
                        >
                            <View style={[styles.liveStatusIcon, { backgroundColor: config?.colors?.light || '#ede9fe' }]}>
                                <MaterialIcons name="people" size={22} color={config?.colors?.primary || '#8b5cf6'} />
                            </View>
                            <View style={styles.liveStatusInfo}>
                                <Text style={[styles.liveStatusValue, { color: config?.colors?.primary || '#8b5cf6' }]}>{stats.activeEmployees}/{stats.totalEmployees}</Text>
                                <Text style={styles.liveStatusLabel}>{isRetail ? 'Counter Users' : 'Active Staff'}</Text>
                            </View>
                        </TouchableOpacity>

                        {/* Common: Today's Transactions */}
                        <TouchableOpacity
                            style={styles.liveStatusCard}
                            onPress={() => showDetailModal(`Today's ${config?.labels?.orderUnitPlural || 'Orders'}`, stats.todayOrders.toString(), '#3b82f6')}
                            activeOpacity={0.8}
                        >
                            <View style={[styles.liveStatusIcon, { backgroundColor: '#dbeafe' }]}>
                                <MaterialIcons name="receipt-long" size={22} color="#3b82f6" />
                            </View>
                            <View style={styles.liveStatusInfo}>
                                <Text style={[styles.liveStatusValue, { color: '#3b82f6' }]}>{stats.todayOrders}</Text>
                                <Text style={styles.liveStatusLabel}>Today's {config?.labels?.orderUnitPlural || 'Orders'}</Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Insights Card */}
                <View style={styles.section}>
                    <TouchableOpacity
                        style={styles.insightsCard}
                        onPress={() => navigation.navigate('Insights')}
                        activeOpacity={0.9}
                    >
                        <LinearGradient
                            colors={['#6366f1', '#8b5cf6']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.insightsGradient}
                        >
                            <View style={styles.insightsLeft}>
                                <View style={styles.insightsIconBg}>
                                    <Ionicons name="analytics" size={24} color="#fff" />
                                </View>
                                <View>
                                    <Text style={styles.insightsTitle}>View Insights</Text>
                                    <Text style={styles.insightsSubtitle}>Sales, trends & analytics</Text>
                                </View>
                            </View>
                            <MaterialIcons name="arrow-forward-ios" size={18} color="rgba(255,255,255,0.8)" />
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                {/* Today's Summary */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Today's Summary</Text>
                    <View style={styles.summaryRow}>
                        <View style={styles.summaryCard}>
                            <Text style={styles.summaryLabel}>{config?.labels?.orderUnitPlural || 'Orders'}</Text>
                            <Text style={styles.summaryValue}>{stats.todayOrders}</Text>
                        </View>
                        <View style={styles.summaryDivider} />
                        <View style={styles.summaryCard}>
                            <Text style={styles.summaryLabel}>Revenue</Text>
                            <Text style={[styles.summaryValue, { color: colors.success }]}>{formatAbbreviatedCurrency(stats.todaySales)}</Text>
                        </View>
                        <View style={styles.summaryDivider} />
                        <View style={styles.summaryCard}>
                            <Text style={styles.summaryLabel}>Avg {config?.labels?.orderUnit || 'Order'}</Text>
                            <Text style={styles.summaryValue}>{formatAbbreviatedCurrency(stats.avgOrderValue)}</Text>
                        </View>
                    </View>
                </View>

                {/* Recent Transactions */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Recent {config?.labels?.orderUnitPlural || 'Orders'}</Text>
                        <TouchableOpacity onPress={() => navigateToTab('Sales')}>
                            <Text style={styles.seeAll}>See All</Text>
                        </TouchableOpacity>
                    </View>

                    {recentOrders.length === 0 ? (
                        <View style={styles.emptyState}>
                            <MaterialIcons name="receipt" size={40} color={colors.textLight} />
                            <Text style={styles.emptyText}>No {(config?.labels?.orderUnitPlural || 'orders').toLowerCase()} today</Text>
                        </View>
                    ) : (
                        recentOrders.map((order, index) => (
                            <View key={order._id || index} style={styles.orderItem}>
                                <View style={styles.orderIcon}>
                                    <MaterialIcons name="receipt" size={18} color={colors.primary} />
                                </View>
                                <View style={styles.orderInfo}>
                                    <Text style={styles.orderNumber}>#{order.billNumber}</Text>
                                    <Text style={styles.orderMeta}>{order.customerName} • {order.time}</Text>
                                </View>
                                <Text style={styles.orderAmount}>{formatCurrency(order.totalBill)}</Text>
                            </View>
                        ))
                    )}
                </View>

                <View style={{ height: 100 }} />
            </Animated.ScrollView>

            {/* Detail Modal */}
            <Modal
                visible={detailModal.visible}
                transparent
                animationType="none"
                onRequestClose={hideDetailModal}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={hideDetailModal}
                >
                    <Animated.View
                        style={[
                            styles.modalContent,
                            {
                                opacity: modalOpacity,
                                transform: [{ scale: modalScale }],
                            },
                        ]}
                    >
                        <View style={[styles.modalIconContainer, { backgroundColor: detailModal.color }]}>
                            <MaterialIcons name="analytics" size={28} color="#fff" />
                        </View>
                        <Text style={styles.modalTitle}>{detailModal.title}</Text>
                        <Text style={[styles.modalValue, { color: detailModal.color }]}>
                            {detailModal.value}
                        </Text>
                        <TouchableOpacity style={styles.modalCloseBtn} onPress={hideDetailModal}>
                            <Text style={styles.modalCloseBtnText}>Close</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 20,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
    },
    fixedHeader: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
    },
    glassHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: Platform.OS === 'ios' ? 54 : (StatusBar.currentHeight || 0) + 10,
        paddingBottom: 14,
        paddingHorizontal: 20,
    },
    glassHeaderTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
    },
    header: {
        paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 0) + 20,
        paddingBottom: 40,
        paddingHorizontal: 20,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    greeting: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.8)',
        marginBottom: 4,
    },
    businessName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    businessBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 6,
    },
    businessType: {
        fontSize: 12,
        fontWeight: '600',
        color: '#1e293b',
    },
    salesSection: {
        paddingHorizontal: 16,
        marginTop: -20,
    },
    salesRow: {
        flexDirection: 'row',
        gap: 12,
    },
    salesCard: {
        flex: 1,
    },
    section: {
        paddingHorizontal: 16,
        marginTop: 20,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#1e293b',
        marginBottom: 12,
    },
    seeAll: {
        fontSize: 14,
        color: colors.primary,
        fontWeight: '500',
    },
    liveStatusGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    liveStatusCard: {
        width: '48%',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 14,
        borderRadius: 14,
        gap: 12,
        ...shadows.sm,
    },
    liveStatusIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    liveStatusInfo: {
        flex: 1,
    },
    liveStatusValue: {
        fontSize: 20,
        fontWeight: '700',
    },
    liveStatusLabel: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2,
    },
    liveDot: {
        position: 'absolute',
        top: 10,
        right: 10,
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    insightsCard: {
        borderRadius: 16,
        overflow: 'hidden',
        ...shadows.md,
    },
    insightsGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 18,
    },
    insightsLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    insightsIconBg: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    insightsTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#fff',
    },
    insightsSubtitle: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 2,
    },
    summaryRow: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 16,
        ...shadows.sm,
    },
    summaryCard: {
        flex: 1,
        alignItems: 'center',
    },
    summaryDivider: {
        width: 1,
        backgroundColor: '#e2e8f0',
        marginVertical: 4,
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
    emptyState: {
        alignItems: 'center',
        paddingVertical: 30,
        backgroundColor: '#fff',
        borderRadius: 14,
    },
    emptyText: {
        fontSize: 14,
        color: '#94a3b8',
        marginTop: 8,
    },
    orderItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 14,
        borderRadius: 12,
        marginBottom: 8,
        ...shadows.sm,
    },
    orderIcon: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    orderInfo: {
        flex: 1,
        marginLeft: 12,
    },
    orderNumber: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1e293b',
    },
    orderMeta: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 2,
    },
    orderAmount: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.success,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        minWidth: 260,
        ...shadows.lg,
    },
    modalIconContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    modalTitle: {
        fontSize: 14,
        color: '#64748b',
        marginBottom: 4,
    },
    modalValue: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    modalCloseBtn: {
        paddingHorizontal: 24,
        paddingVertical: 10,
        backgroundColor: '#f1f5f9',
        borderRadius: 10,
    },
    modalCloseBtnText: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '500',
    },
});

export default AdminDashboard;
