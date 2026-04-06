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
    Alert,
    Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../../constants/api';
import { colors, shadows } from '../../../constants/theme';
import { useBusiness } from '../../../context/BusinessContext';

const CATEGORY_LABELS = {
    rent: 'Rent',
    utilities: 'Utilities',
    supplies: 'Supplies',
    wages: 'Wages',
    maintenance: 'Maintenance',
    transport: 'Transport',
    marketing: 'Marketing',
    insurance: 'Insurance',
    taxes: 'Taxes',
    equipment: 'Equipment',
    bank_fees: 'Bank Fees',
    other: 'Other'
};

const CATEGORY_ICONS = {
    rent: 'home',
    utilities: 'flash',
    supplies: 'cube',
    wages: 'people',
    maintenance: 'construct',
    transport: 'car',
    marketing: 'megaphone',
    insurance: 'shield-checkmark',
    taxes: 'document-text',
    equipment: 'hardware-chip',
    bank_fees: 'card',
    other: 'ellipsis-horizontal'
};

const STATUS_COLORS = {
    pending: { bg: '#fef3c7', text: '#d97706' },
    approved: { bg: '#dcfce7', text: '#16a34a' },
    rejected: { bg: '#fee2e2', text: '#dc2626' }
};

const ExpenseListScreen = ({ navigation }) => {
    const { config } = useBusiness();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [expenses, setExpenses] = useState([]);
    const [stats, setStats] = useState(null);
    const [filter, setFilter] = useState('all'); // all, pending, approved, rejected
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [businessData, setBusinessData] = useState(null);

    useEffect(() => {
        loadBusinessData();
    }, []);

    useFocusEffect(
        useCallback(() => {
            StatusBar.setBarStyle('light-content');
            fetchExpenses();
            fetchStats();
            return () => {};
        }, [filter])
    );

    const loadBusinessData = async () => {
        try {
            const businessStr = await AsyncStorage.getItem('business');
            if (businessStr) {
                setBusinessData(JSON.parse(businessStr));
            }
        } catch (error) {
            console.log('Error loading business data:', error);
        }
    };

    const fetchExpenses = async () => {
        try {
            const params = filter !== 'all' ? `?status=${filter}` : '';
            const response = await api.get(`/expense${params}`);
            setExpenses(response.data.expenses || []);
        } catch (error) {
            console.log('Error fetching expenses:', error);
            Alert.alert('Error', 'Failed to load expenses');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const fetchStats = async () => {
        try {
            const response = await api.get('/expense/stats');
            setStats(response.data);
        } catch (error) {
            console.log('Error fetching expense stats:', error);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchExpenses();
        fetchStats();
    };

    const handleApprove = async (expense) => {
        Alert.alert(
            'Approve Expense',
            `Approve expense #${expense.expenseNumber} for ${formatCurrency(expense.amount)}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Approve',
                    onPress: async () => {
                        try {
                            await api.post(`/expense/${expense._id}/approve`);
                            fetchExpenses();
                            fetchStats();
                        } catch (error) {
                            Alert.alert('Error', error.response?.data?.error || 'Failed to approve expense');
                        }
                    }
                }
            ]
        );
    };

    const handleReject = (expense) => {
        Alert.prompt(
            'Reject Expense',
            'Please provide a reason for rejection:',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reject',
                    style: 'destructive',
                    onPress: async (reason) => {
                        if (!reason?.trim()) {
                            Alert.alert('Error', 'Rejection reason is required');
                            return;
                        }
                        try {
                            await api.post(`/expense/${expense._id}/reject`, { reason });
                            fetchExpenses();
                            fetchStats();
                        } catch (error) {
                            Alert.alert('Error', error.response?.data?.error || 'Failed to reject expense');
                        }
                    }
                }
            ],
            'plain-text'
        );
    };

    const formatCurrency = (amount) => {
        const currency = businessData?.currency || 'PKR';
        return `${currency} ${(amount || 0).toLocaleString()}`;
    };

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const primaryColor = config?.colors?.primary || '#6366f1';

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
            <LinearGradient
                colors={[primaryColor, '#8b5cf6']}
                style={styles.header}
            >
                <View style={styles.headerTop}>
                    <TouchableOpacity
                        style={styles.backBtn}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Expenses</Text>
                    <TouchableOpacity
                        style={styles.filterBtn}
                        onPress={() => setShowFilterModal(true)}
                    >
                        <Ionicons name="filter" size={22} color="#fff" />
                    </TouchableOpacity>
                </View>

                {/* Stats Summary */}
                {stats && (
                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text style={styles.statLabel}>This Month</Text>
                            <Text style={styles.statValue}>{formatCurrency(stats.monthExpenses)}</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statLabel}>Pending</Text>
                            <Text style={styles.statValue}>{stats.pendingCount || 0}</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statLabel}>Total</Text>
                            <Text style={styles.statValue}>{formatCurrency(stats.totalExpenses)}</Text>
                        </View>
                    </View>
                )}
            </LinearGradient>

            {/* Filter Chips */}
            <View style={styles.filterChips}>
                {['all', 'pending', 'approved', 'rejected'].map((f) => (
                    <TouchableOpacity
                        key={f}
                        style={[
                            styles.filterChip,
                            filter === f && { backgroundColor: primaryColor }
                        ]}
                        onPress={() => setFilter(f)}
                    >
                        <Text style={[
                            styles.filterChipText,
                            filter === f && { color: '#fff' }
                        ]}>
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Expense List */}
            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {expenses.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="receipt-outline" size={64} color="#cbd5e1" />
                        <Text style={styles.emptyText}>No expenses found</Text>
                        <Text style={styles.emptySubtext}>
                            {filter !== 'all' ? `No ${filter} expenses` : 'Add your first expense'}
                        </Text>
                    </View>
                ) : (
                    expenses.map((expense) => (
                        <TouchableOpacity
                            key={expense._id}
                            style={styles.expenseCard}
                            onPress={() => navigation.navigate('ExpenseDetail', { expense })}
                            activeOpacity={0.7}
                        >
                            <View style={styles.expenseHeader}>
                                <View style={[styles.categoryIcon, { backgroundColor: `${primaryColor}15` }]}>
                                    <Ionicons
                                        name={CATEGORY_ICONS[expense.category] || 'ellipsis-horizontal'}
                                        size={20}
                                        color={primaryColor}
                                    />
                                </View>
                                <View style={styles.expenseInfo}>
                                    <Text style={styles.expenseCategory}>
                                        {CATEGORY_LABELS[expense.category] || expense.category}
                                    </Text>
                                    <Text style={styles.expenseNumber}>#{expense.expenseNumber}</Text>
                                </View>
                                <View style={[
                                    styles.statusBadge,
                                    { backgroundColor: STATUS_COLORS[expense.status].bg }
                                ]}>
                                    <Text style={[
                                        styles.statusText,
                                        { color: STATUS_COLORS[expense.status].text }
                                    ]}>
                                        {expense.status}
                                    </Text>
                                </View>
                            </View>

                            {expense.description ? (
                                <Text style={styles.expenseDescription} numberOfLines={2}>
                                    {expense.description}
                                </Text>
                            ) : null}

                            <View style={styles.expenseFooter}>
                                <View style={styles.expenseDate}>
                                    <Ionicons name="calendar-outline" size={14} color="#94a3b8" />
                                    <Text style={styles.expenseDateText}>{formatDate(expense.date)}</Text>
                                </View>
                                <Text style={styles.expenseAmount}>{formatCurrency(expense.amount)}</Text>
                            </View>

                            {/* Quick Actions for Pending */}
                            {expense.status === 'pending' && (
                                <View style={styles.quickActions}>
                                    <TouchableOpacity
                                        style={[styles.actionBtn, styles.rejectBtn]}
                                        onPress={() => handleReject(expense)}
                                    >
                                        <Ionicons name="close" size={18} color="#dc2626" />
                                        <Text style={styles.rejectBtnText}>Reject</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.actionBtn, styles.approveBtn]}
                                        onPress={() => handleApprove(expense)}
                                    >
                                        <Ionicons name="checkmark" size={18} color="#16a34a" />
                                        <Text style={styles.approveBtnText}>Approve</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </TouchableOpacity>
                    ))
                )}

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Add Button */}
            <TouchableOpacity
                style={[styles.fab, { backgroundColor: primaryColor }]}
                onPress={() => navigation.navigate('AddExpense')}
            >
                <Ionicons name="add" size={28} color="#fff" />
            </TouchableOpacity>

            {/* Filter Modal */}
            <Modal
                visible={showFilterModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowFilterModal(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowFilterModal(false)}
                >
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Filter Expenses</Text>
                        {['all', 'pending', 'approved', 'rejected'].map((f) => (
                            <TouchableOpacity
                                key={f}
                                style={[
                                    styles.modalOption,
                                    filter === f && styles.modalOptionActive
                                ]}
                                onPress={() => {
                                    setFilter(f);
                                    setShowFilterModal(false);
                                }}
                            >
                                <Text style={[
                                    styles.modalOptionText,
                                    filter === f && { color: primaryColor, fontWeight: '600' }
                                ]}>
                                    {f.charAt(0).toUpperCase() + f.slice(1)}
                                </Text>
                                {filter === f && (
                                    <Ionicons name="checkmark" size={20} color={primaryColor} />
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
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
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
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
    filterBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    statsRow: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: 12,
        padding: 12,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statLabel: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.8)',
        marginBottom: 4,
    },
    statValue: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
    statDivider: {
        width: 1,
        backgroundColor: 'rgba(255,255,255,0.2)',
        marginHorizontal: 8,
    },
    filterChips: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 8,
    },
    filterChip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#e2e8f0',
    },
    filterChipText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#64748b',
    },
    content: {
        flex: 1,
        paddingHorizontal: 16,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#64748b',
        marginTop: 16,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#94a3b8',
        marginTop: 4,
    },
    expenseCard: {
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 16,
        marginBottom: 12,
        ...shadows.sm,
    },
    expenseHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    categoryIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    expenseInfo: {
        flex: 1,
        marginLeft: 12,
    },
    expenseCategory: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1e293b',
    },
    expenseNumber: {
        fontSize: 13,
        color: '#94a3b8',
        marginTop: 2,
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'capitalize',
    },
    expenseDescription: {
        fontSize: 14,
        color: '#64748b',
        marginTop: 12,
        lineHeight: 20,
    },
    expenseFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    expenseDate: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    expenseDateText: {
        fontSize: 13,
        color: '#94a3b8',
    },
    expenseAmount: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
    },
    quickActions: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 10,
        gap: 6,
    },
    rejectBtn: {
        backgroundColor: '#fee2e2',
    },
    rejectBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#dc2626',
    },
    approveBtn: {
        backgroundColor: '#dcfce7',
    },
    approveBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#16a34a',
    },
    fab: {
        position: 'absolute',
        bottom: 24,
        right: 20,
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        ...shadows.lg,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '80%',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1e293b',
        marginBottom: 16,
    },
    modalOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    modalOptionActive: {
        backgroundColor: '#f8fafc',
        marginHorizontal: -20,
        paddingHorizontal: 20,
    },
    modalOptionText: {
        fontSize: 16,
        color: '#1e293b',
    },
});

export default ExpenseListScreen;
