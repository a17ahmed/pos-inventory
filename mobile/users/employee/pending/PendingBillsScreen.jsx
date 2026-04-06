import React, { useState, useCallback } from 'react';
import {
    StyleSheet,
    Text,
    View,
    FlatList,
    SectionList,
    TouchableOpacity,
    Alert,
    StatusBar,
    ActivityIndicator,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useToast } from 'native-base';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../../constants/api';

const PendingBillsScreen = ({ navigation, employeeData, businessData }) => {
    const toast = useToast();
    const insets = useSafeAreaInsets();

    const [pendingBills, setPendingBills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sortBy, setSortBy] = useState('date');

    useFocusEffect(
        useCallback(() => {
            StatusBar.setBarStyle('dark-content');
            loadPendingBills();
        }, [sortBy])
    );

    const loadPendingBills = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/pending-bill?sortBy=${sortBy}`);
            setPendingBills(response.data || []);
        } catch (error) {
            console.error('Error loading pending bills:', error);
            showToast('Failed to load pending bills', 'error');
        } finally {
            setLoading(false);
        }
    };

    const showToast = (message, type = 'info') => {
        toast.closeAll();
        toast.show({
            description: message,
            placement: "top",
            duration: 2000,
            style: {
                backgroundColor: type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6',
                borderRadius: 8,
            }
        });
    };

    const getTimeAgo = (dateString) => {
        const diff = Date.now() - new Date(dateString).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        return `${Math.floor(hrs / 24)}d ago`;
    };

    const resumeBill = (pendingBill) => {
        const remaining = pendingBill.remainingAmount || pendingBill.total;
        const paid = pendingBill.amountPaid || 0;
        const customer = resolveCustomer(pendingBill);

        // Navigate to Checkout — bill stays "pending" until payment completes
        navigation.navigate('Home', {
            screen: 'Checkout',
            params: {
                cart: pendingBill.items,
                subtotal: pendingBill.subtotal,
                tax: pendingBill.tax,
                total: pendingBill.total,
                remainingAmount: remaining,
                amountPaid: paid,
                customerName: customer.name || '',
                employeeData,
                businessData,
                pendingBillId: pendingBill._id,
            }
        });
    };

    const cancelBill = (pendingBill) => {
        Alert.alert('Cancel Pending Bill', 'This will discard the pending bill. Continue?', [
            { text: 'No', style: 'cancel' },
            {
                text: 'Yes, Cancel',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await api.patch(`/pending-bill/${pendingBill._id}/cancel`);
                        loadPendingBills();
                        showToast('Pending bill cancelled', 'success');
                    } catch (error) {
                        console.error('Error cancelling bill:', error);
                        showToast('Failed to cancel bill', 'error');
                    }
                }
            }
        ]);
    };

    // Group bills by customer for customer sort view
    const getCustomerSections = () => {
        const groups = {};
        pendingBills.forEach(bill => {
            const key = bill.customerName || 'Walk-in Customer';
            if (!groups[key]) {
                groups[key] = { name: key, bills: [], totalPending: 0 };
            }
            groups[key].bills.push(bill);
            groups[key].totalPending += (bill.remainingAmount || bill.total || 0);
        });
        return Object.values(groups)
            .sort((a, b) => b.totalPending - a.totalPending)
            .map(group => ({
                title: group.name,
                totalPending: group.totalPending,
                count: group.bills.length,
                data: group.bills,
            }));
    };

    // Resolve customer name/phone (handles swapped legacy data)
    const resolveCustomer = (pb) => {
        // Prefer populated customer ref
        if (pb.customer?.name) {
            return { name: pb.customer.name, phone: pb.customer.phone || pb.customerPhone || '' };
        }
        const rawName = pb.customerName || '';
        const rawPhone = pb.customerPhone || '';
        // Detect if name/phone are swapped (name looks like digits, phone looks like text)
        const nameIsDigits = /^\d{4,}$/.test(rawName.trim());
        const phoneIsText = rawPhone.trim().length > 0 && !/^\d+$/.test(rawPhone.trim());
        if (nameIsDigits && phoneIsText) {
            return { name: rawPhone, phone: rawName };
        }
        return { name: rawName || 'Walk-in Customer', phone: rawPhone };
    };

    const renderBillCard = (pb) => {
        const itemCount = pb.items.reduce((sum, item) => sum + item.qty, 0);
        const hasPaidAmount = (pb.amountPaid || 0) > 0;
        const customer = resolveCustomer(pb);
        return (
            <View style={styles.card}>
                {/* Top row: customer + time */}
                <View style={styles.cardTop}>
                    <View style={styles.cardCustomerRow}>
                        <View style={styles.cardAvatar}>
                            <MaterialIcons name="person" size={20} color="#8b5cf6" />
                        </View>
                        <View style={styles.cardCustomerInfo}>
                            <Text style={styles.cardCustomerName} numberOfLines={1}>
                                {customer.name}
                            </Text>
                            {customer.phone ? (
                                <Text style={styles.cardPhone}>{customer.phone}</Text>
                            ) : null}
                        </View>
                    </View>
                    <View style={styles.cardTimeBadge}>
                        <MaterialIcons name="access-time" size={12} color="#f59e0b" />
                        <Text style={styles.cardTimeText}>{getTimeAgo(pb.createdAt)}</Text>
                    </View>
                </View>

                {/* Items preview */}
                <View style={styles.cardItemsPreview}>
                    {pb.items.slice(0, 3).map((item, idx) => (
                        <Text key={idx} style={styles.cardItemText} numberOfLines={1}>
                            {item.qty}x {item.name}
                        </Text>
                    ))}
                    {pb.items.length > 3 && (
                        <Text style={styles.cardMoreItems}>+{pb.items.length - 3} more items</Text>
                    )}
                </View>

                {/* Summary row */}
                <View style={styles.cardSummary}>
                    <View style={styles.cardSummaryLeft}>
                        <Text style={styles.cardSummaryText}>
                            {itemCount} items
                        </Text>
                        <Text style={styles.cardSummaryDot}>{'\u2022'}</Text>
                        <Text style={styles.cardEmployeeText}>by {pb.employeeName}</Text>
                    </View>
                    <Text style={styles.cardTotal}>Rs. {(pb.total || 0).toLocaleString()}</Text>
                </View>

                {/* Partial payment info */}
                {hasPaidAmount && (
                    <View style={styles.partialPaymentRow}>
                        <View style={styles.partialPaymentItem}>
                            <Text style={styles.partialPaymentLabel}>Paid</Text>
                            <Text style={styles.partialPaymentPaid}>Rs. {(pb.amountPaid || 0).toLocaleString()}</Text>
                        </View>
                        <View style={styles.partialPaymentDivider} />
                        <View style={styles.partialPaymentItem}>
                            <Text style={styles.partialPaymentLabel}>Due</Text>
                            <Text style={styles.partialPaymentDue}>Rs. {(pb.remainingAmount || pb.total || 0).toLocaleString()}</Text>
                        </View>
                    </View>
                )}

                {/* Actions */}
                <View style={styles.cardActions}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => cancelBill(pb)}>
                        <MaterialIcons name="close" size={16} color="#ef4444" />
                        <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.resumeBtn} onPress={() => resumeBill(pb)}>
                        <MaterialIcons name="shopping-cart-checkout" size={18} color="#fff" />
                        <Text style={styles.resumeBtnText}>Checkout</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    const renderPendingBill = ({ item: pb }) => renderBillCard(pb);

    const renderSectionHeader = ({ section }) => (
        <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
                <MaterialIcons name="person" size={16} color="#8b5cf6" />
                <Text style={styles.sectionHeaderName}>{section.title}</Text>
                <View style={styles.sectionCountBadge}>
                    <Text style={styles.sectionCountText}>{section.count}</Text>
                </View>
            </View>
            <Text style={styles.sectionHeaderTotal}>
                Due: Rs. {section.totalPending.toLocaleString()}
            </Text>
        </View>
    );

    const sortOptions = [
        { key: 'date', label: 'Recent' },
        { key: 'amount', label: 'Amount' },
        { key: 'customer', label: 'Customer' },
    ];

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <StatusBar barStyle="dark-content" backgroundColor="#fff" />

            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Pending Bills</Text>
                    <Text style={styles.headerSubtitle}>
                        {pendingBills.length} {pendingBills.length === 1 ? 'bill' : 'bills'} on hold
                    </Text>
                </View>
                <TouchableOpacity style={styles.refreshBtn} onPress={loadPendingBills}>
                    <MaterialIcons name="refresh" size={22} color="#64748b" />
                </TouchableOpacity>
            </View>

            {/* Sort Pills */}
            {pendingBills.length > 0 && (
                <View style={styles.sortRow}>
                    {sortOptions.map(option => (
                        <TouchableOpacity
                            key={option.key}
                            style={[styles.sortPill, sortBy === option.key && styles.sortPillActive]}
                            onPress={() => setSortBy(option.key)}
                        >
                            <Text style={[styles.sortPillText, sortBy === option.key && styles.sortPillTextActive]}>
                                {option.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {/* Content */}
            {loading ? (
                <View style={styles.centerState}>
                    <ActivityIndicator size="large" color="#8b5cf6" />
                    <Text style={styles.centerStateText}>Loading...</Text>
                </View>
            ) : pendingBills.length === 0 ? (
                <View style={styles.centerState}>
                    <View style={styles.emptyIcon}>
                        <MaterialCommunityIcons name="clipboard-text-clock-outline" size={56} color="#d4d0f0" />
                    </View>
                    <Text style={styles.emptyTitle}>No pending bills</Text>
                    <Text style={styles.emptySubtitle}>Bills you put on hold will appear here</Text>
                </View>
            ) : sortBy === 'customer' ? (
                <SectionList
                    sections={getCustomerSections()}
                    keyExtractor={(item) => item._id}
                    renderItem={renderPendingBill}
                    renderSectionHeader={renderSectionHeader}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    stickySectionHeadersEnabled={false}
                />
            ) : (
                <FlatList
                    data={pendingBills}
                    keyExtractor={(item) => item._id}
                    renderItem={renderPendingBill}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </View>
    );
};

export default PendingBillsScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1e293b',
    },
    headerSubtitle: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 2,
    },
    refreshBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Sort Pills
    sortRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        gap: 8,
    },
    sortPill: {
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: '#f1f5f9',
    },
    sortPillActive: {
        backgroundColor: '#8b5cf6',
    },
    sortPillText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748b',
    },
    sortPillTextActive: {
        color: '#fff',
    },

    // Section Headers (Customer grouping)
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 4,
        marginTop: 8,
        marginBottom: 4,
    },
    sectionHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    sectionHeaderName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1e293b',
    },
    sectionCountBadge: {
        backgroundColor: '#f5f3ff',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 6,
    },
    sectionCountText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#8b5cf6',
    },
    sectionHeaderTotal: {
        fontSize: 13,
        fontWeight: '600',
        color: '#f59e0b',
    },

    list: {
        padding: 16,
        paddingBottom: 32,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#f59e0b',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
    },
    cardTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    cardCustomerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 10,
    },
    cardAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#f5f3ff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardCustomerInfo: {
        flex: 1,
    },
    cardCustomerName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1e293b',
    },
    cardPhone: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 1,
    },
    cardTimeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#fffbeb',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    cardTimeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#f59e0b',
    },
    cardItemsPreview: {
        backgroundColor: '#f8fafc',
        borderRadius: 10,
        padding: 10,
        marginBottom: 12,
        gap: 3,
    },
    cardItemText: {
        fontSize: 13,
        color: '#475569',
    },
    cardMoreItems: {
        fontSize: 12,
        color: '#94a3b8',
        fontStyle: 'italic',
    },
    cardSummary: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    cardSummaryLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    cardSummaryText: {
        fontSize: 13,
        color: '#64748b',
        fontWeight: '500',
    },
    cardSummaryDot: {
        fontSize: 13,
        color: '#cbd5e1',
    },
    cardEmployeeText: {
        fontSize: 13,
        color: '#94a3b8',
    },
    cardTotal: {
        fontSize: 17,
        fontWeight: '700',
        color: '#10b981',
    },

    // Partial payment info
    partialPaymentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fefce8',
        borderRadius: 10,
        padding: 10,
        marginBottom: 12,
    },
    partialPaymentItem: {
        flex: 1,
        alignItems: 'center',
    },
    partialPaymentDivider: {
        width: 1,
        height: 28,
        backgroundColor: '#fde68a',
    },
    partialPaymentLabel: {
        fontSize: 11,
        color: '#92400e',
        fontWeight: '500',
        marginBottom: 2,
    },
    partialPaymentPaid: {
        fontSize: 14,
        fontWeight: '700',
        color: '#10b981',
    },
    partialPaymentDue: {
        fontSize: 14,
        fontWeight: '700',
        color: '#f59e0b',
    },

    cardActions: {
        flexDirection: 'row',
        gap: 10,
    },
    cancelBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 18,
        borderRadius: 10,
        backgroundColor: '#fef2f2',
        gap: 4,
    },
    cancelBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#ef4444',
    },
    resumeBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: '#8b5cf6',
        gap: 4,
    },
    resumeBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#fff',
    },
    centerState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
    },
    centerStateText: {
        marginTop: 12,
        fontSize: 14,
        color: '#64748b',
    },
    emptyIcon: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#f5f3ff',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#94a3b8',
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#cbd5e1',
        marginTop: 4,
        textAlign: 'center',
    },
});
