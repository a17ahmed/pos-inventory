import React, { useState, useEffect, useCallback } from 'react';
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TouchableOpacity,
    Switch,
    StatusBar,
    ActivityIndicator,
    Alert,
    TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useToast } from 'native-base';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../../constants/api';

const BusinessSettings = ({ navigation, route }) => {
    const insets = useSafeAreaInsets();
    const toast = useToast();
    const { businessType = 'restaurant' } = route.params || {};

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [businessData, setBusinessData] = useState(null);
    const [settings, setSettings] = useState({
        enableTableManagement: false,
        enableKitchenDisplay: false,
        enableDeals: true,
        requireTableForDineIn: false,
        autoSendToKitchen: true,
    });

    // Tax settings
    const [taxSettings, setTaxSettings] = useState({
        cashTaxRate: '0',
        cardTaxRate: '0',
        taxLabel: 'GST',
    });

    // Theme colors
    const getThemeColors = () => {
        switch (businessType) {
            case 'service':
                return { primary: '#06b6d4', secondary: '#0891b2', light: '#ecfeff' };
            case 'retail':
                return { primary: '#8b5cf6', secondary: '#7c3aed', light: '#f3e8ff' };
            default:
                return { primary: '#f97316', secondary: '#ea580c', light: '#fff7ed' };
        }
    };

    const colors = getThemeColors();

    useFocusEffect(
        useCallback(() => {
            StatusBar.setBarStyle('dark-content');
            fetchSettings();
        }, [])
    );

    const fetchSettings = async () => {
        try {
            // First load from local storage for quick display
            const businessStr = await AsyncStorage.getItem('business');
            let business = null;

            if (businessStr) {
                business = JSON.parse(businessStr);
                setBusinessData(business);

                // Set initial state from local storage
                if (business.settings) {
                    setSettings({
                        enableTableManagement: business.settings.enableTableManagement ?? false,
                        enableKitchenDisplay: business.settings.enableKitchenDisplay ?? false,
                        enableDeals: business.settings.enableDeals ?? true,
                        requireTableForDineIn: business.settings.requireTableForDineIn ?? false,
                        autoSendToKitchen: business.settings.autoSendToKitchen ?? true,
                    });
                }

                // Set tax settings
                setTaxSettings({
                    cashTaxRate: (business.cashTaxRate ?? 0).toString(),
                    cardTaxRate: (business.cardTaxRate ?? 0).toString(),
                    taxLabel: business.taxLabel ?? 'GST',
                });
            }

            // Then fetch latest from API if we have a businessId
            if (business?._id) {
                try {
                    const response = await api.get(`/business/${business._id}`);
                    if (response.data) {
                        const freshBusiness = response.data;
                        setBusinessData(freshBusiness);

                        // Update local storage with fresh data
                        await AsyncStorage.setItem('business', JSON.stringify(freshBusiness));

                        if (freshBusiness.settings) {
                            setSettings({
                                enableTableManagement: freshBusiness.settings.enableTableManagement ?? false,
                                enableKitchenDisplay: freshBusiness.settings.enableKitchenDisplay ?? false,
                                enableDeals: freshBusiness.settings.enableDeals ?? true,
                                requireTableForDineIn: freshBusiness.settings.requireTableForDineIn ?? false,
                                autoSendToKitchen: freshBusiness.settings.autoSendToKitchen ?? true,
                            });
                        }

                        // Update tax settings from API
                        setTaxSettings({
                            cashTaxRate: (freshBusiness.cashTaxRate ?? 0).toString(),
                            cardTaxRate: (freshBusiness.cardTaxRate ?? 0).toString(),
                            taxLabel: freshBusiness.taxLabel ?? 'GST',
                        });
                    }
                } catch (apiError) {
                    console.log('Could not fetch fresh settings from API:', apiError.message);
                }
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
            toast.show({ description: 'Failed to load settings', placement: 'top' });
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = (key) => {
        setSettings(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const saveSettings = async () => {
        setSaving(true);
        try {
            // Update business settings on server (businessId comes from token)
            await api.put('/admin/business/settings', {
                settings,
                cashTaxRate: parseFloat(taxSettings.cashTaxRate) || 0,
                cardTaxRate: parseFloat(taxSettings.cardTaxRate) || 0,
                taxLabel: taxSettings.taxLabel,
            });

            // Update local storage
            const updatedBusiness = {
                ...businessData,
                settings: { ...businessData?.settings, ...settings },
                cashTaxRate: parseFloat(taxSettings.cashTaxRate) || 0,
                cardTaxRate: parseFloat(taxSettings.cardTaxRate) || 0,
                taxLabel: taxSettings.taxLabel,
            };
            await AsyncStorage.setItem('business', JSON.stringify(updatedBusiness));
            setBusinessData(updatedBusiness);

            toast.show({ description: 'Settings saved successfully', placement: 'top' });
        } catch (error) {
            console.error('Error saving settings:', error);
            toast.show({
                description: error.response?.data?.message || 'Failed to save settings',
                placement: 'top'
            });
        } finally {
            setSaving(false);
        }
    };

    const SettingToggle = ({ icon, title, description, value, onToggle, disabled = false }) => (
        <View style={[styles.settingItem, disabled && styles.settingDisabled]}>
            <View style={[styles.settingIcon, { backgroundColor: colors.light }]}>
                <Ionicons name={icon} size={22} color={colors.primary} />
            </View>
            <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>{title}</Text>
                <Text style={styles.settingDescription}>{description}</Text>
            </View>
            <Switch
                value={value}
                onValueChange={onToggle}
                disabled={disabled}
                trackColor={{ false: '#e2e8f0', true: colors.light }}
                thumbColor={value ? colors.primary : '#f4f4f5'}
                ios_backgroundColor="#e2e8f0"
            />
        </View>
    );

    const ManagementCard = ({ icon, title, description, onPress, color }) => (
        <TouchableOpacity style={styles.managementCard} onPress={onPress} activeOpacity={0.7}>
            <View style={[styles.managementIcon, { backgroundColor: color + '15' }]}>
                <Ionicons name={icon} size={24} color={color} />
            </View>
            <View style={styles.managementContent}>
                <Text style={styles.managementTitle}>{title}</Text>
                <Text style={styles.managementDescription}>{description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Loading settings...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#fff" />

            {/* Header */}
            <LinearGradient
                colors={[colors.primary, colors.secondary]}
                style={[styles.header, { paddingTop: insets.top + 10 }]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <View style={styles.headerContent}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={styles.backBtn}
                        activeOpacity={0.7}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Business Settings</Text>
                    <TouchableOpacity
                        onPress={saveSettings}
                        style={styles.saveBtn}
                        disabled={saving}
                    >
                        {saving ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text style={styles.saveBtnText}>Save</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                {/* Management Options - Restaurant Only */}
                {businessType === 'restaurant' && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Restaurant Management</Text>
                        <Text style={styles.sectionSubtitle}>
                            Configure and manage restaurant-specific features
                        </Text>

                        <View style={styles.cardsContainer}>
                            <ManagementCard
                                icon="grid-outline"
                                title="Table Management"
                                description="Design floor layout and manage tables"
                                onPress={() => navigation.navigate('TableManagement', { businessType })}
                                color="#3b82f6"
                            />

                            <ManagementCard
                                icon="pricetag-outline"
                                title="Deal Management"
                                description="Create and manage combo deals"
                                onPress={() => navigation.navigate('DealManagement', { businessType })}
                                color="#22c55e"
                            />
                        </View>
                    </View>
                )}

                {/* Feature Toggles */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Feature Settings</Text>
                    <Text style={styles.sectionSubtitle}>
                        Enable or disable optional features for your business
                    </Text>

                    <View style={styles.settingsCard}>
                        {businessType === 'restaurant' && (
                            <>
                                <SettingToggle
                                    icon="grid-outline"
                                    title="Table Management"
                                    description="Enable floor plan and table assignment for orders"
                                    value={settings.enableTableManagement}
                                    onToggle={() => handleToggle('enableTableManagement')}
                                />

                                <View style={styles.divider} />

                                <SettingToggle
                                    icon="restaurant-outline"
                                    title="Kitchen Display System"
                                    description="Show orders on kitchen screen for chefs"
                                    value={settings.enableKitchenDisplay}
                                    onToggle={() => handleToggle('enableKitchenDisplay')}
                                />

                                <View style={styles.divider} />

                                <SettingToggle
                                    icon="pricetag-outline"
                                    title="Deals & Combos"
                                    description="Enable combo deals in menu"
                                    value={settings.enableDeals}
                                    onToggle={() => handleToggle('enableDeals')}
                                />

                                <View style={styles.divider} />

                                <SettingToggle
                                    icon="locate-outline"
                                    title="Require Table for Dine-in"
                                    description="Force table selection for dine-in orders"
                                    value={settings.requireTableForDineIn}
                                    onToggle={() => handleToggle('requireTableForDineIn')}
                                    disabled={!settings.enableTableManagement}
                                />

                                <View style={styles.divider} />

                                <SettingToggle
                                    icon="send-outline"
                                    title="Auto Send to Kitchen"
                                    description="Automatically send orders to kitchen display"
                                    value={settings.autoSendToKitchen}
                                    onToggle={() => handleToggle('autoSendToKitchen')}
                                    disabled={!settings.enableKitchenDisplay}
                                />
                            </>
                        )}

                        {businessType !== 'restaurant' && (
                            <SettingToggle
                                icon="pricetag-outline"
                                title="Deals & Discounts"
                                description="Enable promotional deals for services"
                                value={settings.enableDeals}
                                onToggle={() => handleToggle('enableDeals')}
                            />
                        )}
                    </View>
                </View>

                {/* Tax Settings */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Tax Settings</Text>
                    <Text style={styles.sectionSubtitle}>
                        Configure tax rates for different payment methods
                    </Text>

                    <View style={styles.settingsCard}>
                        {/* Tax Label */}
                        <View style={styles.taxInputRow}>
                            <View style={[styles.settingIcon, { backgroundColor: colors.light }]}>
                                <Ionicons name="document-text-outline" size={22} color={colors.primary} />
                            </View>
                            <View style={styles.taxInputContent}>
                                <Text style={styles.settingTitle}>Tax Label</Text>
                                <TextInput
                                    style={styles.taxInput}
                                    value={taxSettings.taxLabel}
                                    onChangeText={(text) => setTaxSettings(prev => ({ ...prev, taxLabel: text }))}
                                    placeholder="e.g., GST, VAT, Tax"
                                />
                            </View>
                        </View>

                        <View style={styles.divider} />

                        {/* Cash Tax Rate */}
                        <View style={styles.taxInputRow}>
                            <View style={[styles.settingIcon, { backgroundColor: '#dcfce7' }]}>
                                <Ionicons name="cash-outline" size={22} color="#22c55e" />
                            </View>
                            <View style={styles.taxInputContent}>
                                <Text style={styles.settingTitle}>Cash Payment Tax</Text>
                                <Text style={styles.settingDescription}>Tax rate when customer pays by cash</Text>
                            </View>
                            <View style={styles.taxPercentInput}>
                                <TextInput
                                    style={styles.taxPercentField}
                                    value={taxSettings.cashTaxRate}
                                    onChangeText={(text) => setTaxSettings(prev => ({ ...prev, cashTaxRate: text.replace(/[^0-9.]/g, '') }))}
                                    placeholder="0"
                                    keyboardType="numeric"
                                    maxLength={5}
                                />
                                <Text style={styles.taxPercentSymbol}>%</Text>
                            </View>
                        </View>

                        <View style={styles.divider} />

                        {/* Card Tax Rate */}
                        <View style={styles.taxInputRow}>
                            <View style={[styles.settingIcon, { backgroundColor: '#dbeafe' }]}>
                                <Ionicons name="card-outline" size={22} color="#3b82f6" />
                            </View>
                            <View style={styles.taxInputContent}>
                                <Text style={styles.settingTitle}>Card Payment Tax</Text>
                                <Text style={styles.settingDescription}>Tax rate when customer pays by card</Text>
                            </View>
                            <View style={styles.taxPercentInput}>
                                <TextInput
                                    style={styles.taxPercentField}
                                    value={taxSettings.cardTaxRate}
                                    onChangeText={(text) => setTaxSettings(prev => ({ ...prev, cardTaxRate: text.replace(/[^0-9.]/g, '') }))}
                                    placeholder="0"
                                    keyboardType="numeric"
                                    maxLength={5}
                                />
                                <Text style={styles.taxPercentSymbol}>%</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Info Card */}
                <View style={styles.infoCard}>
                    <View style={[styles.infoIcon, { backgroundColor: '#dbeafe' }]}>
                        <Ionicons name="information-circle" size={24} color="#3b82f6" />
                    </View>
                    <View style={styles.infoContent}>
                        <Text style={styles.infoTitle}>About Optional Features</Text>
                        <Text style={styles.infoText}>
                            All features are optional. Disabling them won't affect your existing data.
                            You can enable or disable features at any time.
                        </Text>
                    </View>
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>
        </View>
    );
};

export default BusinessSettings;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#64748b',
    },
    header: {
        paddingBottom: 16,
        paddingHorizontal: 16,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    backBtn: {
        padding: 8,
        marginLeft: -4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
    },
    saveBtn: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 20,
    },
    saveBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1e293b',
        marginBottom: 4,
    },
    sectionSubtitle: {
        fontSize: 13,
        color: '#64748b',
        marginBottom: 16,
    },
    cardsContainer: {
        gap: 12,
    },
    managementCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    managementIcon: {
        width: 48,
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    managementContent: {
        flex: 1,
        marginLeft: 14,
    },
    managementTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1e293b',
    },
    managementDescription: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 2,
    },
    settingsCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
    },
    settingDisabled: {
        opacity: 0.5,
    },
    settingIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    settingContent: {
        flex: 1,
        marginLeft: 14,
        marginRight: 12,
    },
    settingTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1e293b',
    },
    settingDescription: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    divider: {
        height: 1,
        backgroundColor: '#f1f5f9',
        marginHorizontal: 12,
    },
    infoCard: {
        flexDirection: 'row',
        backgroundColor: '#eff6ff',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#dbeafe',
    },
    infoIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    infoContent: {
        flex: 1,
        marginLeft: 14,
    },
    infoTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1e40af',
        marginBottom: 4,
    },
    infoText: {
        fontSize: 13,
        color: '#3b82f6',
        lineHeight: 18,
    },
    // Tax Settings Styles
    taxInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
    },
    taxInputContent: {
        flex: 1,
        marginLeft: 14,
        marginRight: 12,
    },
    taxInput: {
        marginTop: 6,
        fontSize: 15,
        color: '#1e293b',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: '#f8fafc',
    },
    taxPercentInput: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    taxPercentField: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1e293b',
        minWidth: 40,
        textAlign: 'right',
    },
    taxPercentSymbol: {
        fontSize: 16,
        fontWeight: '600',
        color: '#64748b',
        marginLeft: 4,
    },
});
