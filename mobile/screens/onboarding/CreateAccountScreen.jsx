import React, { useState, useRef, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    TextInput,
    Animated,
    StatusBar,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, Entypo } from '@expo/vector-icons';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

export default function CreateAccountScreen({ navigation, route }) {
    const { businessType, businessDetails } = route.params || {};
    const API_BASE_URL = Constants.expoConfig.extra.API_BASE_URL;

    const [formData, setFormData] = useState({
        adminName: '',
        adminEmail: '',
        adminPassword: '',
        confirmPassword: ''
    });

    const [errors, setErrors] = useState({});
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);

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

        if (!formData.adminName.trim()) {
            newErrors.adminName = 'Name is required';
        }

        if (!formData.adminEmail.trim()) {
            newErrors.adminEmail = 'Email is required';
        } else if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(formData.adminEmail)) {
            newErrors.adminEmail = 'Please enter a valid email';
        }

        if (!formData.adminPassword) {
            newErrors.adminPassword = 'Password is required';
        } else if (formData.adminPassword.length < 8) {
            newErrors.adminPassword = 'Password must be at least 8 characters';
        }

        if (formData.adminPassword !== formData.confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleRegister = async () => {
        if (!validateForm()) return;

        setLoading(true);

        try {
            const response = await axios.post(`${API_BASE_URL}/business/register`, {
                // Business details
                businessName: businessDetails.businessName,
                businessTypeId: businessType?._id,
                businessEmail: businessDetails.businessEmail,
                businessPhone: businessDetails.businessPhone,
                address: businessDetails.address,
                currency: businessDetails.currency,
                taxRate: parseFloat(businessDetails.taxRate) || 0,
                taxLabel: businessDetails.taxLabel,
                // Admin details
                adminName: formData.adminName,
                adminEmail: formData.adminEmail,
                adminPassword: formData.adminPassword
            });

            if (response.status === 201) {
                // Store token and business info
                await AsyncStorage.setItem('token', response.data.token);
                await AsyncStorage.setItem('business', JSON.stringify(response.data.business));
                await AsyncStorage.setItem('admin', JSON.stringify(response.data.admin));

                Alert.alert(
                    'Success!',
                    'Your business has been registered successfully.',
                    [
                        {
                            text: 'Continue',
                            onPress: () => navigation.reset({
                                index: 0,
                                routes: [{ name: 'AdminDrawer' }],
                            })
                        }
                    ]
                );
            }
        } catch (error) {
            console.error('Registration error:', error);
            const message = error.response?.data?.message || 'Registration failed. Please try again.';
            Alert.alert('Error', message);
        } finally {
            setLoading(false);
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
                <View style={[styles.progressDot, styles.progressCompleted]} />
                <View style={[styles.progressDot, styles.progressActive]} />
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
                        <Text style={styles.title}>Create Account</Text>
                        <Text style={styles.subtitle}>
                            Set up your admin account to manage your business
                        </Text>

                        {/* Summary Card */}
                        <View style={styles.summaryCard}>
                            <View style={styles.summaryRow}>
                                <MaterialIcons name="store" size={20} color="#667eea" />
                                <Text style={styles.summaryText}>{businessDetails.businessName}</Text>
                            </View>
                            <View style={styles.summaryRow}>
                                <MaterialIcons name="business-center" size={20} color="#667eea" />
                                <Text style={styles.summaryText}>{businessType.name}</Text>
                            </View>
                        </View>

                        {/* Form Card */}
                        <View style={styles.formCard}>
                            {/* Admin Name */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Your Name *</Text>
                                <View style={[
                                    styles.inputContainer,
                                    errors.adminName && styles.inputError
                                ]}>
                                    <MaterialIcons name="person" size={20} color="#667eea" />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Enter your full name"
                                        placeholderTextColor="#aaa"
                                        value={formData.adminName}
                                        onChangeText={(val) => updateField('adminName', val)}
                                    />
                                </View>
                                {errors.adminName && (
                                    <Text style={styles.errorText}>{errors.adminName}</Text>
                                )}
                            </View>

                            {/* Admin Email */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Email Address *</Text>
                                <View style={[
                                    styles.inputContainer,
                                    errors.adminEmail && styles.inputError
                                ]}>
                                    <MaterialIcons name="email" size={20} color="#667eea" />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="your@email.com"
                                        placeholderTextColor="#aaa"
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        value={formData.adminEmail}
                                        onChangeText={(val) => updateField('adminEmail', val)}
                                    />
                                </View>
                                {errors.adminEmail && (
                                    <Text style={styles.errorText}>{errors.adminEmail}</Text>
                                )}
                            </View>

                            {/* Password */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Password *</Text>
                                <View style={[
                                    styles.inputContainer,
                                    errors.adminPassword && styles.inputError
                                ]}>
                                    <MaterialIcons name="lock" size={20} color="#667eea" />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Min. 8 characters"
                                        placeholderTextColor="#aaa"
                                        secureTextEntry={!showPassword}
                                        value={formData.adminPassword}
                                        onChangeText={(val) => updateField('adminPassword', val)}
                                    />
                                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                        <Entypo
                                            name={showPassword ? "eye" : "eye-with-line"}
                                            size={20}
                                            color="#667eea"
                                        />
                                    </TouchableOpacity>
                                </View>
                                {errors.adminPassword && (
                                    <Text style={styles.errorText}>{errors.adminPassword}</Text>
                                )}
                            </View>

                            {/* Confirm Password */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Confirm Password *</Text>
                                <View style={[
                                    styles.inputContainer,
                                    errors.confirmPassword && styles.inputError
                                ]}>
                                    <MaterialIcons name="lock-outline" size={20} color="#667eea" />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Re-enter password"
                                        placeholderTextColor="#aaa"
                                        secureTextEntry={!showConfirmPassword}
                                        value={formData.confirmPassword}
                                        onChangeText={(val) => updateField('confirmPassword', val)}
                                    />
                                    <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                                        <Entypo
                                            name={showConfirmPassword ? "eye" : "eye-with-line"}
                                            size={20}
                                            color="#667eea"
                                        />
                                    </TouchableOpacity>
                                </View>
                                {errors.confirmPassword && (
                                    <Text style={styles.errorText}>{errors.confirmPassword}</Text>
                                )}
                            </View>
                        </View>

                        {/* Register Button */}
                        <TouchableOpacity
                            style={[styles.registerButton, loading && styles.registerButtonDisabled]}
                            onPress={handleRegister}
                            disabled={loading}
                            activeOpacity={0.8}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color="#667eea" />
                            ) : (
                                <>
                                    <Text style={styles.registerButtonText}>Create Business</Text>
                                    <MaterialIcons name="check-circle" size={24} color="#667eea" />
                                </>
                            )}
                        </TouchableOpacity>

                        {/* Terms */}
                        <Text style={styles.termsText}>
                            By creating an account, you agree to our Terms of Service and Privacy Policy
                        </Text>
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
        marginBottom: 20,
    },
    summaryCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 15,
        padding: 15,
        marginBottom: 20,
        gap: 10,
    },
    summaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    summaryText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '500',
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
    registerButton: {
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
    registerButtonDisabled: {
        opacity: 0.7,
    },
    registerButtonText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#667eea',
    },
    termsText: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 12,
        textAlign: 'center',
        marginTop: 20,
        paddingHorizontal: 20,
    },
});
