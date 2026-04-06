import React, { useState } from 'react';
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
    KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../constants/api';
import { shadows } from '../../../constants/theme';
import { useBusiness } from '../../../context/BusinessContext';

const AddVendorScreen = ({ navigation, route }) => {
    const { config } = useBusiness();
    const editVendor = route.params?.vendor;
    const isEditing = !!editVendor;

    const [loading, setLoading] = useState(false);
    const [name, setName] = useState(editVendor?.name || '');
    const [phone, setPhone] = useState(editVendor?.phone || '');
    const [company, setCompany] = useState(editVendor?.company || '');
    const [notes, setNotes] = useState(editVendor?.notes || '');

    const primaryColor = config?.colors?.primary || '#6366f1';

    const handleSubmit = async () => {
        if (!name.trim()) {
            Alert.alert('Error', 'Vendor name is required');
            return;
        }

        setLoading(true);
        try {
            const data = { name: name.trim(), phone, company, notes };

            if (isEditing) {
                await api.patch(`/vendor/${editVendor._id}`, data);
                Alert.alert('Success', 'Vendor updated successfully');
            } else {
                await api.post('/vendor', data);
                Alert.alert('Success', 'Vendor added successfully');
            }
            navigation.goBack();
        } catch (error) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to save vendor');
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
                    <Text style={styles.headerTitle}>{isEditing ? 'Edit Vendor' : 'Add Vendor'}</Text>
                    <View style={{ width: 40 }} />
                </View>
            </LinearGradient>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    <Text style={styles.sectionLabel}>Vendor Name *</Text>
                    <TextInput
                        style={styles.textInput}
                        value={name}
                        onChangeText={setName}
                        placeholder="e.g. Ali Traders"
                        placeholderTextColor="#94a3b8"
                    />

                    <Text style={styles.sectionLabel}>Phone</Text>
                    <TextInput
                        style={styles.textInput}
                        value={phone}
                        onChangeText={setPhone}
                        placeholder="Phone number"
                        placeholderTextColor="#94a3b8"
                        keyboardType="phone-pad"
                    />

                    <Text style={styles.sectionLabel}>Company</Text>
                    <TextInput
                        style={styles.textInput}
                        value={company}
                        onChangeText={setCompany}
                        placeholder="Company/Brand name"
                        placeholderTextColor="#94a3b8"
                    />

                    <Text style={styles.sectionLabel}>Notes</Text>
                    <TextInput
                        style={[styles.textInput, { minHeight: 80 }]}
                        value={notes}
                        onChangeText={setNotes}
                        placeholder="Any notes about this vendor..."
                        placeholderTextColor="#94a3b8"
                        multiline
                        numberOfLines={4}
                    />

                    <View style={{ height: 120 }} />
                </ScrollView>
            </KeyboardAvoidingView>

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
                            <Text style={styles.submitBtnText}>{isEditing ? 'Update Vendor' : 'Add Vendor'}</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
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
    textInput: {
        backgroundColor: '#fff', borderRadius: 12, padding: 14,
        fontSize: 16, color: '#1e293b', minHeight: 50,
        textAlignVertical: 'top', ...shadows.sm,
    },
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
});

export default AddVendorScreen;
