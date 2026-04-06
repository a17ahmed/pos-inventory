import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Platform,
    StatusBar,
    Alert,
    ActivityIndicator,
    Modal,
    Image,
    KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../../constants/api';
import { shadows } from '../../../constants/theme';
import { useBusiness } from '../../../context/BusinessContext';

const AddSupplyScreen = ({ navigation, route }) => {
    const { config } = useBusiness();
    const editSupply = route.params?.supply;
    const preselectedVendor = route.params?.vendor;
    const isEditing = !!editSupply;

    const [loading, setLoading] = useState(false);
    const [vendors, setVendors] = useState([]);
    const [businessData, setBusinessData] = useState(null);

    // Form state
    const [selectedVendor, setSelectedVendor] = useState(
        editSupply?.vendor || preselectedVendor || null
    );
    const [billNumber, setBillNumber] = useState(editSupply?.billNumber || '');
    const [billDate, setBillDate] = useState(editSupply ? new Date(editSupply.billDate) : new Date());
    const [items, setItems] = useState(
        editSupply?.items || [{ name: '', quantity: '1', unitPrice: '', total: 0 }]
    );
    const [paidAmount, setPaidAmount] = useState(editSupply?.paidAmount?.toString() || '0');
    const [receiptImage, setReceiptImage] = useState(editSupply?.receiptImage || null);
    const [notes, setNotes] = useState(editSupply?.notes || '');

    // UI state
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showVendorModal, setShowVendorModal] = useState(false);

    const primaryColor = config?.colors?.primary || '#6366f1';

    useEffect(() => {
        loadVendors();
        loadBusinessData();
    }, []);

    const loadBusinessData = async () => {
        try {
            const businessStr = await AsyncStorage.getItem('business');
            if (businessStr) setBusinessData(JSON.parse(businessStr));
        } catch (error) {
            console.log('Error loading business:', error);
        }
    };

    const loadVendors = async () => {
        try {
            const response = await api.get('/vendor');
            setVendors(response.data);
        } catch (error) {
            console.log('Error loading vendors:', error);
        }
    };

    const currency = businessData?.currency || 'PKR';

    // Item management
    const updateItem = (index, field, value) => {
        const updated = [...items];
        updated[index][field] = value;
        if (field === 'quantity' || field === 'unitPrice') {
            const qty = parseFloat(updated[index].quantity) || 0;
            const price = parseFloat(updated[index].unitPrice) || 0;
            updated[index].total = qty * price;
        }
        setItems(updated);
    };

    const addItem = () => {
        setItems([...items, { name: '', quantity: '1', unitPrice: '', total: 0 }]);
    };

    const removeItem = (index) => {
        if (items.length === 1) {
            Alert.alert('Error', 'At least one item is required');
            return;
        }
        setItems(items.filter((_, i) => i !== index));
    };

    const totalAmount = items.reduce((sum, item) => sum + (item.total || 0), 0);
    const remaining = totalAmount - (parseFloat(paidAmount) || 0);

    // Image picker
    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
        });
        if (!result.canceled) setReceiptImage(result.assets[0].uri);
    };

    const takePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Required', 'Camera permission is needed');
            return;
        }
        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true, aspect: [4, 3], quality: 0.8,
        });
        if (!result.canceled) setReceiptImage(result.assets[0].uri);
    };

    const showImageOptions = () => {
        Alert.alert('Add Receipt', 'Choose an option', [
            { text: 'Take Photo', onPress: takePhoto },
            { text: 'Choose from Library', onPress: pickImage },
            receiptImage ? { text: 'Remove', style: 'destructive', onPress: () => setReceiptImage(null) } : null,
            { text: 'Cancel', style: 'cancel' },
        ].filter(Boolean));
    };

    const handleDateChange = (event, selectedDate) => {
        setShowDatePicker(Platform.OS === 'ios');
        if (selectedDate) setBillDate(selectedDate);
    };

    const handleSubmit = async () => {
        if (!selectedVendor) {
            Alert.alert('Error', 'Please select a vendor');
            return;
        }
        if (!items.some(item => item.name.trim())) {
            Alert.alert('Error', 'Please add at least one item with a name');
            return;
        }
        if (totalAmount <= 0) {
            Alert.alert('Error', 'Total amount must be greater than 0');
            return;
        }

        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('vendor', selectedVendor._id);
            formData.append('billNumber', billNumber);
            formData.append('billDate', billDate.toISOString());
            formData.append('items', JSON.stringify(items.filter(i => i.name.trim())));
            formData.append('paidAmount', paidAmount || '0');
            formData.append('notes', notes);

            if (receiptImage && !receiptImage.startsWith('http')) {
                formData.append('receiptImage', {
                    uri: receiptImage,
                    type: 'image/jpeg',
                    name: 'receipt.jpg',
                });
            }

            if (isEditing) {
                await api.patch(`/supply/${editSupply._id}`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                Alert.alert('Success', 'Supply updated successfully');
            } else {
                await api.post('/supply', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                Alert.alert('Success', 'Supply added successfully');
            }
            navigation.goBack();
        } catch (error) {
            console.error('Error saving supply:', error);
            Alert.alert('Error', error.response?.data?.message || 'Failed to save supply');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={primaryColor} />

            <LinearGradient colors={[primaryColor, '#8b5cf6']} style={styles.header}>
                <View style={styles.headerTop}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                        <Ionicons name="close" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{isEditing ? 'Edit Supply' : 'New Supply'}</Text>
                    <View style={{ width: 40 }} />
                </View>
            </LinearGradient>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

                    {/* Vendor Picker */}
                    <Text style={styles.sectionLabel}>Vendor *</Text>
                    <TouchableOpacity style={styles.selectField} onPress={() => setShowVendorModal(true)}>
                        {selectedVendor ? (
                            <View style={styles.selectContent}>
                                <View style={[styles.selectIcon, { backgroundColor: `${primaryColor}15` }]}>
                                    <Ionicons name="business" size={18} color={primaryColor} />
                                </View>
                                <Text style={styles.selectText}>{selectedVendor.name}</Text>
                            </View>
                        ) : (
                            <Text style={styles.selectPlaceholder}>Select vendor</Text>
                        )}
                        <Ionicons name="chevron-down" size={20} color="#94a3b8" />
                    </TouchableOpacity>

                    {/* Bill Number */}
                    <Text style={styles.sectionLabel}>Bill Number</Text>
                    <TextInput
                        style={styles.textInput}
                        value={billNumber}
                        onChangeText={setBillNumber}
                        placeholder="Vendor's bill/invoice number"
                        placeholderTextColor="#94a3b8"
                    />

                    {/* Bill Date */}
                    <Text style={styles.sectionLabel}>Bill Date</Text>
                    <TouchableOpacity style={styles.selectField} onPress={() => setShowDatePicker(!showDatePicker)}>
                        <View style={styles.selectContent}>
                            <View style={[styles.selectIcon, { backgroundColor: `${primaryColor}15` }]}>
                                <Ionicons name="calendar" size={18} color={primaryColor} />
                            </View>
                            <Text style={styles.selectText}>
                                {billDate.toLocaleDateString('en', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </Text>
                        </View>
                        <Ionicons name="chevron-down" size={20} color="#94a3b8" />
                    </TouchableOpacity>

                    {showDatePicker && (
                        <View style={{ alignItems: 'center' }}>
                            <DateTimePicker
                                value={billDate}
                                mode="date"
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                onChange={handleDateChange}
                                maximumDate={new Date()}
                                style={{ width: '100%' }}
                            />
                        </View>
                    )}

                    {/* Items */}
                    <View style={styles.itemsHeader}>
                        <Text style={styles.sectionLabel}>Items *</Text>
                        <TouchableOpacity onPress={addItem} style={styles.addItemBtn}>
                            <Ionicons name="add-circle" size={24} color={primaryColor} />
                            <Text style={[styles.addItemText, { color: primaryColor }]}>Add Item</Text>
                        </TouchableOpacity>
                    </View>

                    {items.map((item, index) => (
                        <View key={index} style={styles.itemCard}>
                            <View style={styles.itemHeaderRow}>
                                <Text style={styles.itemNumber}>Item {index + 1}</Text>
                                {items.length > 1 && (
                                    <TouchableOpacity onPress={() => removeItem(index)}>
                                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                                    </TouchableOpacity>
                                )}
                            </View>
                            <TextInput
                                style={styles.itemInput}
                                value={item.name}
                                onChangeText={(v) => updateItem(index, 'name', v)}
                                placeholder="Item name"
                                placeholderTextColor="#94a3b8"
                            />
                            <View style={styles.itemRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.itemFieldLabel}>Qty</Text>
                                    <TextInput
                                        style={styles.itemInput}
                                        value={String(item.quantity)}
                                        onChangeText={(v) => updateItem(index, 'quantity', v)}
                                        keyboardType="decimal-pad"
                                        placeholder="1"
                                        placeholderTextColor="#94a3b8"
                                    />
                                </View>
                                <View style={{ flex: 1, marginLeft: 8 }}>
                                    <Text style={styles.itemFieldLabel}>Unit Price</Text>
                                    <TextInput
                                        style={styles.itemInput}
                                        value={String(item.unitPrice)}
                                        onChangeText={(v) => updateItem(index, 'unitPrice', v)}
                                        keyboardType="decimal-pad"
                                        placeholder="0"
                                        placeholderTextColor="#94a3b8"
                                    />
                                </View>
                                <View style={{ flex: 1, marginLeft: 8, justifyContent: 'flex-end' }}>
                                    <Text style={styles.itemFieldLabel}>Total</Text>
                                    <View style={[styles.itemInput, styles.itemTotalBox]}>
                                        <Text style={styles.itemTotalText}>{currency} {item.total.toLocaleString()}</Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                    ))}

                    {/* Totals Card */}
                    <View style={styles.totalsCard}>
                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>Total Amount</Text>
                            <Text style={styles.totalValue}>{currency} {totalAmount.toLocaleString()}</Text>
                        </View>
                        <View style={styles.paidRow}>
                            <Text style={styles.totalLabel}>Paid Amount</Text>
                            <TextInput
                                style={styles.paidInput}
                                value={paidAmount}
                                onChangeText={setPaidAmount}
                                keyboardType="decimal-pad"
                                placeholder="0"
                                placeholderTextColor="#94a3b8"
                            />
                        </View>
                        <View style={[styles.totalRow, { borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 12 }]}>
                            <Text style={[styles.totalLabel, { fontWeight: '700' }]}>Remaining</Text>
                            <Text style={[styles.totalValue, { color: remaining > 0 ? '#ef4444' : '#16a34a' }]}>
                                {currency} {remaining.toLocaleString()}
                            </Text>
                        </View>
                    </View>

                    {/* Receipt Image */}
                    <Text style={styles.sectionLabel}>Receipt Image (Optional)</Text>
                    <TouchableOpacity style={styles.receiptField} onPress={showImageOptions}>
                        {receiptImage ? (
                            <View style={styles.receiptPreview}>
                                <Image source={{ uri: receiptImage }} style={styles.receiptImage} />
                                <View style={styles.receiptOverlay}>
                                    <Ionicons name="pencil" size={20} color="#fff" />
                                    <Text style={styles.receiptOverlayText}>Change</Text>
                                </View>
                            </View>
                        ) : (
                            <View style={styles.receiptPlaceholder}>
                                <Ionicons name="camera-outline" size={32} color="#94a3b8" />
                                <Text style={styles.receiptPlaceholderText}>Add receipt / bill image</Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    {/* Notes */}
                    <Text style={styles.sectionLabel}>Notes</Text>
                    <TextInput
                        style={[styles.textInput, { minHeight: 80 }]}
                        value={notes}
                        onChangeText={setNotes}
                        placeholder="Any additional notes..."
                        placeholderTextColor="#94a3b8"
                        multiline
                        numberOfLines={4}
                    />

                    <View style={{ height: 120 }} />
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Submit Button */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.submitBtn, { backgroundColor: primaryColor }]}
                    onPress={handleSubmit}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <>
                            <Ionicons name={isEditing ? 'checkmark' : 'add'} size={22} color="#fff" />
                            <Text style={styles.submitBtnText}>{isEditing ? 'Update Supply' : 'Add Supply'}</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>

            {/* Vendor Modal */}
            <Modal visible={showVendorModal} transparent animationType="slide" onRequestClose={() => setShowVendorModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select Vendor</Text>
                            <TouchableOpacity onPress={() => setShowVendorModal(false)}>
                                <Ionicons name="close" size={24} color="#64748b" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Add New Vendor option */}
                            <TouchableOpacity
                                style={styles.modalOption}
                                onPress={() => {
                                    setShowVendorModal(false);
                                    navigation.navigate('AddVendor');
                                }}
                            >
                                <View style={[styles.modalOptionIcon, { backgroundColor: '#dcfce7' }]}>
                                    <Ionicons name="add" size={20} color="#16a34a" />
                                </View>
                                <Text style={[styles.modalOptionText, { color: '#16a34a', fontWeight: '600' }]}>
                                    Add New Vendor
                                </Text>
                            </TouchableOpacity>

                            {vendors.map((vendor) => (
                                <TouchableOpacity
                                    key={vendor._id}
                                    style={[
                                        styles.modalOption,
                                        selectedVendor?._id === vendor._id && styles.modalOptionActive
                                    ]}
                                    onPress={() => {
                                        setSelectedVendor(vendor);
                                        setShowVendorModal(false);
                                    }}
                                >
                                    <View style={[styles.modalOptionIcon, { backgroundColor: `${primaryColor}15` }]}>
                                        <Ionicons name="business" size={20} color={primaryColor} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.modalOptionText}>{vendor.name}</Text>
                                        {vendor.company ? (
                                            <Text style={{ fontSize: 12, color: '#94a3b8' }}>{vendor.company}</Text>
                                        ) : null}
                                    </View>
                                    {selectedVendor?._id === vendor._id && (
                                        <Ionicons name="checkmark" size={22} color={primaryColor} />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
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
    sectionLabel: {
        fontSize: 14, fontWeight: '600', color: '#64748b',
        marginBottom: 8, marginTop: 16,
    },
    selectField: {
        backgroundColor: '#fff', borderRadius: 12, padding: 14,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        ...shadows.sm,
    },
    selectContent: { flexDirection: 'row', alignItems: 'center' },
    selectIcon: {
        width: 36, height: 36, borderRadius: 10,
        alignItems: 'center', justifyContent: 'center', marginRight: 12,
    },
    selectText: { fontSize: 16, color: '#1e293b' },
    selectPlaceholder: { fontSize: 16, color: '#94a3b8' },
    textInput: {
        backgroundColor: '#fff', borderRadius: 12, padding: 14,
        fontSize: 16, color: '#1e293b', minHeight: 50,
        textAlignVertical: 'top', ...shadows.sm,
    },
    itemsHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        marginTop: 16, marginBottom: 8,
    },
    addItemBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    addItemText: { fontSize: 14, fontWeight: '600' },
    itemCard: {
        backgroundColor: '#fff', borderRadius: 12, padding: 14,
        marginBottom: 10, ...shadows.sm,
    },
    itemHeaderRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 8,
    },
    itemNumber: { fontSize: 13, fontWeight: '600', color: '#94a3b8' },
    itemInput: {
        backgroundColor: '#f8fafc', borderRadius: 8, padding: 10,
        fontSize: 15, color: '#1e293b', borderWidth: 1, borderColor: '#e2e8f0',
    },
    itemRow: { flexDirection: 'row', marginTop: 8 },
    itemFieldLabel: { fontSize: 12, color: '#94a3b8', marginBottom: 4 },
    itemTotalBox: {
        backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center',
    },
    itemTotalText: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
    totalsCard: {
        backgroundColor: '#fff', borderRadius: 14, padding: 16,
        marginTop: 16, ...shadows.sm,
    },
    totalRow: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 10,
    },
    totalLabel: { fontSize: 15, color: '#64748b' },
    totalValue: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
    paidRow: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 10,
    },
    paidInput: {
        backgroundColor: '#f8fafc', borderRadius: 8, paddingHorizontal: 12,
        paddingVertical: 8, fontSize: 16, fontWeight: '600', color: '#1e293b',
        borderWidth: 1, borderColor: '#e2e8f0', width: 120, textAlign: 'right',
    },
    receiptField: {
        backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', ...shadows.sm,
    },
    receiptPlaceholder: {
        alignItems: 'center', justifyContent: 'center', paddingVertical: 40,
    },
    receiptPlaceholderText: { fontSize: 14, color: '#94a3b8', marginTop: 8 },
    receiptPreview: { position: 'relative' },
    receiptImage: { width: '100%', height: 200, resizeMode: 'cover' },
    receiptOverlay: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: 'rgba(0,0,0,0.5)', flexDirection: 'row',
        alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 6,
    },
    receiptOverlayText: { fontSize: 14, fontWeight: '500', color: '#fff' },
    footer: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: '#fff', padding: 16,
        paddingBottom: Platform.OS === 'ios' ? 32 : 16,
        borderTopWidth: 1, borderTopColor: '#e2e8f0',
    },
    submitBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 16, borderRadius: 14, gap: 8,
    },
    submitBtnText: { fontSize: 17, fontWeight: '600', color: '#fff' },
    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
        maxHeight: '70%', paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    },
    modalHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        padding: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
    },
    modalTitle: { fontSize: 18, fontWeight: '600', color: '#1e293b' },
    modalOption: {
        flexDirection: 'row', alignItems: 'center', paddingVertical: 14,
        paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
    },
    modalOptionActive: { backgroundColor: '#f8fafc' },
    modalOptionIcon: {
        width: 40, height: 40, borderRadius: 10,
        alignItems: 'center', justifyContent: 'center', marginRight: 14,
    },
    modalOptionText: { flex: 1, fontSize: 16, color: '#1e293b' },
});

export default AddSupplyScreen;
