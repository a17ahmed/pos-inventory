import React, { useState, useEffect, useCallback } from 'react';
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TouchableOpacity,
    Alert,
    Platform,
    StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useToast } from 'native-base';
import api from '../../../constants/api';

const AdminProfileScreen = ({ navigation, adminData, businessData, businessType, onSignOut }) => {
    const toast = useToast();
    const insets = useSafeAreaInsets();
    const [isScrolled, setIsScrolled] = useState(false);
    const [stats, setStats] = useState({
        todaySales: 0,
        totalTransactions: 0,
        thisMonthSales: 0,
        monthRefunds: 0,
        staffCount: 0,
    });

    useEffect(() => {
        loadStats();
    }, []);

    // Set status bar on focus - dark-content for consistency
    useFocusEffect(
        useCallback(() => {
            StatusBar.setBarStyle('dark-content');
            return () => {};
        }, [])
    );

    const [refreshing, setRefreshing] = useState(false);

    const loadStats = async () => {
        try {
            // Use centralized stats endpoint - single source of truth
            const statsRes = await api.get('/receipt/stats');
            const data = statsRes.data;

            // Calculate month refunds (linked + raw returns for this month)
            const monthLinkedReturns = (data.monthSales ?? 0) - (data.netMonthSales ?? data.monthSales ?? 0);

            setStats({
                todaySales: data.netTodaySales ?? data.todaySales ?? 0,
                totalTransactions: data.todayOrders ?? 0,
                thisMonthSales: data.netMonthSales ?? data.monthSales ?? 0,
                monthTransactions: data.monthOrders ?? 0,
                monthRefunds: monthLinkedReturns,
                staffCount: 0,
            });
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

    const handleScroll = (event) => {
        const scrollY = event.nativeEvent.contentOffset.y;
        setIsScrolled(scrollY > 100);
    };

    // Get gradient colors based on business type
    const getGradientColors = () => {
        switch (businessType) {
            case 'service':
                return ['#06b6d4', '#0891b2']; // Cyan
            case 'retail':
                return ['#8b5cf6', '#7c3aed']; // Purple
            default:
                return ['#f97316', '#ea580c']; // Orange
        }
    };

    // Get business icon
    const getBusinessIcon = () => {
        switch (businessType) {
            case 'service':
                return 'cut-outline';
            case 'retail':
                return 'storefront-outline';
            default:
                return 'restaurant-outline';
        }
    };

    // Get business type label
    const getBusinessTypeLabel = () => {
        switch (businessType) {
            case 'service':
                return 'Service Business';
            case 'retail':
                return 'Retail Store';
            default:
                return 'Restaurant';
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

    return (
        <View style={[styles.container, { backgroundColor: getGradientColors()[0] }]}>
            <StatusBar barStyle="dark-content" backgroundColor={getGradientColors()[0]} />

            {/* Sticky Header - appears when scrolled */}
            {isScrolled && (
                <LinearGradient
                    colors={getGradientColors()}
                    style={[styles.stickyHeader, { paddingTop: insets.top }]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <View style={styles.stickyHeaderContent}>
                        <View style={styles.stickyAvatarWrapper}>
                            <View style={styles.stickyAvatar}>
                                <Ionicons name="person" size={20} color={getGradientColors()[0]} />
                            </View>
                            <View style={styles.onlineStatusDot} />
                        </View>
                        <View style={styles.stickyHeaderCenter}>
                            <Text style={styles.stickyHeaderName}>{adminData?.name || 'Admin'}</Text>
                            <Text style={styles.stickyRoleText}>Administrator</Text>
                        </View>
                        <View style={styles.stickyHeaderRight}>
                            <Text style={styles.stickyHeaderAmount}>Rs.{(stats.thisMonthSales || 0).toLocaleString()}</Text>
                            <Text style={styles.stickyHeaderLabel}>this month</Text>
                        </View>
                    </View>
                </LinearGradient>
            )}

            <ScrollView
                showsVerticalScrollIndicator={false}
                style={{ backgroundColor: '#f8fafc' }}
                contentContainerStyle={{ backgroundColor: '#f8fafc' }}
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
                    <Text style={styles.userName}>{adminData?.name || 'Admin'}</Text>

                    {/* Role Badge */}
                    <View style={styles.roleBadge}>
                        <Ionicons name="shield-checkmark-outline" size={16} color="#fff" />
                        <Text style={styles.roleText}>Administrator</Text>
                    </View>

                    {/* Business Badge */}
                    <View style={styles.businessBadge}>
                        <Ionicons name={getBusinessIcon()} size={14} color="#fff" />
                        <Text style={styles.businessText}>{businessData?.name || 'Your Business'}</Text>
                    </View>
                </LinearGradient>

                {/* Stats */}
                <View style={styles.statsContainer}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Business Overview</Text>
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
                            title="Today"
                            value={`Rs.${(stats.todaySales || 0).toLocaleString()}`}
                            icon="today-outline"
                            color="#10b981"
                        />
                        <StatCard
                            title="This Month"
                            value={`Rs.${(stats.thisMonthSales || 0).toLocaleString()}`}
                            icon="calendar-outline"
                            color="#3b82f6"
                        />
                    </View>
                    <View style={styles.statsRow}>
                        <StatCard
                            title="Transactions"
                            value={(stats.monthTransactions || 0).toString()}
                            icon="receipt-outline"
                            color="#8b5cf6"
                        />
                        <StatCard
                            title="Month Refunds"
                            value={`Rs.${(stats.monthRefunds || 0).toLocaleString()}`}
                            icon="arrow-undo-outline"
                            color="#ef4444"
                        />
                    </View>
                </View>

                {/* Profile Details */}
                <View style={styles.detailsCard}>
                    <Text style={styles.sectionTitle}>Account Details</Text>

                    <ProfileItem
                        icon="mail-outline"
                        label="Email"
                        value={adminData?.email}
                        color="#3b82f6"
                    />

                    <ProfileItem
                        icon="business-outline"
                        label="Business"
                        value={businessData?.name}
                        color="#8b5cf6"
                    />

                    <ProfileItem
                        icon="location-outline"
                        label="Address"
                        value={
                            businessData?.address
                                ? typeof businessData.address === 'string'
                                    ? businessData.address
                                    : [businessData.address.street, businessData.address.city, businessData.address.state].filter(Boolean).join(', ')
                                : null
                        }
                        color="#10b981"
                    />

                    {businessData?.phone && (
                        <ProfileItem
                            icon="call-outline"
                            label="Phone"
                            value={businessData.phone}
                            color="#f59e0b"
                        />
                    )}

                    <ProfileItem
                        icon="cash-outline"
                        label="Currency"
                        value={businessData?.currency || 'PKR'}
                        color="#06b6d4"
                    />
                </View>

                {/* Actions */}
                <View style={styles.actionsCard}>
                    <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => navigation.navigate('BusinessSettings', { businessType })}
                    >
                        <View style={[styles.actionIconBg, { backgroundColor: '#dbeafe' }]}>
                            <Ionicons name="settings-outline" size={22} color="#3b82f6" />
                        </View>
                        <Text style={styles.actionText}>Business Settings</Text>
                        <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                    </TouchableOpacity>

                    {businessType === 'restaurant' && (
                        <>
                            <TouchableOpacity
                                style={styles.actionBtn}
                                onPress={() => navigation.navigate('TableManagement', { businessType })}
                            >
                                <View style={[styles.actionIconBg, { backgroundColor: '#e0e7ff' }]}>
                                    <Ionicons name="grid-outline" size={22} color="#6366f1" />
                                </View>
                                <Text style={styles.actionText}>Table Management</Text>
                                <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.actionBtn}
                                onPress={() => navigation.navigate('DealManagement', { businessType })}
                            >
                                <View style={[styles.actionIconBg, { backgroundColor: '#dcfce7' }]}>
                                    <Ionicons name="pricetag-outline" size={22} color="#22c55e" />
                                </View>
                                <Text style={styles.actionText}>Deal Management</Text>
                                <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.actionBtn}
                                onPress={() => navigation.navigate('Reservations', { businessType })}
                            >
                                <View style={[styles.actionIconBg, { backgroundColor: '#fce7f3' }]}>
                                    <Ionicons name="calendar-outline" size={22} color="#ec4899" />
                                </View>
                                <Text style={styles.actionText}>Reservations</Text>
                                <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                            </TouchableOpacity>
                        </>
                    )}

                    {businessType === 'retail' && (
                        <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={() => navigation.navigate('ProductManagement', { businessType })}
                        >
                            <View style={[styles.actionIconBg, { backgroundColor: '#f3e8ff' }]}>
                                <Ionicons name="cube-outline" size={22} color="#8b5cf6" />
                            </View>
                            <Text style={styles.actionText}>Product Management</Text>
                            <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => navigation.navigate('DailyReports', { businessType })}
                    >
                        <View style={[styles.actionIconBg, { backgroundColor: '#fff7ed' }]}>
                            <Ionicons name="bar-chart-outline" size={22} color="#f97316" />
                        </View>
                        <Text style={styles.actionText}>Daily Reports</Text>
                        <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => navigation.navigate('Expenses')}
                    >
                        <View style={[styles.actionIconBg, { backgroundColor: '#fee2e2' }]}>
                            <Ionicons name="wallet-outline" size={22} color="#ef4444" />
                        </View>
                        <Text style={styles.actionText}>Expenses</Text>
                        <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => navigation.navigate('CounterUsers')}
                    >
                        <View style={[styles.actionIconBg, { backgroundColor: '#f3e8ff' }]}>
                            <Ionicons name="people-outline" size={22} color="#8b5cf6" />
                        </View>
                        <Text style={styles.actionText}>Counter Users</Text>
                        <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                    </TouchableOpacity>

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

                    <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => Alert.alert('Coming Soon', 'Export data feature will be available soon')}
                    >
                        <View style={[styles.actionIconBg, { backgroundColor: '#f3e8ff' }]}>
                            <Ionicons name="download-outline" size={22} color="#8b5cf6" />
                        </View>
                        <Text style={styles.actionText}>Export Data</Text>
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

export default AdminProfileScreen;

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
        zIndex: 999,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 8,
    },
    stickyHeaderContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
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
    },
    onlineStatusDot: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#22c55e',
        borderWidth: 2,
        borderColor: '#fff',
    },
    stickyHeaderCenter: {
        flex: 1,
        marginLeft: 12,
    },
    stickyHeaderName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
    stickyRoleText: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.85)',
        marginTop: 1,
    },
    stickyHeaderRight: {
        alignItems: 'flex-end',
    },
    stickyHeaderAmount: {
        fontSize: 15,
        fontWeight: '700',
        color: '#fff',
    },
    stickyHeaderLabel: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.75)',
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
    businessBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 6,
    },
    businessText: {
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
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 2,
        textAlign: 'center',
    },
    statTitle: {
        fontSize: 12,
        color: '#64748b',
        textAlign: 'center',
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
