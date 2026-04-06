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

const CATEGORIES = [
    { value: 'rent', label: 'Rent', icon: 'home' },
    { value: 'utilities', label: 'Utilities', icon: 'flash' },
    { value: 'supplies', label: 'Supplies', icon: 'cube' },
    { value: 'wages', label: 'Wages', icon: 'people' },
    { value: 'maintenance', label: 'Maintenance', icon: 'construct' },
    { value: 'transport', label: 'Transport', icon: 'car' },
    { value: 'marketing', label: 'Marketing', icon: 'megaphone' },
    { value: 'insurance', label: 'Insurance', icon: 'shield-checkmark' },
    { value: 'taxes', label: 'Taxes', icon: 'document-text' },
    { value: 'equipment', label: 'Equipment', icon: 'hardware-chip' },
    { value: 'bank_fees', label: 'Bank Fees', icon: 'card' },
    { value: 'other', label: 'Other', icon: 'ellipsis-horizontal' },
];

const PAYMENT_METHODS = [
    { value: 'cash', label: 'Cash', icon: 'cash' },
    { value: 'card', label: 'Card', icon: 'card' },
    { value: 'bank_transfer', label: 'Bank Transfer', icon: 'swap-horizontal' },
    { value: 'cheque', label: 'Cheque', icon: 'document' },
    { value: 'other', label: 'Other', icon: 'ellipsis-horizontal' },
];

