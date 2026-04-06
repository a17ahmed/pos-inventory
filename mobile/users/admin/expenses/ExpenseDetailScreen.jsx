import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TouchableOpacity,
    Platform,
    StatusBar,
    Alert,
    ActivityIndicator,
    Image,
    Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../../constants/api';
import { shadows } from '../../../constants/theme';
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

const PAYMENT_LABELS = {
    cash: 'Cash',
    card: 'Card',
    bank_transfer: 'Bank Transfer',
    cheque: 'Cheque',
    other: 'Other'
};

const STATUS_CONFIG = {
    pending: { bg: '#fef3c7', text: '#d97706', icon: 'time', label: 'Pending Approval' },
    approved: { bg: '#dcfce7', text: '#16a34a', icon: 'checkmark-circle', label: 'Approved' },
    rejected: { bg: '#fee2e2', text: '#dc2626', icon: 'close-circle', label: 'Rejected' }
};

const ExpenseDetailScreen = ({ navigation, route }) => {
    const { config } = useBusiness();
    const [expense, setExpense] = useState(route.params?.expense);
    const [loading, setLoading] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [businessData, setBusinessData] = useState(null);
    const [showImageModal, setShowImageModal] = useState(false);

    useEffect(() => {
        loadBusinessData();
        fetchExpense();
    }, []);

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

    const fetchExpense = async () => {
        try {
            const response = await api.get(`/expense/${expense._id}`);
            setExpense(response.data);
        } catch (error) {
            console.log('Error fetching expense:', error);
        }
    };

    const handleApprove = () => {
        Alert.alert(
            'Approve Expense',
            `Are you sure you want to approve this expense?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Approve',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            const response = await api.post(`/expense/${expense._id}/approve`);
                            setExpense(response.data.expense);
                            Alert.alert('Success', 'Expense approved successfully');
                        } catch (error) {
                            Alert.alert('Error', error.response?.data?.error || 'Failed to approve expense');
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const handleReject = () => {
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
                        setLoading(true);
                        try {
                            const response = await api.post(`/expense/${expense._id}/reject`, { reason });
                            setExpense(response.data.expense);
                            Alert.alert('Success', 'Expense rejected');
                        } catch (error) {
                            Alert.alert('Error', error.response?.data?.error || 'Failed to reject expense');
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ],
            'plain-text'
        );
    };

    const handleDelete = () => {
        Alert.alert(
            'Delete Expense',
            'Are you sure you want to delete this expense? This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        setDeleting(true);
                        try {
                            await api.delete(`/expense/${expense._id}`);
                            Alert.alert('Success', 'Expense deleted');
                            navigation.goBack();
                        } catch (error) {
                            Alert.alert('Error', error.response?.data?.error || 'Failed to delete expense');
                            setDeleting(false);
                        }
                    }
                }
            ]
        );
    };

    const handleEdit = () => {
        navigation.navigate('AddExpense', { expense });
    };

    const formatCurrency = (amount) => {
        const currency = businessData?.currency || 'PKR';
        return `${currency} ${(amount || 0).toLocaleString()}`;
    };

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    };

    const formatDateTime = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const primaryColor = config?.colors?.primary || '#6366f1';
    const statusConfig = STATUS_CONFIG[expense?.status] || STATUS_CONFIG.pending;

    if (!expense) {
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
                    <Text style={styles.headerTitle}>Expense #{expense.expenseNumber}</Text>
                    {expense.status === 'pending' && (
                        <TouchableOpacity
                            style={styles.editBtn}
                            onPress={handleEdit}
                        >
                            <Ionicons name="pencil" size={20} color="#fff" />
                        </TouchableOpacity>
                    )}
                    {expense.status !== 'pending' && <View style={{ width: 40 }} />}
                </View>

                {/* Amount Display */}
                <View style={styles.amountSection}>
                    <Text style={styles.amountLabel}>Amount</Text>
                    <Text style={styles.amountValue}>{formatCurrency(expense.amount)}</Text>
                </View>

                {/* Status Badge */}
                <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                    <Ionicons name={statusConfig.icon} size={18} color={statusConfig.text} />
                    <Text style={[styles.statusText, { color: statusConfig.text }]}>
                        {statusConfig.label}
                    </Text>
                </View>
            </LinearGradient>

            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {/* Details Card */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Details</Text>

                    <View style={styles.detailRow}>
                        <View style={[styles.detailIcon, { backgroundColor: `${primaryColor}15` }]}>
                            <Ionicons
                                name={CATEGORY_ICONS[expense.category] || 'ellipsis-horizontal'}
                                size={18}
                                color={primaryColor}
                            />
                        </View>
                        <View style={styles.detailContent}>
                            <Text style={styles.detailLabel}>Category</Text>
                            <Text style={styles.detailValue}>
                                {CATEGORY_LABELS[expense.category] || expense.category}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.detailRow}>
                        <View style={[styles.detailIcon, { backgroundColor: `${primaryColor}15` }]}>
                            <Ionicons name="calendar" size={18} color={primaryColor} />
                        </View>
                        <View style={styles.detailContent}>
                            <Text style={styles.detailLabel}>Date</Text>
                            <Text style={styles.detailValue}>{formatDate(expense.date)}</Text>
                        </View>
                    </View>

                    <View style={styles.detailRow}>
                        <View style={[styles.detailIcon, { backgroundColor: `${primaryColor}15` }]}>
                            <Ionicons name="card" size={18} color={primaryColor} />
                        </View>
                        <View style={styles.detailContent}>
                            <Text style={styles.detailLabel}>Payment Method</Text>
                            <Text style={styles.detailValue}>
                                {PAYMENT_LABELS[expense.paymentMethod] || expense.paymentMethod}
                            </Text>
                        </View>
                    </View>

                    {expense.description && (
                        <View style={styles.detailRow}>
                            <View style={[styles.detailIcon, { backgroundColor: `${primaryColor}15` }]}>
                                <Ionicons name="document-text" size={18} color={primaryColor} />
                            </View>
                            <View style={styles.detailContent}>
                                <Text style={styles.detailLabel}>Description</Text>
                                <Text style={styles.detailValue}>{expense.description}</Text>
                            </View>
                        </View>
                    )}

                    {expense.notes && (
                        <View style={styles.detailRow}>
                            <View style={[styles.detailIcon, { backgroundColor: `${primaryColor}15` }]}>
                                <Ionicons name="create" size={18} color={primaryColor} />
                            </View>
                            <View style={styles.detailContent}>
                                <Text style={styles.detailLabel}>Notes</Text>
                                <Text style={styles.detailValue}>{expense.notes}</Text>
                            </View>
                        </View>
                    )}
                </View>

                {/* Receipt Image */}
                {expense.receiptUrl && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Receipt</Text>
                        <TouchableOpacity
                            style={styles.receiptContainer}
                            onPress={() => setShowImageModal(true)}
                        >
                            <Image
                                source={{ uri: expense.receiptUrl }}
                                style={styles.receiptImage}
                                resizeMode="cover"
                            />
                            <View style={styles.receiptOverlay}>
                                <Ionicons name="expand" size={24} color="#fff" />
                            </View>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Audit Trail */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Activity</Text>

                    <View style={styles.auditRow}>
                        <View style={styles.auditDot} />
                        <View style={styles.auditContent}>
                            <Text style={styles.auditText}>
                                Created by <Text style={styles.auditBold}>{expense.createdByName || 'Staff'}</Text>
                            </Text>
                            <Text style={styles.auditTime}>{formatDateTime(expense.createdAt)}</Text>
                        </View>
                    </View>

                    {expense.status !== 'pending' && (
                        <View style={styles.auditRow}>
                            <View style={[
                                styles.auditDot,
                                { backgroundColor: expense.status === 'approved' ? '#16a34a' : '#dc2626' }
                            ]} />
                            <View style={styles.auditContent}>
                                <Text style={styles.auditText}>
                                    {expense.status === 'approved' ? 'Approved' : 'Rejected'} by{' '}
                                    <Text style={styles.auditBold}>{expense.approvedByName || 'Admin'}</Text>
                                </Text>
                                <Text style={styles.auditTime}>{formatDateTime(expense.approvedAt)}</Text>
                            </View>
                        </View>
                    )}

                    {expense.rejectionReason && (
                        <View style={styles.rejectionBox}>
                            <Ionicons name="information-circle" size={18} color="#dc2626" />
                            <Text style={styles.rejectionText}>{expense.rejectionReason}</Text>
                        </View>
                    )}
                </View>

                {/* Action Buttons */}
                {expense.status === 'pending' && (
                    <View style={styles.actionButtons}>
                        <TouchableOpacity
                            style={[styles.actionBtn, styles.rejectBtn]}
                            onPress={handleReject}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#dc2626" />
                            ) : (
                                <>
                                    <Ionicons name="close-circle" size={22} color="#dc2626" />
                                    <Text style={styles.rejectBtnText}>Reject</Text>
                                </>
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.actionBtn, styles.approveBtn]}
                            onPress={handleApprove}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#16a34a" />
                            ) : (
                                <>
                                    <Ionicons name="checkmark-circle" size={22} color="#16a34a" />
                                    <Text style={styles.approveBtnText}>Approve</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                {/* Delete Button */}
                <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={handleDelete}
                    disabled={deleting}
                >
                    {deleting ? (
                        <ActivityIndicator color="#dc2626" />
                    ) : (
                        <>
                            <Ionicons name="trash" size={18} color="#dc2626" />
                            <Text style={styles.deleteBtnText}>Delete Expense</Text>
                        </>
                    )}
                </TouchableOpacity>

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Image Modal */}
            <Modal
                visible={showImageModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowImageModal(false)}
            >
                <View style={styles.imageModalOverlay}>
                    <TouchableOpacity
                        style={styles.imageModalClose}
                        onPress={() => setShowImageModal(false)}
                    >
                        <Ionicons name="close" size={28} color="#fff" />
                    </TouchableOpacity>
                    <Image
                        source={{ uri: expense.receiptUrl }}
                        style={styles.fullImage}
                        resizeMode="contain"
                    />
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
        paddingBottom: 24,
        paddingHorizontal: 16,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
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
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
    },
    editBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    amountSection: {
        alignItems: 'center',
        marginBottom: 16,
    },
    amountLabel: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        marginBottom: 4,
    },
    amountValue: {
        fontSize: 36,
        fontWeight: '700',
        color: '#fff',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 6,
    },
    statusText: {
        fontSize: 14,
        fontWeight: '600',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 16,
        marginBottom: 16,
        ...shadows.sm,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1e293b',
        marginBottom: 16,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    detailIcon: {
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    detailContent: {
        flex: 1,
        marginLeft: 14,
    },
    detailLabel: {
        fontSize: 13,
        color: '#94a3b8',
        marginBottom: 4,
    },
    detailValue: {
        fontSize: 15,
        color: '#1e293b',
        lineHeight: 22,
    },
    receiptContainer: {
        position: 'relative',
        borderRadius: 12,
        overflow: 'hidden',
    },
    receiptImage: {
        width: '100%',
        height: 200,
    },
    receiptOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.3)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    auditRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 14,
    },
    auditDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#94a3b8',
        marginTop: 4,
    },
    auditContent: {
        flex: 1,
        marginLeft: 12,
    },
    auditText: {
        fontSize: 14,
        color: '#64748b',
    },
    auditBold: {
        fontWeight: '600',
        color: '#1e293b',
    },
    auditTime: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 2,
    },
    rejectionBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#fee2e2',
        padding: 12,
        borderRadius: 10,
        marginTop: 8,
        gap: 10,
    },
    rejectionText: {
        flex: 1,
        fontSize: 14,
        color: '#dc2626',
        lineHeight: 20,
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        gap: 8,
    },
    rejectBtn: {
        backgroundColor: '#fee2e2',
    },
    rejectBtnText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#dc2626',
    },
    approveBtn: {
        backgroundColor: '#dcfce7',
    },
    approveBtnText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#16a34a',
    },
    deleteBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#fee2e2',
        gap: 8,
    },
    deleteBtnText: {
        fontSize: 15,
        fontWeight: '500',
        color: '#dc2626',
    },
    imageModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.9)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    imageModalClose: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 50 : 30,
        right: 20,
        zIndex: 1,
    },
    fullImage: {
        width: '100%',
        height: '80%',
    },
});

export default ExpenseDetailScreen;
