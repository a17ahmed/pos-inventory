import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Alert,
    ActivityIndicator,
    Modal,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useToast } from 'native-base';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../../constants/api';

const CheckoutScreen = ({ navigation, route }) => {
    const toast = useToast();
    const {
        cart, subtotal, tax, total,
        remainingAmount,
        amountPaid: previouslyPaid,
        customerName: initialCustomerName,
        employeeData, businessData, onComplete,
        pendingBillId,
    } = route.params || {};

    const isResumedBill = !!pendingBillId;
    const effectiveTotal = isResumedBill && remainingAmount != null ? remainingAmount : total;

    const [loading, setLoading] = useState(false);
    const idempotencyKeyRef = useRef(`${Date.now()}-${Math.random().toString(36).slice(2, 11)}`);
    const [customerName, setCustomerName] = useState(initialCustomerName || '');
    const [cashGiven, setCashGiven] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [showSuccess, setShowSuccess] = useState(false);
    const [receiptData, setReceiptData] = useState(null);

    const goBackFromCheckout = () => {
        if (isResumedBill) {
            // Pop Checkout off the Home stack so Home tab shows dashboard again
            navigation.goBack();
            // Then switch to Pending tab
            navigation.getParent()?.navigate('Pending');
        } else {
            navigation.goBack();
        }
    };

    // Customize header for all cases - hide back label
    useLayoutEffect(() => {
        navigation.setOptions({
            headerBackTitleVisible: false,
            headerLeft: () => (
                <TouchableOpacity
                    style={{ padding: 8, marginLeft: 4 }}
                    onPress={goBackFromCheckout}
                >
                    <MaterialIcons name="arrow-back-ios" size={22} color="#1e293b" />
                </TouchableOpacity>
            ),
        });
    }, [navigation, isResumedBill]);

    const change = parseFloat(cashGiven || 0) - effectiveTotal;

    const handleCompleteTransaction = async () => {
        if (paymentMethod === 'cash' && parseFloat(cashGiven || 0) < effectiveTotal) {
            toast.show({ description: 'Insufficient cash amount', status: 'warning' });
            return;
        }

        setLoading(true);

        try {
            // Prepare receipt data - use sellingPrice for retail products
            // Build stock items to deduct atomically with the receipt
            const stockItems = cart
                .filter(item => item.trackStock !== false && item._id)
                .map(item => ({
                    productId: item._id,
                    quantity: item.qty
                }));

            const receiptPayload = {
                items: cart.map(item => {
                    const itemPrice = item.sellingPrice || item.price || 0;
                    const gstPercent = item.gst || 0;
                    const gstAmount = (itemPrice * gstPercent / 100) * item.qty;
                    return {
                        productId: item._id || null,
                        name: item.name,
                        description: item.description || '',
                        category: item.category || 'General',
                        qty: item.qty,
                        price: itemPrice,
                        gst: gstAmount,
                    };
                }),
                stockItems, // Backend handles stock deduction atomically
                cashierName: employeeData?.name || 'Staff',
                customerName: customerName || 'Walk-in Customer',
                date: new Date().toLocaleDateString(),
                time: new Date().toLocaleTimeString(),
                totalBill: total,
                totalGST: tax,
                totalQty: cart.reduce((sum, item) => sum + item.qty, 0),
                cashGiven: parseFloat(cashGiven || 0),
                amountPreviouslyPaid: isResumedBill ? (previouslyPaid || 0) : 0,
                amountDue: effectiveTotal,
                pendingBillRef: pendingBillId || null,
                idempotencyKey: idempotencyKeyRef.current,
            };

            const response = await api.post('/receipt', receiptPayload);

            // Mark pending bill as resumed after successful payment
            if (isResumedBill) {
                try {
                    await api.patch(`/pending-bill/${pendingBillId}/resume`);
                } catch (err) {
                    console.warn('Failed to mark pending bill as resumed:', err);
                }
            }

            setReceiptData(response.data);
            setShowSuccess(true);

            // Call onComplete callback if provided
            if (onComplete) {
                onComplete();
            }
        } catch (error) {
            console.error('Error creating receipt:', error);

            // Handle already-paid duplicate payment
            if (error.response?.status === 409 && error.response?.data?.alreadyPaid) {
                const paidReceipt = error.response.data.receipt;

                // Remove this bill from local storage so it can't be paid again
                try {
                    const savedBills = await AsyncStorage.getItem('retailBills');
                    if (savedBills) {
                        const bills = JSON.parse(savedBills);
                        const filtered = bills.filter(b =>
                            // Remove bills matching this idempotency key or pending bill
                            b.idempotencyKey !== idempotencyKeyRef.current
                        );
                        await AsyncStorage.setItem('retailBills', JSON.stringify(filtered));
                    }
                } catch (e) {
                    // storage cleanup failed, not critical
                }

                // Also mark pending bill as resumed if applicable
                if (isResumedBill && pendingBillId) {
                    try { await api.patch(`/pending-bill/${pendingBillId}/resume`); } catch (e) { }
                }

                Alert.alert(
                    'Already Paid',
                    `Bill #${paidReceipt?.billNumber || ''} has already been paid. The bill has been cleared.`,
                    [{ text: 'OK', onPress: () => goBackFromCheckout() }]
                );

                if (onComplete) onComplete();
            } else {
                Alert.alert('Error', error.response?.data?.message || 'Failed to complete transaction');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleDone = () => {
        setShowSuccess(false);
        goBackFromCheckout();
    };

    const PaymentMethodButton = ({ method, icon, label }) => (
        <TouchableOpacity
            style={[
                styles.paymentMethod,
                paymentMethod === method && styles.paymentMethodActive
            ]}
            onPress={() => setPaymentMethod(method)}
        >
            <MaterialIcons
                name={icon}
                size={28}
                color={paymentMethod === method ? '#fff' : '#64748b'}
            />
            <Text style={[
                styles.paymentMethodText,
                paymentMethod === method && styles.paymentMethodTextActive
            ]}>{label}</Text>
        </TouchableOpacity>
    );

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {/* Resumed Bill Banner */}
                {isResumedBill && (
                    <View style={styles.resumedBanner}>
                        <MaterialIcons name="info-outline" size={20} color="#f59e0b" />
                        <View style={styles.resumedBannerInfo}>
                            <Text style={styles.resumedBannerTitle}>Resumed Pending Bill</Text>
                            <Text style={styles.resumedBannerText}>
                                Original: Rs. {total?.toLocaleString()} {'\u2022'} Paid: Rs. {(previouslyPaid || 0).toLocaleString()} {'\u2022'} Due: Rs. {effectiveTotal?.toLocaleString()}
                            </Text>
                        </View>
                    </View>
                )}

                {/* Order Summary */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Order Summary</Text>
                    {cart?.map((item, index) => {
                        const itemPrice = item.sellingPrice || item.price || 0;
                        return (
                            <View key={index} style={styles.orderItem}>
                                <View style={styles.orderItemInfo}>
                                    <Text style={styles.orderItemName}>{item.name}</Text>
                                    <Text style={styles.orderItemQty}>x{item.qty}</Text>
                                </View>
                                <Text style={styles.orderItemPrice}>Rs. {(itemPrice * item.qty).toLocaleString()}</Text>
                            </View>
                        );
                    })}
                    <View style={styles.divider} />
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Subtotal</Text>
                        <Text style={styles.summaryValue}>Rs. {subtotal?.toLocaleString()}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Tax (GST)</Text>
                        <Text style={styles.summaryValue}>Rs. {tax?.toLocaleString()}</Text>
                    </View>
                    <View style={[styles.summaryRow, styles.totalRow]}>
                        <Text style={styles.totalLabel}>{isResumedBill ? 'Amount Due' : 'Total'}</Text>
                        <Text style={styles.totalValue}>Rs. {effectiveTotal?.toLocaleString()}</Text>
                    </View>
                </View>

                {/* Customer Info */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Customer (Optional)</Text>
                    <View style={styles.inputContainer}>
                        <MaterialIcons name="person" size={20} color="#94a3b8" />
                        <TextInput
                            style={styles.input}
                            placeholder="Customer name"
                            placeholderTextColor="#94a3b8"
                            value={customerName}
                            onChangeText={setCustomerName}
                        />
                    </View>
                </View>

                {/* Payment Method */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Payment Method</Text>
                    <View style={styles.paymentMethods}>
                        <PaymentMethodButton method="cash" icon="payments" label="Cash" />
                        <PaymentMethodButton method="card" icon="credit-card" label="Card" />
                        <PaymentMethodButton method="upi" icon="smartphone" label="UPI" />
                    </View>
                </View>

                {/* Cash Details */}
                {paymentMethod === 'cash' && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Cash Payment</Text>
                        <View style={styles.inputContainer}>
                            <MaterialIcons name="payments" size={20} color="#94a3b8" />
                            <TextInput
                                style={styles.input}
                                placeholder="Amount received"
                                placeholderTextColor="#94a3b8"
                                keyboardType="numeric"
                                value={cashGiven}
                                onChangeText={setCashGiven}
                            />
                        </View>
                        {parseFloat(cashGiven || 0) >= effectiveTotal && (
                            <View style={styles.changeContainer}>
                                <Text style={styles.changeLabel}>Change to return:</Text>
                                <Text style={styles.changeValue}>Rs. {change.toLocaleString()}</Text>
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>

            {/* Checkout Button */}
            <View style={styles.footer}>
                <View style={styles.footerTotal}>
                    <Text style={styles.footerTotalLabel}>{isResumedBill ? 'Amount Due' : 'Total Amount'}</Text>
                    <Text style={styles.footerTotalValue}>Rs. {effectiveTotal?.toLocaleString()}</Text>
                </View>
                <TouchableOpacity
                    style={[styles.checkoutBtn, loading && styles.checkoutBtnDisabled]}
                    onPress={handleCompleteTransaction}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <>
                            <MaterialIcons name="check-circle" size={22} color="#fff" />
                            <Text style={styles.checkoutBtnText}>Complete Transaction</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>

            {/* Success Modal */}
            <Modal visible={showSuccess} animationType="fade" transparent>
                <View style={styles.successOverlay}>
                    <View style={styles.successModal}>
                        <View style={styles.successIconBg}>
                            <MaterialIcons name="check-circle" size={64} color="#10b981" />
                        </View>
                        <Text style={styles.successTitle}>Transaction Complete!</Text>
                        <Text style={styles.successSubtitle}>
                            Bill #{receiptData?.billNumber || ''} has been saved
                        </Text>

                        <View style={styles.successDetails}>
                            <View style={styles.successDetailRow}>
                                <Text style={styles.successDetailLabel}>{isResumedBill ? 'Amount Charged' : 'Total Amount'}</Text>
                                <Text style={styles.successDetailValue}>Rs. {effectiveTotal?.toLocaleString()}</Text>
                            </View>
                            {paymentMethod === 'cash' && change > 0 && (
                                <View style={styles.successDetailRow}>
                                    <Text style={styles.successDetailLabel}>Change Given</Text>
                                    <Text style={styles.successDetailValue}>Rs. {change.toLocaleString()}</Text>
                                </View>
                            )}
                        </View>

                        <TouchableOpacity style={styles.doneBtn} onPress={handleDone}>
                            <Text style={styles.doneBtnText}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
};

export default CheckoutScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1e293b',
        marginBottom: 16,
    },
    orderItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    orderItemInfo: {
        flex: 1,
    },
    orderItemName: {
        fontSize: 14,
        fontWeight: '500',
        color: '#1e293b',
    },
    orderItemQty: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 2,
    },
    orderItemPrice: {
        fontSize: 14,
        fontWeight: '500',
        color: '#1e293b',
    },
    divider: {
        height: 1,
        backgroundColor: '#e2e8f0',
        marginVertical: 16,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    summaryLabel: {
        fontSize: 14,
        color: '#64748b',
    },
    summaryValue: {
        fontSize: 14,
        color: '#1e293b',
    },
    totalRow: {
        paddingTop: 12,
        marginTop: 4,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1e293b',
    },
    totalValue: {
        fontSize: 20,
        fontWeight: '700',
        color: '#10b981',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        paddingHorizontal: 14,
        height: 50,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    input: {
        flex: 1,
        fontSize: 15,
        marginLeft: 10,
        color: '#1e293b',
    },
    paymentMethods: {
        flexDirection: 'row',
        gap: 12,
    },
    paymentMethod: {
        flex: 1,
        alignItems: 'center',
        padding: 16,
        borderRadius: 14,
        backgroundColor: '#f8fafc',
        borderWidth: 2,
        borderColor: '#e2e8f0',
    },
    paymentMethodActive: {
        backgroundColor: '#10b981',
        borderColor: '#10b981',
    },
    paymentMethodText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#64748b',
        marginTop: 8,
    },
    paymentMethodTextActive: {
        color: '#fff',
    },
    changeContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#dcfce7',
        padding: 14,
        borderRadius: 12,
        marginTop: 12,
    },
    changeLabel: {
        fontSize: 14,
        color: '#166534',
    },
    changeValue: {
        fontSize: 18,
        fontWeight: '700',
        color: '#16a34a',
    },
    footer: {
        backgroundColor: '#fff',
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
    },
    footerTotal: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 14,
    },
    footerTotalLabel: {
        fontSize: 14,
        color: '#64748b',
    },
    footerTotalValue: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1e293b',
    },
    checkoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#10b981',
        borderRadius: 14,
        paddingVertical: 16,
        gap: 10,
    },
    checkoutBtnDisabled: {
        opacity: 0.7,
    },
    checkoutBtnText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    // Success Modal
    successOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    successModal: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 30,
        width: '100%',
        maxWidth: 350,
        alignItems: 'center',
    },
    successIconBg: {
        marginBottom: 20,
    },
    successTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 8,
    },
    successSubtitle: {
        fontSize: 14,
        color: '#64748b',
        marginBottom: 24,
    },
    successDetails: {
        width: '100%',
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
    },
    successDetailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    successDetailLabel: {
        fontSize: 14,
        color: '#64748b',
    },
    successDetailValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1e293b',
    },
    doneBtn: {
        backgroundColor: '#10b981',
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 60,
    },
    doneBtnText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    // Resumed bill banner
    resumedBanner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#fffbeb',
        borderRadius: 12,
        padding: 14,
        marginBottom: 16,
        gap: 10,
        borderWidth: 1,
        borderColor: '#fef3c7',
    },
    resumedBannerInfo: {
        flex: 1,
    },
    resumedBannerTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#92400e',
        marginBottom: 2,
    },
    resumedBannerText: {
        fontSize: 12,
        color: '#a16207',
        lineHeight: 18,
    },
});
