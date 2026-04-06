import React, { useState, useRef, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    TextInput,
    Animated,
    StatusBar,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Alert,
    Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, Entypo } from '@expo/vector-icons';
import Constants from 'expo-constants';
import axios from 'axios';

const { width } = Dimensions.get('window');

export default function ChangePasswordScreen({ navigation, route }) {
    const API_BASE_URL = Constants.expoConfig.extra.API_BASE_URL;

    const { employeeId, oderId, currentPassword } = route.params || {};
    const empId = employeeId || oderId; // Support both for backward compatibility

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
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

    const validateForm = () => {
        const newErrors = {};

        if (!newPassword) {
            newErrors.newPassword = 'New password is required';
        } else if (newPassword.length < 4) {
            newErrors.newPassword = 'Password must be at least 4 characters';
        }

        if (!confirmPassword) {
            newErrors.confirmPassword = 'Please confirm your password';
        } else if (newPassword !== confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
        }

        if (currentPassword && newPassword === currentPassword) {
            newErrors.newPassword = 'New password must be different from current password';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleChangePassword = async () => {
        if (!validateForm()) return;

        setLoading(true);

        try {
            const response = await axios.post(`${API_BASE_URL}/employeeAuth/change-password`, {
                employeeId: empId,
                currentPassword: currentPassword,
                newPassword: newPassword
            });

            if (response.status === 200) {
                Alert.alert(
                    'Success',
                    'Password changed successfully! Please login with your new password.',
                    [
                        {
                            text: 'OK',
                            onPress: () => {
                                navigation.reset({
                                    index: 0,
                                    routes: [{ name: 'CounterUserLogin' }],
                                });
                            }
                        }
                    ]
                );
            }
        } catch (error) {
            console.error('Change password error:', error);
            Alert.alert('Error', error.response?.data?.message || 'Failed to change password');
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

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
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
                    {/* Logo/Icon */}
                    <View style={styles.iconContainer}>
                        <View style={styles.iconBackground}>
                            <MaterialIcons name="lock-reset" size={50} color="#764ba2" />
                        </View>
                    </View>

                    <Text style={styles.title}>Change Password</Text>
                    <Text style={styles.subtitle}>Please set a new password for your account</Text>

                    {/* Employee ID Display */}
                    <View style={styles.userIdContainer}>
                        <MaterialIcons name="badge" size={18} color="rgba(255,255,255,0.9)" />
                        <Text style={styles.userIdText}>Employee ID: {empId}</Text>
                    </View>

                    {/* Glass Card */}
                    <View style={styles.glassCard}>
                        {/* New Password Input */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>New Password</Text>
                            <View style={[
                                styles.inputContainer,
                                errors.newPassword && styles.inputError
                            ]}>
                                <MaterialIcons name="lock" size={20} color="#764ba2" />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter new password"
                                    placeholderTextColor="#aaa"
                                    secureTextEntry={!showNewPassword}
                                    value={newPassword}
                                    onChangeText={(val) => {
                                        setNewPassword(val);
                                        if (errors.newPassword) setErrors({ ...errors, newPassword: null });
                                    }}
                                />
                                <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)}>
                                    <Entypo
                                        name={showNewPassword ? "eye" : "eye-with-line"}
                                        size={20}
                                        color="#764ba2"
                                    />
                                </TouchableOpacity>
                            </View>
                            {errors.newPassword && (
                                <Text style={styles.errorText}>{errors.newPassword}</Text>
                            )}
                        </View>

                        {/* Confirm Password Input */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Confirm Password</Text>
                            <View style={[
                                styles.inputContainer,
                                errors.confirmPassword && styles.inputError
                            ]}>
                                <MaterialIcons name="lock-outline" size={20} color="#764ba2" />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Confirm new password"
                                    placeholderTextColor="#aaa"
                                    secureTextEntry={!showConfirmPassword}
                                    value={confirmPassword}
                                    onChangeText={(val) => {
                                        setConfirmPassword(val);
                                        if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: null });
                                    }}
                                />
                                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                                    <Entypo
                                        name={showConfirmPassword ? "eye" : "eye-with-line"}
                                        size={20}
                                        color="#764ba2"
                                    />
                                </TouchableOpacity>
                            </View>
                            {errors.confirmPassword && (
                                <Text style={styles.errorText}>{errors.confirmPassword}</Text>
                            )}
                        </View>

                        {/* Change Password Button */}
                        <TouchableOpacity
                            style={[styles.changeButton, loading && styles.changeButtonDisabled]}
                            onPress={handleChangePassword}
                            disabled={loading}
                            activeOpacity={0.8}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <Text style={styles.changeButtonText}>Update Password</Text>
                                    <MaterialIcons name="check" size={20} color="#fff" />
                                </>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Info Text */}
                    <View style={styles.infoContainer}>
                        <MaterialIcons name="info-outline" size={16} color="rgba(255,255,255,0.8)" />
                        <Text style={styles.infoText}>
                            For security, you must change your password on first login
                        </Text>
                    </View>
                </Animated.View>
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
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 25,
    },
    iconContainer: {
        marginBottom: 20,
    },
    iconBackground: {
        width: 90,
        height: 90,
        borderRadius: 45,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 15,
        elevation: 10,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 15,
        color: 'rgba(255, 255, 255, 0.8)',
        marginBottom: 16,
        textAlign: 'center',
    },
    userIdContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        marginBottom: 24,
        gap: 8,
    },
    userIdText: {
        color: 'rgba(255, 255, 255, 0.95)',
        fontSize: 14,
        fontWeight: '600',
    },
    glassCard: {
        width: '100%',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 25,
        padding: 25,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 10,
    },
    inputGroup: {
        marginBottom: 20,
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
    changeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#764ba2',
        paddingVertical: 15,
        borderRadius: 12,
        gap: 8,
        marginTop: 10,
        shadowColor: '#764ba2',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    changeButtonDisabled: {
        opacity: 0.7,
    },
    changeButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    infoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 24,
        gap: 8,
        paddingHorizontal: 20,
    },
    infoText: {
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: 13,
        flex: 1,
    },
});
