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
    Modal,
    TextInput,
    Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../../constants/api';
import { shadows } from '../../../constants/theme';
import { useBusiness } from '../../../context/BusinessContext';

const STATUS_COLORS = {
    unpaid: { bg: '#fee2e2', text: '#dc2626' },
    partial: { bg: '#fef3c7', text: '#d97706' },
    paid: { bg: '#dcfce7', text: '#16a34a' },
};

const SupplyDetailScreen = ({ navigation, route }) => {
    const { config } = useBusiness();
    const { supplyId } = route.params;

    const [loading, setLoading] = useState(true);
    const [supply, setSupply] = useState(null);
    const [businessData, setBusinessData] = useState(null);
    const [showPayModal, setShowPayModal] = useState(false);
    const [payAmount, setPayAmount] = useState('');
    const [paying, setPaying] = useState(false);
    const [showFullImage, setShowFullImage] = useState(false);

    const primaryColor = config?.colors?.primary || '#6366f1';

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const businessStr = await AsyncStorage.getItem('business');
            if (businessStr) setBusinessData(JSON.parse(businessStr));
        } catch (e) {}

        try {
            const response = await api.get(`/supply/${supplyId}`);
            setSupply(response.data);
        } catch (error) {
            Alert.alert('Error', 'Failed to load supply details');
            navigation.goBack();
        } finally {
            setLoading(false);
        }
    };

    const currency = businessData?.currency || 'PKR';
    const formatCurrency = (amount) => `${currency} ${(amount || 0).toLocaleString()}`;
    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    const handlePayment = async () => {
        const amount = parseFloat(payAmount);
        if (!amount || amount <= 0) {
            Alert.alert('Error', 'Enter a valid amount');
            return;
        }
        if (amount > supply.remainingAmount) {
            Alert.alert('Error', `Amount cannot exceed remaining balance of ${formatCurrency(supply.remainingAmount)}`);
            return;
        }

        setPaying(true);
        try {
            const response = await api.patch(`/supply/${supplyId}/pay`, { amount });
            setSupply(response.data);
            setShowPayModal(false);
            setPayAmount('');
            Alert.alert('Success', 'Payment recorded successfully');
        } catch (error) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to record payment');
        } finally {
            setPaying(false);
        }
    };

    const handleDelete = () => {
        Alert.alert('Delete Supply', 'Are you sure? This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive',
                onPress: async () => {
                    try {
                        await api.delete(`/supply/${supplyId}`);
                        navigation.goBack();
                    } catch (error) {
                        Alert.alert('Error', error.response?.data?.message || 'Failed to delete');
                    }
                }
            }
        ]);
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={primaryColor} />
            </View>
        );
    }

    if (!supply) return null;

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={primaryColor} />

            <LinearGradient colors={[primaryColor, '#8b5cf6']} style={styles.header}>
                <View style={styles.headerTop}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Supply #{supply.supplyNumber}</Text>
                    <TouchableOpacity
                        style={styles.backBtn}
                        onPress={() => navigation.navigate('AddSupply', { supply })}
                    >
                        <Ionicons name="pencil" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Status & Vendor Info */}
                <View style={styles.infoCard}>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Vendor</Text>
                        <Text style={styles.infoValue}>{supply.vendorName}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Bill Number</Text>
                        <Text style={styles.infoValue}>{supply.billNumber || '-'}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Date</Text>
                        <Text style={styles.infoValue}>{formatDate(supply.billDate)}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Status</Text>
                        <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[supply.paymentStatus].bg }]}>
                            <Text style={[styles.statusText, { color: STATUS_COLORS[supply.paymentStatus].text }]}>
                                {supply.paymentStatus}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Items */}
                <Text style={styles.sectionTitle}>Items</Text>
                <View style={styles.itemsCard}>
                    {supply.items.map((item, index) => (
                        <View key={index} style={[styles.itemRow, index > 0 && styles.itemBorder]}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.itemName}>{item.name}</Text>
                                <Text style={styles.itemMeta}>
                                    {item.quantity} x {formatCurrency(item.unitPrice)}
                                </Text>
                            </View>
                            <Text style={styles.itemTotal}>{formatCurrency(item.total)}</Text>
                        </View>
                    ))}
                </View>

                {/* Payment Summary */}
                <Text style={styles.sectionTitle}>Payment Summary</Text>
                <View style={styles.summaryCard}>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Total Amount</Text>
                        <Text style={styles.summaryValue}>{formatCurrency(supply.totalAmount)}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Paid</Text>
                        <Text style={[styles.summaryValue, { color: '#16a34a' }]}>
                            {formatCurrency(supply.paidAmount)}
                        </Text>
                    </View>
                    <View style={[styles.summaryRow, styles.remainingRow]}>
                        <Text style={[styles.summaryLabel, { fontWeight: '700' }]}>Remaining</Text>
                        <Text style={[styles.summaryValue, {
                            color: supply.remainingAmount > 0 ? '#ef4444' : '#16a34a',
                            fontSize: 20,
                        }]}>
                            {formatCurrency(supply.remainingAmount)}
                        </Text>
                    </View>
                </View>

                {/* Receipt Image */}
                {supply.receiptImage && (
                    <>
                        <Text style={styles.sectionTitle}>Receipt</Text>
                        <TouchableOpacity
                            style={styles.receiptCard}
                            onPress={() => setShowFullImage(true)}
                        >
                            <Image source={{ uri: supply.receiptImage }} style={styles.receiptImage} />
                            <View style={styles.receiptTapHint}>
                                <Ionicons name="expand" size={16} color="#fff" />
                                <Text style={styles.receiptTapText}>Tap to view full</Text>
                            </View>
                        </TouchableOpacity>
                    </>
                )}

                {/* Notes */}
                {supply.notes ? (
                    <>
                        <Text style={styles.sectionTitle}>Notes</Text>
                        <View style={styles.notesCard}>
                            <Text style={styles.notesText}>{supply.notes}</Text>
                        </View>
                    </>
                ) : null}

                {/* Actions */}
                <View style={styles.actions}>
                    {supply.paymentStatus !== 'paid' && (
                        <TouchableOpacity
                            style={[styles.payBtn, { backgroundColor: primaryColor }]}
                            onPress={() => {
                                setPayAmount(supply.remainingAmount.toString());
                                setShowPayModal(true);
                            }}
                        >
                            <Ionicons name="cash" size={20} color="#fff" />
                            <Text style={styles.payBtnText}>Record Payment</Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                        <Ionicons name="trash-outline" size={20} color="#ef4444" />
                        <Text style={styles.deleteBtnText}>Delete Supply</Text>
                    </TouchableOpacity>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Payment Modal */}
            <Modal visible={showPayModal} transparent animationType="slide" onRequestClose={() => setShowPayModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Record Payment</Text>
                            <TouchableOpacity onPress={() => setShowPayModal(false)}>
                                <Ionicons name="close" size={24} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <View style={{ padding: 20 }}>
                            <Text style={styles.modalLabel}>
                                Remaining: {formatCurrency(supply.remainingAmount)}
                            </Text>
                            <View style={styles.payInputRow}>
                                <Text style={styles.payCurrency}>{currency}</Text>
                                <TextInput
                                    style={styles.payInput}
                                    value={payAmount}
                                    onChangeText={setPayAmount}
                                    keyboardType="decimal-pad"
                                    placeholder="0"
                                    placeholderTextColor="#94a3b8"
                                    autoFocus
                                />
                            </View>

                            <TouchableOpacity
                                style={[styles.payConfirmBtn, { backgroundColor: primaryColor }]}
                                onPress={handlePayment}
                                disabled={paying}
                            >
                                {paying ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.payConfirmText}>Confirm Payment</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Full Image Modal */}
            <Modal visible={showFullImage} transparent onRequestClose={() => setShowFullImage(false)}>
                <View style={styles.fullImageOverlay}>
                    <TouchableOpacity
                        style={styles.fullImageClose}
                        onPress={() => setShowFullImage(false)}
                    >
                        <Ionicons name="close" size={28} color="#fff" />
                    </TouchableOpacity>
                    {supply.receiptImage && (
                        <Image
                            source={{ uri: supply.receiptImage }}
                            style={styles.fullImage}
                            resizeMode="contain"
                        />
                    )}
                </View>
            </Modal>
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
        paddingBottom: 16, paddingHorizontal: 16,
    },
    headerTop: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    backBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
    content: { flex: 1, padding: 16 },
    sectionTitle: {
        fontSize: 16, fontWeight: '700', color: '#1e293b', marginTop: 20, marginBottom: 10,
    },
    infoCard: {
        backgroundColor: '#fff', borderRadius: 14, padding: 16, ...shadows.sm,
    },
    infoRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
    },
    infoLabel: { fontSize: 14, color: '#64748b' },
    infoValue: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
    statusText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
    itemsCard: {
        backgroundColor: '#fff', borderRadius: 14, padding: 16, ...shadows.sm,
    },
    itemRow: {
        flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    },
    itemBorder: { borderTopWidth: 1, borderTopColor: '#f1f5f9' },
    itemName: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
    itemMeta: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
    itemTotal: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
    summaryCard: {
        backgroundColor: '#fff', borderRadius: 14, padding: 16, ...shadows.sm,
    },
    summaryRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingVertical: 8,
    },
    summaryLabel: { fontSize: 15, color: '#64748b' },
    summaryValue: { fontSize: 17, fontWeight: '700', color: '#1e293b' },
    remainingRow: {
        borderTopWidth: 1, borderTopColor: '#e2e8f0', marginTop: 8, paddingTop: 12,
    },
    receiptCard: {
        backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', ...shadows.sm,
    },
    receiptImage: { width: '100%', height: 220, resizeMode: 'cover' },
    receiptTapHint: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: 'rgba(0,0,0,0.4)', flexDirection: 'row',
        alignItems: 'center', justifyContent: 'center', paddingVertical: 8, gap: 6,
    },
    receiptTapText: { fontSize: 13, color: '#fff' },
    notesCard: {
        backgroundColor: '#fff', borderRadius: 14, padding: 16, ...shadows.sm,
    },
    notesText: { fontSize: 14, color: '#64748b', lineHeight: 20 },
    actions: { marginTop: 24, gap: 12 },
    payBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 16, borderRadius: 14, gap: 8,
    },
    payBtnText: { fontSize: 17, fontWeight: '600', color: '#fff' },
    deleteBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 14, borderRadius: 14, backgroundColor: '#fee2e2', gap: 8,
    },
    deleteBtnText: { fontSize: 15, fontWeight: '600', color: '#ef4444' },
    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
        paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    },
    modalHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        padding: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
    },
    modalTitle: { fontSize: 18, fontWeight: '600', color: '#1e293b' },
    modalLabel: { fontSize: 14, color: '#64748b', marginBottom: 16 },
    payInputRow: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc',
        borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#e2e8f0',
    },
    payCurrency: { fontSize: 20, fontWeight: '600', color: '#94a3b8', marginRight: 8 },
    payInput: { flex: 1, fontSize: 28, fontWeight: '700', color: '#1e293b' },
    payConfirmBtn: {
        alignItems: 'center', justifyContent: 'center',
        paddingVertical: 16, borderRadius: 14, marginTop: 20,
    },
    payConfirmText: { fontSize: 17, fontWeight: '600', color: '#fff' },
    fullImageOverlay: {
        flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center',
    },
    fullImageClose: {
        position: 'absolute', top: Platform.OS === 'ios' ? 50 : 30, right: 20, zIndex: 10,
        width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center', justifyContent: 'center',
    },
    fullImage: { width: '100%', height: '80%' },
});

export default SupplyDetailScreen;
