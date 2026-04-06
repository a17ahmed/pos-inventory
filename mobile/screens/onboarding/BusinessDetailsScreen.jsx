import React, { useState, useRef, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    TextInput,
    Animated,
    Dimensions,
    StatusBar,
    ScrollView,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function BusinessDetailsScreen({ navigation, route }) {
    const { businessType } = route.params || {};

    const [formData, setFormData] = useState({
        businessName: '',
        businessEmail: '',
        businessPhone: '',
        street: '',
        city: '',
        currency: 'PKR',
        taxRate: '0',
        taxLabel: 'GST'
    });

    const [errors, setErrors] = useState({});

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 600,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    const updateField = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: null }));
        }
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.businessName.trim()) {
            newErrors.businessName = 'Business name is required';
        }

        if (!formData.businessEmail.trim()) {
            newErrors.businessEmail = 'Email is required';
        } else if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(formData.businessEmail)) {
            newErrors.businessEmail = 'Please enter a valid email';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleContinue = () => {
        if (validateForm()) {
            navigation.navigate('CreateAccount', {
                businessType,
                businessDetails: {
                    ...formData,
                    address: {
                        street: formData.street,
                        city: formData.city
                    }
                }
            });
        }
    };

    return (
        <LinearGradient
            colors={['#667eea', '#764ba2']}
            style={styles.container}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
        >
            <StatusBar barStyle="light-content" />

            {/* Back Button */}
            <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.goBack()}
            >
                <MaterialIcons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>

            {/* Progress Indicator */}
            <View style={styles.progressContainer}>
                <View style={[styles.progressDot, styles.progressCompleted]} />
                <View style={[styles.progressDot, styles.progressActive]} />
                <View style={styles.progressDot} />
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    <Animated.View
                        style={[
                            styles.content,
                            {
                                opacity: fadeAnim,
                                transform: [{ translateY: slideAnim }],
                            },
                        ]}
                    >
                        <Text style={styles.title}>Business Details</Text>
                        <Text style={styles.subtitle}>
                            Tell us about your {businessType?.name?.toLowerCase() || 'business'}
                        </Text>

                        {/* Form Card */}
                        <View style={styles.formCard}>
                            {/* Business Name */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Business Name *</Text>
                                <View style={[
                                    styles.inputContainer,
                                    errors.businessName && styles.inputError
                                ]}>
                                    <MaterialIcons name="store" size={20} color="#667eea" />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Enter your business name"
                                        placeholderTextColor="#aaa"
                                        value={formData.businessName}
                                        onChangeText={(val) => updateField('businessName', val)}
                                    />
                                </View>
                                {errors.businessName && (
                                    <Text style={styles.errorText}>{errors.businessName}</Text>
                                )}
                            </View>

                            {/* Business Email */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Business Email *</Text>
                                <View style={[
                                    styles.inputContainer,
                                    errors.businessEmail && styles.inputError
                                ]}>
                                    <MaterialIcons name="email" size={20} color="#667eea" />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="business@example.com"
                                        placeholderTextColor="#aaa"
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        value={formData.businessEmail}
                                        onChangeText={(val) => updateField('businessEmail', val)}
                                    />
                                </View>
                                {errors.businessEmail && (
                                    <Text style={styles.errorText}>{errors.businessEmail}</Text>
                                )}
                            </View>

                            {/* Business Phone */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Phone Number</Text>
                                <View style={styles.inputContainer}>
                                    <MaterialIcons name="phone" size={20} color="#667eea" />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="+92-XXX-XXXXXXX"
                                        placeholderTextColor="#aaa"
                                        keyboardType="phone-pad"
                                        value={formData.businessPhone}
                                        onChangeText={(val) => updateField('businessPhone', val)}
                                    />
                                </View>
                            </View>

                            {/* Address Row */}
                            <View style={styles.rowInputs}>
                                <View style={[styles.inputGroup, { flex: 1 }]}>
                                    <Text style={styles.inputLabel}>Street</Text>
                                    <View style={styles.inputContainer}>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Street address"
                                            placeholderTextColor="#aaa"
                                            value={formData.street}
                                            onChangeText={(val) => updateField('street', val)}
                                        />
                                    </View>
                                </View>
                                <View style={{ width: 10 }} />
                                <View style={[styles.inputGroup, { flex: 1 }]}>
                                    <Text style={styles.inputLabel}>City</Text>
                                    <View style={styles.inputContainer}>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="City"
                                            placeholderTextColor="#aaa"
                                            value={formData.city}
                                            onChangeText={(val) => updateField('city', val)}
                                        />
                                    </View>
                                </View>
                            </View>

                            {/* Tax Settings Row */}
                            <View style={styles.rowInputs}>
                                <View style={[styles.inputGroup, { flex: 1 }]}>
                                    <Text style={styles.inputLabel}>Tax Rate (%)</Text>
                                    <View style={styles.inputContainer}>
                                        <MaterialIcons name="percent" size={20} color="#667eea" />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="0"
                                            placeholderTextColor="#aaa"
                                            keyboardType="numeric"
                                            value={formData.taxRate}
                                            onChangeText={(val) => updateField('taxRate', val)}
                                        />
                                    </View>
                                </View>
                                <View style={{ width: 10 }} />
                                <View style={[styles.inputGroup, { flex: 1 }]}>
                                    <Text style={styles.inputLabel}>Tax Label</Text>
                                    <View style={styles.inputContainer}>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="GST"
                                            placeholderTextColor="#aaa"
                                            value={formData.taxLabel}
                                            onChangeText={(val) => updateField('taxLabel', val)}
                                        />
                                    </View>
                                </View>
                            </View>

                            {/* Currency */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Currency</Text>
                                <View style={styles.currencyRow}>
                                    {['PKR', 'USD', 'EUR', 'GBP'].map((curr) => (
                                        <TouchableOpacity
                                            key={curr}
                                            style={[
                                                styles.currencyOption,
                                                formData.currency === curr && styles.currencySelected
                                            ]}
                                            onPress={() => updateField('currency', curr)}
                                        >
                                            <Text style={[
                                                styles.currencyText,
                                                formData.currency === curr && styles.currencyTextSelected
                                            ]}>
                                                {curr}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        </View>

                        {/* Continue Button */}
                        <TouchableOpacity
                            style={styles.continueButton}
                            onPress={handleContinue}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.continueButtonText}>Continue</Text>
                            <MaterialIcons name="arrow-forward" size={24} color="#667eea" />
                        </TouchableOpacity>
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    backButton: {
        position: 'absolute',
        top: 50,
        left: 20,
        zIndex: 10,
        padding: 10,
    },
    progressContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        paddingTop: 60,
        gap: 8,
    },
    progressDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
    },
    progressActive: {
        backgroundColor: '#fff',
        width: 30,
    },
    progressCompleted: {
        backgroundColor: '#fff',
    },
    content: {
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.8)',
        textAlign: 'center',
        marginBottom: 25,
    },
    formCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 20,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
    },
    inputGroup: {
        marginBottom: 18,
    },
    inputLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#444',
        marginBottom: 8,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
        paddingHorizontal: 15,
        borderWidth: 1,
        borderColor: '#e9ecef',
    },
    inputError: {
        borderColor: '#dc3545',
    },
    input: {
        flex: 1,
        height: 50,
        fontSize: 15,
        color: '#333',
        marginLeft: 10,
    },
    errorText: {
        color: '#dc3545',
        fontSize: 12,
        marginTop: 5,
    },
    rowInputs: {
        flexDirection: 'row',
    },
    currencyRow: {
        flexDirection: 'row',
        gap: 10,
    },
    currencyOption: {
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 12,
        backgroundColor: '#f8f9fa',
        borderWidth: 1,
        borderColor: '#e9ecef',
    },
    currencySelected: {
        backgroundColor: '#667eea',
        borderColor: '#667eea',
    },
    currencyText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
    },
    currencyTextSelected: {
        color: '#fff',
    },
    continueButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        paddingVertical: 16,
        paddingHorizontal: 40,
        borderRadius: 30,
        gap: 10,
        marginTop: 25,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 8,
    },
    continueButtonText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#667eea',
    },
});