const AddExpenseScreen = ({ navigation, route }) => {
    const { config } = useBusiness();
    const editExpense = route.params?.expense;
    const isEditing = !!editExpense;

    const [loading, setLoading] = useState(false);
    const [businessData, setBusinessData] = useState(null);

    // Form state
    const [category, setCategory] = useState(editExpense?.category || '');
    const [amount, setAmount] = useState(editExpense?.amount?.toString() || '');
    const [description, setDescription] = useState(editExpense?.description || '');
    const [date, setDate] = useState(editExpense ? new Date(editExpense.date) : new Date());
    const [paymentMethod, setPaymentMethod] = useState(editExpense?.paymentMethod || 'cash');
    const [notes, setNotes] = useState(editExpense?.notes || '');
    const [receiptImage, setReceiptImage] = useState(editExpense?.receiptUrl || null);

    // UI state
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);

    useEffect(() => {
        loadBusinessData();
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

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
        });

        if (!result.canceled) {
            setReceiptImage(result.assets[0].uri);
        }
    };

    const takePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Required', 'Camera permission is needed to take photos');
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
        });

        if (!result.canceled) {
            setReceiptImage(result.assets[0].uri);
        }
    };

    const showImageOptions = () => {
        Alert.alert(
            'Add Receipt',
            'Choose an option',
            [
                { text: 'Take Photo', onPress: takePhoto },
                { text: 'Choose from Library', onPress: pickImage },
                receiptImage ? { text: 'Remove', style: 'destructive', onPress: () => setReceiptImage(null) } : null,
                { text: 'Cancel', style: 'cancel' },
            ].filter(Boolean)
        );
    };

    const handleDateChange = (event, selectedDate) => {
        setShowDatePicker(Platform.OS === 'ios');
        if (selectedDate) {
            setDate(selectedDate);
        }
    };

    const validateForm = () => {
        if (!category) {
            Alert.alert('Validation Error', 'Please select a category');
            return false;
        }
        if (!amount || parseFloat(amount) <= 0) {
            Alert.alert('Validation Error', 'Please enter a valid amount');
            return false;
        }
        return true;
    };

    const handleSubmit = async () => {
        if (!validateForm()) return;

        setLoading(true);
        try {
            const expenseData = {
                category,
                amount: parseFloat(amount),
                description,
                date: date.toISOString(),
                paymentMethod,
                notes,
                // Note: receiptUrl would be uploaded separately in a real app
                // For now, we'll store the local URI (won't persist on server)
                receiptUrl: receiptImage,
            };

            if (isEditing) {
                await api.patch(`/expense/${editExpense._id}`, expenseData);
                Alert.alert('Success', 'Expense updated successfully');
            } else {
                await api.post('/expense', expenseData);
                Alert.alert('Success', 'Expense added successfully');
            }

            navigation.goBack();
        } catch (error) {
            console.error('Error saving expense:', error);
            Alert.alert('Error', error.response?.data?.error || 'Failed to save expense');
        } finally {
            setLoading(false);
        }
    };

    const primaryColor = config?.colors?.primary || '#6366f1';
    const currency = businessData?.currency || 'PKR';

    const selectedCategory = CATEGORIES.find(c => c.value === category);
    const selectedPayment = PAYMENT_METHODS.find(p => p.value === paymentMethod);

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
                        <Ionicons name="close" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>
                        {isEditing ? 'Edit Expense' : 'Add Expense'}
                    </Text>
                    <View style={{ width: 40 }} />
                </View>
            </LinearGradient>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView
                    style={styles.content}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Amount Input */}
                    <View style={styles.amountCard}>
                        <Text style={styles.amountLabel}>Amount</Text>
                        <View style={styles.amountInputRow}>
                            <Text style={styles.currencyText}>{currency}</Text>
                            <TextInput
                                style={styles.amountInput}
                                value={amount}
                                onChangeText={setAmount}
                                keyboardType="decimal-pad"
                                placeholder="0.00"
                                placeholderTextColor="#94a3b8"
                            />
                        </View>
                    </View>

                    {/* Category */}
                    <Text style={styles.sectionLabel}>Category *</Text>
                    <TouchableOpacity
                        style={styles.selectField}
                        onPress={() => setShowCategoryModal(true)}
                    >
                        {selectedCategory ? (
                            <View style={styles.selectContent}>
                                <View style={[styles.selectIcon, { backgroundColor: `${primaryColor}15` }]}>
                                    <Ionicons name={selectedCategory.icon} size={18} color={primaryColor} />
                                </View>
                                <Text style={styles.selectText}>{selectedCategory.label}</Text>
                            </View>
                        ) : (
                            <Text style={styles.selectPlaceholder}>Select category</Text>
                        )}
                        <Ionicons name="chevron-down" size={20} color="#94a3b8" />
                    </TouchableOpacity>

                    {/* Description */}
                    <Text style={styles.sectionLabel}>Description</Text>
                    <TextInput
                        style={styles.textInput}
                        value={description}
                        onChangeText={setDescription}
                        placeholder="What was this expense for?"
                        placeholderTextColor="#94a3b8"
                        multiline
                        numberOfLines={3}
                    />

                    {/* Date */}
                    <Text style={styles.sectionLabel}>Date</Text>
                    <TouchableOpacity
                        style={styles.selectField}
                        onPress={() => setShowDatePicker(true)}
                    >
                        <View style={styles.selectContent}>
                            <View style={[styles.selectIcon, { backgroundColor: `${primaryColor}15` }]}>
                                <Ionicons name="calendar" size={18} color={primaryColor} />
                            </View>
                            <Text style={styles.selectText}>
                                {date.toLocaleDateString('en', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </Text>
                        </View>
                        <Ionicons name="chevron-down" size={20} color="#94a3b8" />
                    </TouchableOpacity>

                    {showDatePicker && (
                        <DateTimePicker
                            value={date}
                            mode="date"
                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            onChange={handleDateChange}
                            maximumDate={new Date()}
                        />
                    )}

                    {/* Payment Method */}
                    <Text style={styles.sectionLabel}>Payment Method</Text>
                    <TouchableOpacity
                        style={styles.selectField}
                        onPress={() => setShowPaymentModal(true)}
                    >
                        <View style={styles.selectContent}>
                            <View style={[styles.selectIcon, { backgroundColor: `${primaryColor}15` }]}>
                                <Ionicons name={selectedPayment?.icon || 'card'} size={18} color={primaryColor} />
                            </View>
                            <Text style={styles.selectText}>{selectedPayment?.label || 'Cash'}</Text>
                        </View>
                        <Ionicons name="chevron-down" size={20} color="#94a3b8" />
                    </TouchableOpacity>

                    {/* Receipt Image */}
                    <Text style={styles.sectionLabel}>Receipt (Optional)</Text>
                    <TouchableOpacity
                        style={styles.receiptField}
                        onPress={showImageOptions}
                    >
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
                                <Text style={styles.receiptPlaceholderText}>Add receipt image</Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    {/* Notes */}
                    <Text style={styles.sectionLabel}>Additional Notes</Text>
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
                            <Text style={styles.submitBtnText}>
                                {isEditing ? 'Update Expense' : 'Add Expense'}
                            </Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>

            {/* Category Modal */}
            <Modal
                visible={showCategoryModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowCategoryModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select Category</Text>
                            <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                                <Ionicons name="close" size={24} color="#64748b" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {CATEGORIES.map((cat) => (
                                <TouchableOpacity
                                    key={cat.value}
                                    style={[
                                        styles.modalOption,
                                        category === cat.value && styles.modalOptionActive
                                    ]}
                                    onPress={() => {
                                        setCategory(cat.value);
                                        setShowCategoryModal(false);
                                    }}
                                >
                                    <View style={[styles.modalOptionIcon, { backgroundColor: `${primaryColor}15` }]}>
                                        <Ionicons name={cat.icon} size={20} color={primaryColor} />
                                    </View>
                                    <Text style={[
                                        styles.modalOptionText,
                                        category === cat.value && { color: primaryColor, fontWeight: '600' }
                                    ]}>
                                        {cat.label}
                                    </Text>
                                    {category === cat.value && (
                                        <Ionicons name="checkmark" size={22} color={primaryColor} />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Payment Method Modal */}
            <Modal
                visible={showPaymentModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowPaymentModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Payment Method</Text>
                            <TouchableOpacity onPress={() => setShowPaymentModal(false)}>
                                <Ionicons name="close" size={24} color="#64748b" />
                            </TouchableOpacity>
                        </View>
                        {PAYMENT_METHODS.map((pm) => (
                            <TouchableOpacity
                                key={pm.value}
                                style={[
                                    styles.modalOption,
                                    paymentMethod === pm.value && styles.modalOptionActive
                                ]}
                                onPress={() => {
                                    setPaymentMethod(pm.value);
                                    setShowPaymentModal(false);
                                }}
                            >
                                <View style={[styles.modalOptionIcon, { backgroundColor: `${primaryColor}15` }]}>
                                    <Ionicons name={pm.icon} size={20} color={primaryColor} />
                                </View>
                                <Text style={[
                                    styles.modalOptionText,
                                    paymentMethod === pm.value && { color: primaryColor, fontWeight: '600' }
                                ]}>
                                    {pm.label}
                                </Text>
                                {paymentMethod === pm.value && (
                                    <Ionicons name="checkmark" size={22} color={primaryColor} />
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
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
    header: {
        paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight + 10,
        paddingBottom: 16,
        paddingHorizontal: 16,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
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
    content: {
        flex: 1,
        padding: 16,
    },
    amountCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        ...shadows.sm,
    },
    amountLabel: {
        fontSize: 14,
        color: '#64748b',
        marginBottom: 8,
    },
    amountInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    currencyText: {
        fontSize: 24,
        fontWeight: '600',
        color: '#94a3b8',
        marginRight: 8,
    },
    amountInput: {
        flex: 1,
        fontSize: 32,
        fontWeight: '700',
        color: '#1e293b',
        padding: 0,
    },
    sectionLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748b',
        marginBottom: 8,
        marginTop: 16,
    },
    selectField: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        ...shadows.sm,
    },
    selectContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    selectIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    selectText: {
        fontSize: 16,
        color: '#1e293b',
    },
    selectPlaceholder: {
        fontSize: 16,
        color: '#94a3b8',
    },
    textInput: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 14,
        fontSize: 16,
        color: '#1e293b',
        minHeight: 50,
        textAlignVertical: 'top',
        ...shadows.sm,
    },
    receiptField: {
        backgroundColor: '#fff',
        borderRadius: 12,
        overflow: 'hidden',
        ...shadows.sm,
    },
    receiptPlaceholder: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
    },
    receiptPlaceholderText: {
        fontSize: 14,
        color: '#94a3b8',
        marginTop: 8,
    },
    receiptPreview: {
        position: 'relative',
    },
    receiptImage: {
        width: '100%',
        height: 200,
        resizeMode: 'cover',
    },
    receiptOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        gap: 6,
    },
    receiptOverlayText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#fff',
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        padding: 16,
        paddingBottom: Platform.OS === 'ios' ? 32 : 16,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
    },
    submitBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 14,
        gap: 8,
    },
    submitBtnText: {
        fontSize: 17,
        fontWeight: '600',
        color: '#fff',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '70%',
        paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1e293b',
    },
    modalOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    modalOptionActive: {
        backgroundColor: '#f8fafc',
    },
    modalOptionIcon: {
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    modalOptionText: {
        flex: 1,
        fontSize: 16,
        color: '#1e293b',
    },
});

export default AddExpenseScreen;
