import React, { useState, useEffect, useRef } from 'react';
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TouchableOpacity,
    Alert,
    StatusBar,
    Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useToast } from 'native-base';
import api from '../../../constants/api';

const MyProfileScreen = ({ navigation, employeeData, businessData, businessType, onSignOut }) => {
    const toast = useToast();

    // Role detection
    const role = employeeData?.role?.toLowerCase() || '';
    const isManager = role.includes('manager') || role.includes('admin') || role.includes('owner') || role.includes('supervisor');
    const isChef = role.includes('chef') || role.includes('cook') || role.includes('kitchen');
    const isRestaurant = businessType === 'restaurant';
    // Only managers/owners can see sales figures
    const canSeeSales = isManager || !isRestaurant;

    const [stats, setStats] = useState({
        todaySales: 0,
        todayOrders: 0,
        thisMonthSales: 0,
        thisMonthOrders: 0,
        // Waiter-specific
        todayOrdersTaken: 0,
        todayServed: 0,
        monthOrdersTaken: 0,
        monthServed: 0,
        // Chef-specific
        todayPrepared: 0,
        monthPrepared: 0,
    });
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            const now = new Date();
            const today = now.toDateString();

            // For restaurant: calculate from orders (for role-specific stats)
            if (isRestaurant) {
                const ordersRes = await api.get('/order');
                const allOrders = ordersRes.data || [];
                const employeeId = employeeData?._id;

                // Today's orders (all)
                const todayAllOrders = allOrders.filter(o => {
                    const date = new Date(o.createdAt);
                    return date.toDateString() === today;
                });

                // This month's orders (all)
                const thisMonthAllOrders = allOrders.filter(o => {
                    const date = new Date(o.createdAt);
                    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
                });

                if (isManager) {
                    // Manager: use centralized stats endpoint for accurate totals
                    const statsRes = await api.get('/receipt/stats');
                    const data = statsRes.data;

                    setStats({
                        todaySales: data.netTodaySales ?? data.todaySales ?? 0,
                        todayOrders: data.todayOrders ?? 0,
                        thisMonthSales: data.netMonthSales ?? data.monthSales ?? 0,
                        thisMonthOrders: data.monthOrders ?? 0,
                    });
                } else if (isChef) {
                    // Chef: show orders prepared/completed today
                    const todayReady = todayAllOrders.filter(o =>
                        o.status === 'ready' || o.status === 'served' || o.status === 'billed' || o.status === 'paid'
                    );
                    const monthReady = thisMonthAllOrders.filter(o =>
                        o.status === 'ready' || o.status === 'served' || o.status === 'billed' || o.status === 'paid'
                    );

                    setStats({
                        todayOrders: todayAllOrders.length,
                        todayPrepared: todayReady.length,
                        thisMonthOrders: thisMonthAllOrders.length,
                        monthPrepared: monthReady.length,
                    });
                } else {
                    // Waiter: show orders they created & served
                    const myOrders = allOrders.filter(o =>
                        o.createdBy === employeeId || o.createdBy?._id === employeeId
                    );
                    const todayMyOrders = myOrders.filter(o =>
                        new Date(o.createdAt).toDateString() === today
                    );
                    const monthMyOrders = myOrders.filter(o => {
                        const d = new Date(o.createdAt);
                        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                    });
                    const todayServed = todayMyOrders.filter(o =>
                        o.status === 'served' || o.status === 'billed' || o.status === 'paid'
                    );
                    const monthServed = monthMyOrders.filter(o =>
                        o.status === 'served' || o.status === 'billed' || o.status === 'paid'
                    );

                    setStats({
                        todayOrdersTaken: todayMyOrders.length,
                        todayServed: todayServed.length,
                        monthOrdersTaken: monthMyOrders.length,
                        monthServed: monthServed.length,
                    });
                }
            } else {
                // For service/retail: use centralized stats endpoint - single source of truth
                const statsRes = await api.get('/receipt/stats');
                const data = statsRes.data;

                setStats({
                    todaySales: data.netTodaySales ?? data.todaySales ?? 0,
                    todayOrders: data.todayOrders ?? 0,
                    thisMonthSales: data.netMonthSales ?? data.monthSales ?? 0,
                    thisMonthOrders: data.monthOrders ?? 0,
                });
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadStats();
        setRefreshing(false);
        toast.show({
            description: 'Stats refreshed',
            placement: 'top',
            duration: 1500,
        });
    };

    const handleSignOut = async () => {
        Alert.alert(
            'Sign Out',
            'Are you sure you want to sign out?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Sign Out',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await AsyncStorage.multiRemove([
                                'token',
                                'employee',
                                'counterUser',
                                'business',
                                'admin'
                            ]);

                            toast.show({
                                description: 'Signed out successfully',
                                placement: 'top',
                                duration: 2000,
                            });

                            if (onSignOut) {
                                onSignOut();
                            }
                        } catch (error) {
                            console.error('Error signing out:', error);
                            toast.show({
                                description: 'Error signing out',
                                placement: 'top',
                            });
                        }
                    }
                }
            ]
        );
    };

    // Get role display based on business type
    const getRoleDisplay = () => {
        const type = businessType || 'service';
        switch (type) {
            case 'service':
                return 'Service Staff';
            case 'restaurant':
                return 'Restaurant Staff';
            case 'retail':
                return 'Sales Associate';
            default:
                return 'Staff';
        }
    };

    // Get role icon based on business type
    const getRoleIcon = () => {
        const type = businessType || 'service';
        switch (type) {
            case 'service':
                return 'cut-outline'; // Scissors for barber/salon
            case 'restaurant':
                return 'restaurant-outline';
            case 'retail':
                return 'cart-outline';
            default:
                return 'person-outline';
        }
    };

    // Get gradient colors based on business type
    const getGradientColors = () => {
        const type = businessType || 'service';
        switch (type) {
            case 'service':
                return ['#06b6d4', '#0891b2']; // Cyan
            case 'restaurant':
                return ['#f97316', '#ea580c']; // Orange
            case 'retail':
                return ['#8b5cf6', '#7c3aed']; // Purple
            default:
                return ['#06b6d4', '#0891b2'];
        }
    };

    const getStatusColor = () => {
        switch (employeeData?.status) {
            case 'active': return '#10b981';
            case 'inactive': return '#ef4444';
            case 'on_leave': return '#f59e0b';
            default: return '#10b981';
        }
    };

    const ProfileItem = ({ icon, label, value, color = '#64748b' }) => (
        <View style={styles.profileItem}>
            <View style={[styles.itemIconBg, { backgroundColor: color + '15' }]}>
                <Ionicons name={icon} size={20} color={color} />
            </View>
            <View style={styles.itemContent}>
                <Text style={styles.itemLabel}>{label}</Text>
                <Text style={styles.itemValue}>{value || 'Not set'}</Text>
            </View>
        </View>
    );

    const StatCard = ({ title, value, icon, color }) => (
        <View style={styles.statCard}>
            <View style={[styles.statIconBg, { backgroundColor: color + '15' }]}>
                <Ionicons name={icon} size={22} color={color} />
            </View>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statTitle}>{title}</Text>
        </View>
    );

    const insets = useSafeAreaInsets();
    const [isScrolled, setIsScrolled] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const handleScroll = (event) => {
        const scrollY = event.nativeEvent.contentOffset.y;
        const threshold = 100;
        const newIsScrolled = scrollY > threshold;

        if (newIsScrolled !== isScrolled) {
            setIsScrolled(newIsScrolled);
            Animated.timing(fadeAnim, {
                toValue: newIsScrolled ? 1 : 0,
                duration: 200,
                useNativeDriver: false,
            }).start();
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar
                barStyle="dark-content"
                backgroundColor="#06b6d4"
            />

            {/* Fixed header - only shows when scrolled */}
            {isScrolled && (
                <LinearGradient
                    colors={getGradientColors()}
                    style={[styles.stickyHeader, { paddingTop: insets.top }]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <View style={styles.stickyHeaderContent}>
                        {/* Mini Avatar with Online Status */}
                        <View style={styles.stickyAvatarWrapper}>
                            <View style={styles.stickyAvatar}>
                                <Ionicons name="person" size={20} color={getGradientColors()[0]} />
                            </View>
                            <View style={[styles.onlineStatusDot, { backgroundColor: getStatusColor() }]} />
                        </View>

                        {/* Info */}
                        <View style={styles.stickyHeaderCenter}>
                            <Text style={styles.stickyHeaderName}>{employeeData?.name || 'Employee'}</Text>
                            <Text style={styles.stickyRoleText}>{getRoleDisplay()}</Text>
                        </View>

                        {/* Role-appropriate quick stat */}
                        <View style={styles.stickyHeaderRight}>
                            {isRestaurant && !isManager ? (
                                <>
                                    <Text style={styles.stickyHeaderAmount}>
                                        {isChef ? stats.todayPrepared : stats.todayOrdersTaken}
                                    </Text>
                                    <Text style={styles.stickyHeaderLabel}>
                                        {isChef ? 'prepared today' : 'orders today'}
                                    </Text>
                                </>
                            ) : (
                                <>
                                    <Text style={styles.stickyHeaderAmount}>Rs.{stats.todaySales.toLocaleString()}</Text>
                                    <Text style={styles.stickyHeaderLabel}>today</Text>
                                </>
                            )}
                        </View>
                    </View>
                </LinearGradient>
            )}

            <ScrollView
                showsVerticalScrollIndicator={false}
                onScroll={handleScroll}
                scrollEventThrottle={16}
            >
                {/* Header */}
                <LinearGradient
                    colors={getGradientColors()}
                    style={[styles.header, { paddingTop: insets.top + 20 }]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <View style={styles.avatarContainer}>
                        <Ionicons name="person" size={48} color={getGradientColors()[0]} />
                    </View>
                    <Text style={styles.userName}>{employeeData?.name || 'Employee'}</Text>

                    {/* Role Badge with appropriate icon */}
                    <View style={styles.roleBadge}>
                        <Ionicons name={getRoleIcon()} size={16} color="#fff" />
                        <Text style={styles.roleText}>{getRoleDisplay()}</Text>
                    </View>

                    {/* Status Badge */}
                    <View style={styles.statusBadge}>
                        <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
                        <Text style={styles.statusText}>
                            {(employeeData?.status || 'active').replace('_', ' ').toUpperCase()}
                        </Text>
                    </View>
                </LinearGradient>

                {/* Stats - Role-specific */}
                <View style={styles.statsContainer}>
                    {isRestaurant && isChef ? (
                        <>
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionTitle}>Today's Kitchen</Text>
                                <TouchableOpacity
                                    style={styles.refreshBtn}
                                    onPress={handleRefresh}
                                    disabled={refreshing}
                                >
                                    <Ionicons
                                        name="refresh-outline"
                                        size={18}
                                        color={refreshing ? '#94a3b8' : '#3b82f6'}
                                    />
                                    <Text style={[styles.refreshText, refreshing && { color: '#94a3b8' }]}>
                                        {refreshing ? 'Refreshing...' : 'Refresh'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                            <View style={styles.statsRow}>
                                <StatCard
                                    title="Total Orders"
                                    value={stats.todayOrders.toString()}
                                    icon="receipt-outline"
                                    color="#3b82f6"
                                />
                                <StatCard
                                    title="Prepared"
                                    value={stats.todayPrepared.toString()}
                                    icon="checkmark-done-outline"
                                    color="#10b981"
                                />
                            </View>
                            <Text style={[styles.sectionTitle, { marginTop: 8 }]}>This Month</Text>
                            <View style={styles.statsRow}>
                                <StatCard
                                    title="Total Orders"
                                    value={stats.thisMonthOrders.toString()}
                                    icon="calendar-outline"
                                    color="#8b5cf6"
                                />
                                <StatCard
                                    title="Prepared"
                                    value={stats.monthPrepared.toString()}
                                    icon="flame-outline"
                                    color="#f59e0b"
                                />
                            </View>
                        </>
                    ) : isRestaurant && !isManager ? (
                        <>
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionTitle}>Today's Performance</Text>
                                <TouchableOpacity
                                    style={styles.refreshBtn}
                                    onPress={handleRefresh}
                                    disabled={refreshing}
                                >
                                    <Ionicons
                                        name="refresh-outline"
                                        size={18}
                                        color={refreshing ? '#94a3b8' : '#3b82f6'}
                                    />
                                    <Text style={[styles.refreshText, refreshing && { color: '#94a3b8' }]}>
                                        {refreshing ? 'Refreshing...' : 'Refresh'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                            <View style={styles.statsRow}>
                                <StatCard
                                    title="Orders Taken"
                                    value={stats.todayOrdersTaken.toString()}
                                    icon="clipboard-outline"
                                    color="#3b82f6"
                                />
                                <StatCard
                                    title="Served"
                                    value={stats.todayServed.toString()}
                                    icon="checkmark-circle-outline"
                                    color="#10b981"
                                />
                            </View>
                            <Text style={[styles.sectionTitle, { marginTop: 8 }]}>This Month</Text>
                            <View style={styles.statsRow}>
                                <StatCard
                                    title="Orders Taken"
                                    value={stats.monthOrdersTaken.toString()}
                                    icon="calendar-outline"
                                    color="#8b5cf6"
                                />
                                <StatCard
                                    title="Served"
                                    value={stats.monthServed.toString()}
                                    icon="trophy-outline"
                                    color="#f59e0b"
                                />
                            </View>
                        </>
                    ) : (
                        <>
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionTitle}>Today's Performance</Text>
                                <TouchableOpacity
                                    style={styles.refreshBtn}
                                    onPress={handleRefresh}
                                    disabled={refreshing}
                                >
                                    <Ionicons
                                        name="refresh-outline"
                                        size={18}
                                        color={refreshing ? '#94a3b8' : '#3b82f6'}
                                    />
                                    <Text style={[styles.refreshText, refreshing && { color: '#94a3b8' }]}>
                                        {refreshing ? 'Refreshing...' : 'Refresh'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                            <View style={styles.statsRow}>
                                <StatCard
                                    title="Today's Sales"
                                    value={`Rs.${stats.todaySales.toLocaleString()}`}
                                    icon="cash-outline"
                                    color="#10b981"
                                />
                                <StatCard
                                    title="Today's Orders"
                                    value={stats.todayOrders.toString()}
                                    icon="receipt-outline"
                                    color="#3b82f6"
                                />
                            </View>
                            <Text style={[styles.sectionTitle, { marginTop: 8 }]}>This Month</Text>
                            <View style={styles.statsRow}>
                                <StatCard
                                    title="Month Sales"
                                    value={`Rs.${stats.thisMonthSales.toLocaleString()}`}
                                    icon="trending-up-outline"
                                    color="#8b5cf6"
                                />
                                <StatCard
                                    title="Month Orders"
                                    value={stats.thisMonthOrders.toString()}
                                    icon="checkmark-done-outline"
                                    color="#f59e0b"
                                />
                            </View>
                        </>
                    )}
                </View>

                {/* Profile Details */}
                <View style={styles.detailsCard}>
                    <Text style={styles.sectionTitle}>Profile Details</Text>

                    <ProfileItem
                        icon="card-outline"
                        label="Employee ID"
                        value={employeeData?.employeeId}
                        color="#3b82f6"
                    />

                    <ProfileItem
                        icon="business-outline"
                        label="Business"
                        value={businessData?.name}
                        color="#8b5cf6"
                    />

                    {employeeData?.phone && (
                        <ProfileItem
                            icon="call-outline"
                            label="Phone"
                            value={employeeData.phone}
                            color="#10b981"
                        />
                    )}

                    {employeeData?.email && (
                        <ProfileItem
                            icon="mail-outline"
                            label="Email"
                            value={employeeData.email}
                            color="#f59e0b"
                        />
                    )}

                    {employeeData?.specializations?.length > 0 && (
                        <ProfileItem
                            icon="star-outline"
                            label="Specializations"
                            value={employeeData.specializations.join(', ')}
                            color="#ec4899"
                        />
                    )}

                    {canSeeSales && (
                        <ProfileItem
                            icon="analytics-outline"
                            label="Commission Rate"
                            value={`${employeeData?.commissionRate || 0}%`}
                            color="#06b6d4"
                        />
                    )}
                </View>

                {/* Actions */}
                <View style={styles.actionsCard}>
                    {canSeeSales && (
                        <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={() => navigation.navigate('Transactions')}
                        >
                            <View style={[styles.actionIconBg, { backgroundColor: '#dbeafe' }]}>
                                <Ionicons name="time-outline" size={22} color="#3b82f6" />
                            </View>
                            <Text style={styles.actionText}>View Transaction History</Text>
                            <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => Alert.alert('Coming Soon', 'Change password feature will be available soon')}
                    >
                        <View style={[styles.actionIconBg, { backgroundColor: '#fef3c7' }]}>
                            <Ionicons name="lock-closed-outline" size={22} color="#f59e0b" />
                        </View>
                        <Text style={styles.actionText}>Change Password</Text>
                        <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                    </TouchableOpacity>
                </View>

                {/* Sign Out Button */}
                <TouchableOpacity
                    style={styles.signOutBtn}
                    onPress={handleSignOut}
                >
                    <Ionicons name="log-out-outline" size={22} color="#ef4444" />
                    <Text style={styles.signOutText}>Sign Out</Text>
                </TouchableOpacity>

                <View style={{ height: 100 }} />
            </ScrollView>
        </View>
    );
};

export default MyProfileScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    stickyHeader: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        minHeight: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
    },
    stickyHeaderContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 12,
    },
    stickyAvatarWrapper: {
        position: 'relative',
    },
    stickyAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    onlineStatusDot: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#fff',
    },
    stickyHeaderCenter: {
        flex: 1,
    },
    stickyHeaderName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 4,
    },
    stickyRoleText: {
        fontSize: 13,
        fontWeight: '500',
        color: 'rgba(255,255,255,0.85)',
    },
    stickyHeaderRight: {
        alignItems: 'flex-end',
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
    },
    stickyHeaderAmount: {
        fontSize: 15,
        fontWeight: '700',
        color: '#fff',
    },
    stickyHeaderLabel: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 1,
    },
    header: {
        alignItems: 'center',
        paddingBottom: 30,
    },
    avatarContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 8,
    },
    userName: {
        fontSize: 24,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 8,
    },
    roleBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.2)',
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 6,
        marginBottom: 10,
    },
    roleText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 6,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#fff',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1e293b',
    },
    refreshBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 6,
        paddingHorizontal: 10,
        backgroundColor: '#eff6ff',
        borderRadius: 8,
    },
    refreshText: {
        fontSize: 13,
        color: '#3b82f6',
        fontWeight: '500',
    },
    statsContainer: {
        padding: 16,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12,
    },
    statCard: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    statIconBg: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    statValue: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 2,
    },
    statTitle: {
        fontSize: 12,
        color: '#64748b',
    },
    detailsCard: {
        backgroundColor: '#fff',
        margin: 16,
        marginTop: 0,
        borderRadius: 16,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    profileItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    itemIconBg: {
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    itemContent: {
        flex: 1,
        marginLeft: 14,
    },
    itemLabel: {
        fontSize: 12,
        color: '#94a3b8',
        marginBottom: 2,
    },
    itemValue: {
        fontSize: 15,
        fontWeight: '500',
        color: '#1e293b',
    },
    actionsCard: {
        backgroundColor: '#fff',
        marginHorizontal: 16,
        borderRadius: 16,
        padding: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 12,
        gap: 12,
    },
    actionIconBg: {
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionText: {
        flex: 1,
        fontSize: 15,
        color: '#1e293b',
        fontWeight: '500',
    },
    signOutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fef2f2',
        marginHorizontal: 16,
        marginTop: 16,
        borderRadius: 12,
        paddingVertical: 14,
        gap: 8,
        borderWidth: 1,
        borderColor: '#fecaca',
    },
    signOutText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#ef4444',
    },
});
