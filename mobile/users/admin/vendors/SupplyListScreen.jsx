import React, { useState, useCallback } from 'react';
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
    Alert,
    TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../../constants/api';
import { shadows } from '../../../constants/theme';
import { useBusiness } from '../../../context/BusinessContext';

const STATUS_COLORS = {
    unpaid: { bg: '#fee2e2', text: '#dc2626' },
    partial: { bg: '#fef3c7', text: '#d97706' },
    paid: { bg: '#dcfce7', text: '#16a34a' },
};

const SupplyListScreen = ({ navigation }) => {
    const { config } = useBusiness();
    const insets = useSafeAreaInsets();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [supplies, setSupplies] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [stats, setStats] = useState(null);
    const [filter, setFilter] = useState('all');
    const [activeTab, setActiveTab] = useState('supplies'); // supplies | vendors
    const [search, setSearch] = useState('');
    const [businessData, setBusinessData] = useState(null);

    const primaryColor = config?.colors?.primary || '#6366f1';

    useFocusEffect(
        useCallback(() => {
            StatusBar.setBarStyle('light-content');
            loadAll();
            return () => {};
        }, [filter])
    );

    const loadAll = async () => {
        try {
            const businessStr = await AsyncStorage.getItem('business');
            if (businessStr) setBusinessData(JSON.parse(businessStr));
        } catch (e) {}

        await Promise.all([fetchSupplies(), fetchVendors(), fetchStats()]);
        setLoading(false);
        setRefreshing(false);
    };

    const fetchSupplies = async () => {
        try {
            const params = filter !== 'all' ? `?paymentStatus=${filter}` : '';
            const response = await api.get(`/supply${params}`);
            setSupplies(response.data.supplies || []);
        } catch (error) {
            console.log('Error fetching supplies:', error);
        }
    };

    const fetchVendors = async () => {
        try {
            const response = await api.get('/vendor');
            setVendors(response.data);
        } catch (error) {
            console.log('Error fetching vendors:', error);
        }
    };

    const fetchStats = async () => {
        try {
            const response = await api.get('/supply/stats');
            setStats(response.data);
        } catch (error) {
            console.log('Error fetching stats:', error);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadAll();
    };

    const currency = businessData?.currency || 'PKR';

    const formatCurrency = (amount) => `${currency} ${(amount || 0).toLocaleString()}`;

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const filteredSupplies = supplies.filter(s =>
        s.vendorName?.toLowerCase().includes(search.toLowerCase()) ||
        s.billNumber?.toLowerCase().includes(search.toLowerCase())
    );

    const filteredVendors = vendors.filter(v =>
        v.name?.toLowerCase().includes(search.toLowerCase())
    );

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={primaryColor} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={primaryColor} />

            {/* Header */}
            <LinearGradient colors={[primaryColor, '#8b5cf6']} style={[styles.header, { paddingTop: insets.top + 16 }]}>
                <View style={styles.headerTop}>
                    <Text style={styles.headerTitle}>Vendors & Supplies</Text>
                </View>

                {/* Stats */}
                {stats && (
                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text style={styles.statLabel}>Outstanding</Text>
                            <Text style={styles.statValue}>
                                {formatCurrency(stats.overall?.totalRemaining)}
                            </Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statLabel}>This Month</Text>
                            <Text style={styles.statValue}>
                                {formatCurrency(stats.thisMonth?.totalAmount)}
                            </Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statLabel}>Supplies</Text>
                            <Text style={styles.statValue}>{stats.overall?.count || 0}</Text>
                        </View>
                    </View>
                )}
            </LinearGradient>

            {/* Tab Switcher */}
            <View style={styles.tabRow}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'supplies' && { backgroundColor: primaryColor }]}
                    onPress={() => setActiveTab('supplies')}
                >
                    <Text style={[styles.tabText, activeTab === 'supplies' && { color: '#fff' }]}>
                        Supplies
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'vendors' && { backgroundColor: primaryColor }]}
                    onPress={() => setActiveTab('vendors')}
                >
                    <Text style={[styles.tabText, activeTab === 'vendors' && { color: '#fff' }]}>
                        Vendors
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={styles.searchRow}>
                <View style={styles.searchBox}>
                    <Ionicons name="search" size={18} color="#94a3b8" />
                    <TextInput
                        style={styles.searchInput}
                        value={search}
                        onChangeText={setSearch}
                        placeholder={activeTab === 'supplies' ? 'Search by vendor or bill #' : 'Search vendors'}
                        placeholderTextColor="#94a3b8"
                    />
                    {search ? (
                        <TouchableOpacity onPress={() => setSearch('')}>
                            <Ionicons name="close-circle" size={18} color="#94a3b8" />
                        </TouchableOpacity>
                    ) : null}
                </View>
            </View>

            {/* Filter chips (supplies only) */}
            {activeTab === 'supplies' && (
                <View style={styles.filterChips}>
                    {['all', 'unpaid', 'partial', 'paid'].map((f) => (
                        <TouchableOpacity
                            key={f}
                            style={[styles.filterChip, filter === f && { backgroundColor: primaryColor }]}
                            onPress={() => setFilter(f)}
                        >
                            <Text style={[styles.filterChipText, filter === f && { color: '#fff' }]}>
                                {f.charAt(0).toUpperCase() + f.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {/* Content */}
            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primaryColor} />}
            >
                {activeTab === 'supplies' ? (
                    filteredSupplies.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Ionicons name="cube-outline" size={64} color="#cbd5e1" />
                            <Text style={styles.emptyText}>No supplies found</Text>
                            <Text style={styles.emptySubtext}>
                                {filter !== 'all' ? `No ${filter} supplies` : 'Record your first supply'}
                            </Text>
                        </View>
                    ) : (
                        filteredSupplies.map((supply) => (
                            <TouchableOpacity
                                key={supply._id}
                                style={styles.card}
                                onPress={() => navigation.navigate('SupplyDetail', { supplyId: supply._id })}
                                activeOpacity={0.7}
                            >
                                <View style={styles.cardHeader}>
                                    <View style={[styles.cardIcon, { backgroundColor: `${primaryColor}15` }]}>
                                        <Ionicons name="cube" size={20} color={primaryColor} />
                                    </View>
                                    <View style={styles.cardInfo}>
                                        <Text style={styles.cardTitle}>{supply.vendorName}</Text>
                                        <Text style={styles.cardSubtitle}>
                                            {supply.billNumber ? `Bill #${supply.billNumber}` : `Supply #${supply.supplyNumber}`}
                                        </Text>
                                    </View>
                                    <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[supply.paymentStatus].bg }]}>
                                        <Text style={[styles.statusText, { color: STATUS_COLORS[supply.paymentStatus].text }]}>
                                            {supply.paymentStatus}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.cardFooter}>
                                    <View style={styles.cardDate}>
                                        <Ionicons name="calendar-outline" size={14} color="#94a3b8" />
                                        <Text style={styles.cardDateText}>{formatDate(supply.billDate)}</Text>
                                    </View>
                                    <View style={styles.cardAmounts}>
                                        <Text style={styles.cardTotal}>{formatCurrency(supply.totalAmount)}</Text>
                                        {supply.remainingAmount > 0 && (
                                            <Text style={styles.cardRemaining}>Due: {formatCurrency(supply.remainingAmount)}</Text>
                                        )}
                                    </View>
                                </View>
                            </TouchableOpacity>
                        ))
                    )
                ) : (
                    filteredVendors.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Ionicons name="business-outline" size={64} color="#cbd5e1" />
                            <Text style={styles.emptyText}>No vendors found</Text>
                            <Text style={styles.emptySubtext}>Add your first vendor</Text>
                        </View>
                    ) : (
                        filteredVendors.map((vendor) => (
                            <TouchableOpacity
                                key={vendor._id}
                                style={styles.card}
                                onPress={() => {
                                    setActiveTab('supplies');
                                    setSearch(vendor.name);
                                }}
                                activeOpacity={0.7}
                            >
                                <View style={styles.cardHeader}>
                                    <View style={[styles.cardIcon, { backgroundColor: `${primaryColor}15` }]}>
                                        <Ionicons name="business" size={20} color={primaryColor} />
                                    </View>
                                    <View style={styles.cardInfo}>
                                        <Text style={styles.cardTitle}>{vendor.name}</Text>
                                        {vendor.company ? (
                                            <Text style={styles.cardSubtitle}>{vendor.company}</Text>
                                        ) : null}
                                    </View>
                                    <Text style={styles.vendorSupplyCount}>{vendor.supplyCount || 0} supplies</Text>
                                </View>

                                <View style={styles.cardFooter}>
                                    <View>
                                        <Text style={styles.vendorStatLabel}>Total Business</Text>
                                        <Text style={styles.vendorStatValue}>{formatCurrency(vendor.totalBusiness)}</Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={styles.vendorStatLabel}>Remaining</Text>
                                        <Text style={[
                                            styles.vendorStatValue,
                                            { color: vendor.totalRemaining > 0 ? '#ef4444' : '#16a34a' }
                                        ]}>
                                            {formatCurrency(vendor.totalRemaining)}
                                        </Text>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        ))
                    )
                )}

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* FAB */}
            <TouchableOpacity
                style={[styles.fab, { backgroundColor: primaryColor }]}
                onPress={() => {
                    if (activeTab === 'vendors') {
                        navigation.navigate('AddVendor');
                    } else {
                        navigation.navigate('AddSupply');
                    }
                }}
            >
                <Ionicons name="add" size={28} color="#fff" />
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    loadingContainer: {
        flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc',
    },
    header: {
        paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight + 10,
        paddingBottom: 20, paddingHorizontal: 16,
    },
    headerTop: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16,
    },
    backBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
    statsRow: {
        flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: 12, padding: 12,
    },
    statItem: { flex: 1, alignItems: 'center' },
    statLabel: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginBottom: 4 },
    statValue: { fontSize: 16, fontWeight: '700', color: '#fff' },
    statDivider: {
        width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 8,
    },
    tabRow: {
        flexDirection: 'row', marginHorizontal: 16, marginTop: 12, gap: 8,
    },
    tab: {
        flex: 1, paddingVertical: 10, borderRadius: 10,
        backgroundColor: '#e2e8f0', alignItems: 'center',
    },
    tabText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
    searchRow: { paddingHorizontal: 16, marginTop: 12 },
    searchBox: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
        borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
        ...shadows.sm,
    },
    searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: '#1e293b' },
    filterChips: {
        flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 8,
    },
    filterChip: {
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
        backgroundColor: '#e2e8f0',
    },
    filterChipText: { fontSize: 13, fontWeight: '500', color: '#64748b' },
    content: { flex: 1, paddingHorizontal: 16 },
    emptyState: {
        alignItems: 'center', justifyContent: 'center', paddingVertical: 60,
    },
    emptyText: { fontSize: 18, fontWeight: '600', color: '#64748b', marginTop: 16 },
    emptySubtext: { fontSize: 14, color: '#94a3b8', marginTop: 4 },
    card: {
        backgroundColor: '#fff', borderRadius: 14, padding: 16,
        marginBottom: 12, ...shadows.sm,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center' },
    cardIcon: {
        width: 44, height: 44, borderRadius: 12,
        alignItems: 'center', justifyContent: 'center',
    },
    cardInfo: { flex: 1, marginLeft: 12 },
    cardTitle: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
    cardSubtitle: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
    statusText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
    cardFooter: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9',
    },
    cardDate: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    cardDateText: { fontSize: 13, color: '#94a3b8' },
    cardAmounts: { alignItems: 'flex-end' },
    cardTotal: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
    cardRemaining: { fontSize: 12, color: '#ef4444', marginTop: 2 },
    vendorSupplyCount: { fontSize: 12, color: '#94a3b8' },
    vendorStatLabel: { fontSize: 12, color: '#94a3b8', marginBottom: 2 },
    vendorStatValue: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
    fab: {
        position: 'absolute', bottom: 24, right: 20,
        width: 56, height: 56, borderRadius: 28,
        alignItems: 'center', justifyContent: 'center', ...shadows.lg,
    },
});

export default SupplyListScreen;
