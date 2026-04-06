import React, { useState, useEffect, useCallback } from 'react';
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Alert,
    Modal,
    Dimensions,
    StatusBar,
    ActivityIndicator,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useToast } from 'native-base';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import api from '../../../constants/api';

const { width, height } = Dimensions.get('window');

const RETURN_REASONS = [
    { value: 'defective', label: 'Defective' },
    { value: 'wrong_item', label: 'Wrong Item' },
    { value: 'customer_changed_mind', label: 'Changed Mind' },
    { value: 'expired', label: 'Expired' },
    { value: 'damaged', label: 'Damaged' },
    { value: 'other', label: 'Other' },
];

const ReturnsScreen = ({ navigation, employeeData, businessData }) => {
    const toast = useToast();
    const insets = useSafeAreaInsets();
    const [permission, requestPermission] = useCameraPermissions();

    // Return items
    const [returnItems, setReturnItems] = useState([]);
    const [showScanner, setShowScanner] = useState(false);
    const [scanned, setScanned] = useState(false);

    // Bill lookup
    const [billNumber, setBillNumber] = useState('');
    const [linkedBill, setLinkedBill] = useState(null);
    const [loadingBill, setLoadingBill] = useState(false);

    // Refund method
    const [refundMethod, setRefundMethod] = useState('cash');
    const [customerName, setCustomerName] = useState('');
    const [notes, setNotes] = useState('');

    // Processing
    const [processing, setProcessing] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [returnResult, setReturnResult] = useState(null);

    // Today's returns summary
    const [todaySummary, setTodaySummary] = useState({ totalReturns: 0, totalRefunded: 0 });

    useEffect(() => {
        loadTodaySummary();
    }, []);

    useFocusEffect(
        useCallback(() => {
            StatusBar.setBarStyle('dark-content');
            loadTodaySummary();
        }, [])
    );

    const loadTodaySummary = async () => {
        try {
            const response = await api.get('/return/today-summary');
            setTodaySummary(response.data);
        } catch (error) {
            console.error('Error loading summary:', error);
        }
    };

    const showToast = (message, type = 'info') => {
        toast.closeAll();
        toast.show({
            description: message,
            placement: "top",
            duration: 2500,
            style: {
                backgroundColor: type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6',
                borderRadius: 8,
            }
        });
    };

    // Lookup bill by number
    const lookupBill = async () => {
        if (!billNumber.trim()) {
            showToast('Enter a bill number', 'error');
            return;
        }

        setLoadingBill(true);
        try {
            const response = await api.get(`/return/receipt/${billNumber.trim()}`);
            setLinkedBill(response.data);
            showToast('Bill found', 'success');
        } catch (error) {
            // Check if it's a refund receipt
            if (error.response?.data?.isRefundReceipt) {
                showToast('Cannot return items from a refund receipt', 'error');
            } else {
                showToast(error.response?.data?.message || 'Bill not found', 'error');
            }
            setLinkedBill(null);
        } finally {
            setLoadingBill(false);
        }
    };

    // Add item from linked bill
    const addItemFromBill = (item) => {
        const remainingQty = item.remainingQty || item.qty;
        if (remainingQty <= 0) {
            showToast('All items already returned', 'error');
            return;
        }

        const existingIndex = returnItems.findIndex(ri => ri.name === item.name);
        if (existingIndex >= 0) {
            // Update quantity
            const existing = returnItems[existingIndex];
            if (existing.quantity >= remainingQty) {
                showToast(`Max ${remainingQty} can be returned`, 'error');
                return;
            }
            const updated = [...returnItems];
            updated[existingIndex] = { ...existing, quantity: existing.quantity + 1 };
            setReturnItems(updated);
        } else {
            // Add new item
            setReturnItems([...returnItems, {
                id: Date.now().toString(),
                name: item.name,
                productName: item.name,
                price: item.qty ? item.price / item.qty : item.price, // Unit price
                quantity: 1,
                maxQty: remainingQty,
                reason: 'customer_changed_mind',
                fromBill: true
            }]);
        }
        showToast(`${item.name} added to return`, 'success');
    };

    // Barcode scan handler
    const handleBarCodeScanned = async ({ type, data }) => {
        setScanned(true);
        setShowScanner(false);

        try {
            // Try to find product by barcode
            const response = await api.get(`/product/barcode/${data}`);
            const product = response.data;

            if (product) {
                const existingIndex = returnItems.findIndex(ri => ri.barcode === data);
                if (existingIndex >= 0) {
                    // Increment quantity
                    const updated = [...returnItems];
                    updated[existingIndex] = {
                        ...updated[existingIndex],
                        quantity: updated[existingIndex].quantity + 1
                    };
                    setReturnItems(updated);
                } else {
                    // Add new item
                    setReturnItems([...returnItems, {
                        id: Date.now().toString(),
                        product: product._id,
                        productName: product.name,
                        name: product.name,
                        barcode: data,
                        price: product.sellingPrice || product.price,
                        quantity: 1,
                        reason: 'customer_changed_mind',
                        fromBill: false
                    }]);
                }
                showToast(`${product.name} added`, 'success');
            }
        } catch (error) {
            showToast('Product not found', 'error');
        }

        setTimeout(() => setScanned(false), 1500);
    };

    // Update item quantity
    const updateQuantity = (itemId, delta) => {
        setReturnItems(prev => prev.map(item => {
            if (item.id === itemId) {
                const newQty = item.quantity + delta;
                if (newQty <= 0) return null;
                if (item.maxQty && newQty > item.maxQty) {
                    showToast(`Max ${item.maxQty} can be returned`, 'error');
                    return item;
                }
                return { ...item, quantity: newQty };
            }
            return item;
        }).filter(Boolean));
    };

    // Update item reason
    const updateReason = (itemId, reason) => {
        setReturnItems(prev => prev.map(item =>
            item.id === itemId ? { ...item, reason } : item
        ));
    };

    // Remove item
    const removeItem = (itemId) => {
        setReturnItems(prev => prev.filter(item => item.id !== itemId));
    };

    // Calculate total
    const totalRefund = returnItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalItems = returnItems.reduce((sum, item) => sum + item.quantity, 0);

    // Process return
    const processReturn = async () => {
        if (returnItems.length === 0) {
            showToast('Add items to return', 'error');
            return;
        }

        setProcessing(true);
        try {
            const payload = {
                items: returnItems.map(item => ({
                    product: item.product,
                    productName: item.productName || item.name,
                    barcode: item.barcode,
                    quantity: item.quantity,
                    price: item.price,
                    reason: item.reason
                })),
                originalBillNumber: linkedBill?.billNumber?.toString() || billNumber || null,
                refundMethod,
                customerName: customerName || linkedBill?.customerName,
                processedBy: employeeData?.name || 'Staff',
                notes
            };

            const response = await api.post('/return', payload);
            setReturnResult(response.data);
            setShowSuccess(true);
            loadTodaySummary();
        } catch (error) {
            console.error('Error processing return:', error);
            showToast(error.response?.data?.message || 'Failed to process return', 'error');
        } finally {
            setProcessing(false);
        }
    };

    // Reset form
    const resetForm = () => {
        setReturnItems([]);
        setBillNumber('');
        setLinkedBill(null);
        setCustomerName('');
        setNotes('');
        setRefundMethod('cash');
        setShowSuccess(false);
        setReturnResult(null);
    };

    const ReturnItemCard = ({ item }) => (
        <View style={styles.returnItem}>
            <View style={styles.returnItemMain}>
                <View style={styles.returnItemIcon}>
                    <MaterialIcons name="inventory-2" size={20} color="#8b5cf6" />
                </View>
                <View style={styles.returnItemInfo}>
                    <Text style={styles.returnItemName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.returnItemPrice}>Rs. {item.price.toLocaleString()} each</Text>
                    {item.fromBill && (
                        <Text style={styles.fromBillTag}>From Bill</Text>
                    )}
                </View>
                <View style={styles.qtyControls}>
                    <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(item.id, -1)}>
                        <MaterialIcons name="remove" size={18} color="#ef4444" />
                    </TouchableOpacity>
                    <Text style={styles.qtyText}>{item.quantity}</Text>
                    <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(item.id, 1)}>
                        <MaterialIcons name="add" size={18} color="#10b981" />
                    </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => removeItem(item.id)} style={styles.removeBtn}>
                    <MaterialIcons name="close" size={20} color="#ef4444" />
                </TouchableOpacity>
            </View>
            <View style={styles.reasonRow}>
                <Text style={styles.reasonLabel}>Reason:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {RETURN_REASONS.map(reason => (
                        <TouchableOpacity
                            key={reason.value}
                            style={[styles.reasonChip, item.reason === reason.value && styles.reasonChipActive]}
                            onPress={() => updateReason(item.id, reason.value)}
                        >
                            <Text style={[styles.reasonChipText, item.reason === reason.value && styles.reasonChipTextActive]}>
                                {reason.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
        </View>
    );

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <StatusBar barStyle="dark-content" backgroundColor="#fff" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color="#1e293b" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Process Return</Text>
                <View style={styles.headerRight}>
                    <View style={styles.statBadge}>
                        <Text style={styles.statBadgeText}>
                            Today: {todaySummary.totalReturns} returns
                        </Text>
                    </View>
                </View>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Bill Lookup Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Link to Original Bill (Optional)</Text>
                    <View style={styles.billLookupRow}>
                        <View style={styles.billInput}>
                            <MaterialIcons name="receipt" size={20} color="#94a3b8" />
                            <TextInput
                                style={styles.billInputField}
                                placeholder="Enter bill number..."
                                placeholderTextColor="#94a3b8"
                                value={billNumber}
                                onChangeText={setBillNumber}
                                keyboardType="numeric"
                            />
                        </View>
                        <TouchableOpacity
                            style={[styles.lookupBtn, loadingBill && styles.lookupBtnDisabled]}
                            onPress={lookupBill}
                            disabled={loadingBill}
                        >
                            {loadingBill ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Text style={styles.lookupBtnText}>Lookup</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Linked Bill Items */}
                    {linkedBill && (
                        <View style={styles.linkedBillCard}>
                            <View style={styles.linkedBillHeader}>
                                <Text style={styles.linkedBillTitle}>Bill #{linkedBill.billNumber}</Text>
                                <Text style={styles.linkedBillDate}>
                                    {new Date(linkedBill.createdAt).toLocaleDateString()}
                                </Text>
                            </View>
                            <Text style={styles.linkedBillInfo}>
                                {linkedBill.customerName || 'Walk-in'} • Rs. {linkedBill.totalBill?.toLocaleString()}
                            </Text>
                            {linkedBill.hasReturns && (
                                <Text style={styles.hasReturnsTag}>Has previous returns</Text>
                            )}
                            <Text style={styles.selectItemsLabel}>Tap items to add to return:</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.billItemsScroll}>
                                {linkedBill.items?.map((item, index) => {
                                    const remaining = item.remainingQty !== undefined ? item.remainingQty : item.qty;
                                    const isFullyReturned = remaining <= 0;
                                    return (
                                        <TouchableOpacity
                                            key={index}
                                            style={[styles.billItemChip, isFullyReturned && styles.billItemChipDisabled]}
                                            onPress={() => addItemFromBill(item)}
                                            disabled={isFullyReturned}
                                        >
                                            <Text style={[styles.billItemName, isFullyReturned && styles.billItemNameDisabled]}>
                                                {item.name}
                                            </Text>
                                            <Text style={[styles.billItemQty, isFullyReturned && styles.billItemQtyDisabled]}>
                                                {isFullyReturned ? 'Returned' : `${remaining} avail`}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    )}
                </View>

                {/* Scan Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Scan Product to Return</Text>
                    <TouchableOpacity
                        style={styles.scanButton}
                        onPress={async () => {
                            if (permission?.granted) {
                                setShowScanner(true);
                            } else {
                                const result = await requestPermission();
                                if (result.granted) {
                                    setShowScanner(true);
                                } else {
                                    Alert.alert('Permission Required', 'Camera permission is needed');
                                }
                            }
                        }}
                    >
                        <MaterialCommunityIcons name="barcode-scan" size={28} color="#8b5cf6" />
                        <Text style={styles.scanButtonText}>Scan Barcode</Text>
                    </TouchableOpacity>
                </View>

                {/* Return Items */}
                {returnItems.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Return Items ({totalItems})</Text>
                        {returnItems.map(item => (
                            <ReturnItemCard key={item.id} item={item} />
                        ))}
                    </View>
                )}

                {/* Customer & Notes */}
                {returnItems.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Additional Details</Text>
                        <View style={styles.inputRow}>
                            <MaterialIcons name="person" size={20} color="#94a3b8" />
                            <TextInput
                                style={styles.inputField}
                                placeholder="Customer name (optional)"
                                placeholderTextColor="#94a3b8"
                                value={customerName}
                                onChangeText={setCustomerName}
                            />
                        </View>
                        <View style={[styles.inputRow, { height: 80, alignItems: 'flex-start', paddingTop: 12 }]}>
                            <MaterialIcons name="notes" size={20} color="#94a3b8" />
                            <TextInput
                                style={[styles.inputField, { height: 60 }]}
                                placeholder="Notes (optional)"
                                placeholderTextColor="#94a3b8"
                                value={notes}
                                onChangeText={setNotes}
                                multiline
                            />
                        </View>

                        {/* Refund Method */}
                        <Text style={styles.subLabel}>Refund Method</Text>
                        <View style={styles.refundMethods}>
                            {['cash', 'card', 'store_credit'].map(method => (
                                <TouchableOpacity
                                    key={method}
                                    style={[styles.refundMethod, refundMethod === method && styles.refundMethodActive]}
                                    onPress={() => setRefundMethod(method)}
                                >
                                    <MaterialIcons
                                        name={method === 'cash' ? 'payments' : method === 'card' ? 'credit-card' : 'card-giftcard'}
                                        size={20}
                                        color={refundMethod === method ? '#fff' : '#64748b'}
                                    />
                                    <Text style={[styles.refundMethodText, refundMethod === method && styles.refundMethodTextActive]}>
                                        {method === 'store_credit' ? 'Store Credit' : method.charAt(0).toUpperCase() + method.slice(1)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                <View style={{ height: 120 }} />
            </ScrollView>

            {/* Bottom Action */}
            {returnItems.length > 0 && (
                <View style={[styles.bottomAction, { paddingBottom: insets.bottom + 16 }]}>
                    <View style={styles.totalSection}>
                        <Text style={styles.totalLabel}>Total Refund</Text>
                        <Text style={styles.totalValue}>Rs. {totalRefund.toLocaleString()}</Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.processBtn, processing && styles.processBtnDisabled]}
                        onPress={processReturn}
                        disabled={processing}
                    >
                        {processing ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <MaterialIcons name="assignment-return" size={22} color="#fff" />
                                <Text style={styles.processBtnText}>Process Return</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            )}

            {/* Scanner Modal */}
            <Modal visible={showScanner} animationType="slide">
                <View style={styles.scannerContainer}>
                    <CameraView
                        style={StyleSheet.absoluteFillObject}
                        facing="back"
                        barcodeScannerSettings={{
                            barcodeTypes: ['qr', 'ean13', 'ean8', 'upc_a', 'upc_e', 'code39', 'code128'],
                        }}
                        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                    />
                    <View style={styles.scannerOverlay}>
                        <View style={styles.scannerFrame}>
                            <View style={[styles.scannerCorner, styles.topLeft]} />
                            <View style={[styles.scannerCorner, styles.topRight]} />
                            <View style={[styles.scannerCorner, styles.bottomLeft]} />
                            <View style={[styles.scannerCorner, styles.bottomRight]} />
                        </View>
                    </View>
                    <View style={[styles.scannerHeader, { paddingTop: insets.top + 10 }]}>
                        <TouchableOpacity style={styles.closeScannerBtn} onPress={() => setShowScanner(false)}>
                            <MaterialIcons name="close" size={28} color="#fff" />
                        </TouchableOpacity>
                        <Text style={styles.scannerTitle}>Scan Return Item</Text>
                        <View style={{ width: 44 }} />
                    </View>
                    <Text style={styles.scannerHint}>Scan product barcode to add to return</Text>
                </View>
            </Modal>

            {/* Success Modal */}
            <Modal visible={showSuccess} animationType="fade" transparent>
                <View style={styles.successOverlay}>
                    <View style={styles.successModal}>
                        <View style={styles.successIconBg}>
                            <MaterialIcons name="check-circle" size={64} color="#10b981" />
                        </View>
                        <Text style={styles.successTitle}>Return Processed!</Text>
                        <Text style={styles.successSubtitle}>
                            Return #{returnResult?.returnNumber}
                        </Text>

                        <View style={styles.successDetails}>
                            <View style={styles.successDetailRow}>
                                <Text style={styles.successDetailLabel}>Items Returned</Text>
                                <Text style={styles.successDetailValue}>{returnResult?.totalItems}</Text>
                            </View>
                            <View style={styles.successDetailRow}>
                                <Text style={styles.successDetailLabel}>Refund Amount</Text>
                                <Text style={styles.successDetailValue}>Rs. {returnResult?.refundAmount?.toLocaleString()}</Text>
                            </View>
                            <View style={styles.successDetailRow}>
                                <Text style={styles.successDetailLabel}>Method</Text>
                                <Text style={styles.successDetailValue}>{refundMethod.toUpperCase()}</Text>
                            </View>
                        </View>

                        <TouchableOpacity style={styles.doneBtn} onPress={resetForm}>
                            <Text style={styles.doneBtnText}>New Return</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.backToHomeBtn} onPress={() => { resetForm(); navigation.goBack(); }}>
                            <Text style={styles.backToHomeBtnText}>Back to Home</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

export default ReturnsScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    backBtn: {
        padding: 4,
    },
    headerTitle: {
        flex: 1,
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
        marginLeft: 12,
    },
    headerRight: {},
    statBadge: {
        backgroundColor: '#f0fdf4',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statBadgeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#16a34a',
    },
    content: {
        flex: 1,
    },
    section: {
        backgroundColor: '#fff',
        marginTop: 12,
        marginHorizontal: 16,
        borderRadius: 16,
        padding: 16,
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1e293b',
        marginBottom: 12,
    },
    billLookupRow: {
        flexDirection: 'row',
        gap: 10,
    },
    billInput: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: 10,
        paddingHorizontal: 12,
        height: 46,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    billInputField: {
        flex: 1,
        fontSize: 15,
        marginLeft: 8,
        color: '#1e293b',
    },
    lookupBtn: {
        backgroundColor: '#8b5cf6',
        paddingHorizontal: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        height: 46,
    },
    lookupBtnDisabled: {
        opacity: 0.7,
    },
    lookupBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    linkedBillCard: {
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 14,
        marginTop: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    linkedBillHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    linkedBillTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1e293b',
    },
    linkedBillDate: {
        fontSize: 12,
        color: '#64748b',
    },
    linkedBillInfo: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 4,
    },
    hasReturnsTag: {
        fontSize: 11,
        color: '#f59e0b',
        fontWeight: '600',
        marginTop: 4,
    },
    selectItemsLabel: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 12,
        marginBottom: 8,
    },
    billItemsScroll: {
        marginHorizontal: -4,
    },
    billItemChip: {
        backgroundColor: '#fff',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 10,
        marginHorizontal: 4,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    billItemChipDisabled: {
        backgroundColor: '#f1f5f9',
        borderColor: '#e2e8f0',
    },
    billItemName: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1e293b',
    },
    billItemNameDisabled: {
        color: '#94a3b8',
    },
    billItemQty: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2,
    },
    billItemQtyDisabled: {
        color: '#cbd5e1',
    },
    scanButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f5f3ff',
        borderRadius: 12,
        paddingVertical: 16,
        gap: 10,
        borderWidth: 2,
        borderColor: '#8b5cf6',
        borderStyle: 'dashed',
    },
    scanButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#8b5cf6',
    },
    returnItem: {
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
    },
    returnItemMain: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    returnItemIcon: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: '#f5f3ff',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    returnItemInfo: {
        flex: 1,
    },
    returnItemName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1e293b',
    },
    returnItemPrice: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    fromBillTag: {
        fontSize: 10,
        color: '#8b5cf6',
        fontWeight: '600',
        marginTop: 2,
    },
    qtyControls: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 8,
        marginRight: 8,
    },
    qtyBtn: {
        padding: 8,
    },
    qtyText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1e293b',
        minWidth: 24,
        textAlign: 'center',
    },
    removeBtn: {
        padding: 4,
    },
    reasonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
    },
    reasonLabel: {
        fontSize: 12,
        color: '#64748b',
        marginRight: 8,
    },
    reasonChip: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: '#fff',
        marginRight: 6,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    reasonChipActive: {
        backgroundColor: '#8b5cf6',
        borderColor: '#8b5cf6',
    },
    reasonChipText: {
        fontSize: 11,
        color: '#64748b',
    },
    reasonChipTextActive: {
        color: '#fff',
        fontWeight: '600',
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: 10,
        paddingHorizontal: 12,
        height: 46,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 10,
    },
    inputField: {
        flex: 1,
        fontSize: 14,
        marginLeft: 8,
        color: '#1e293b',
    },
    subLabel: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 8,
        marginBottom: 10,
    },
    refundMethods: {
        flexDirection: 'row',
        gap: 10,
    },
    refundMethod: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: 10,
        paddingVertical: 12,
        gap: 6,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    refundMethodActive: {
        backgroundColor: '#8b5cf6',
        borderColor: '#8b5cf6',
    },
    refundMethodText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#64748b',
    },
    refundMethodTextActive: {
        color: '#fff',
    },
    bottomAction: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
    },
    totalSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    totalLabel: {
        fontSize: 14,
        color: '#64748b',
    },
    totalValue: {
        fontSize: 20,
        fontWeight: '700',
        color: '#ef4444',
    },
    processBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ef4444',
        borderRadius: 14,
        paddingVertical: 16,
        gap: 10,
    },
    processBtnDisabled: {
        opacity: 0.7,
    },
    processBtnText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    // Scanner
    scannerContainer: {
        flex: 1,
        backgroundColor: '#000',
    },
    scannerOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scannerFrame: {
        width: 280,
        height: 280,
        position: 'relative',
    },
    scannerCorner: {
        position: 'absolute',
        width: 40,
        height: 40,
        borderColor: '#ef4444',
    },
    topLeft: {
        top: 0,
        left: 0,
        borderTopWidth: 4,
        borderLeftWidth: 4,
        borderTopLeftRadius: 12,
    },
    topRight: {
        top: 0,
        right: 0,
        borderTopWidth: 4,
        borderRightWidth: 4,
        borderTopRightRadius: 12,
    },
    bottomLeft: {
        bottom: 0,
        left: 0,
        borderBottomWidth: 4,
        borderLeftWidth: 4,
        borderBottomLeftRadius: 12,
    },
    bottomRight: {
        bottom: 0,
        right: 0,
        borderBottomWidth: 4,
        borderRightWidth: 4,
        borderBottomRightRadius: 12,
    },
    scannerHeader: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
    },
    closeScannerBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    scannerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
    },
    scannerHint: {
        position: 'absolute',
        bottom: 120,
        alignSelf: 'center',
        fontSize: 15,
        color: 'rgba(255,255,255,0.8)',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
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
        paddingHorizontal: 40,
        width: '100%',
        alignItems: 'center',
    },
    doneBtnText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    backToHomeBtn: {
        marginTop: 12,
        paddingVertical: 10,
    },
    backToHomeBtnText: {
        fontSize: 14,
        color: '#64748b',
    },
});
