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
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const { width } = Dimensions.get('window');

export default function CounterUserLoginScreen({ navigation }) {
    const API_BASE_URL = Constants.expoConfig.extra.API_BASE_URL;

    const [employeeId, setEmployeeId] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
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

        if (!employeeId.trim()) {
            newErrors.employeeId = 'Employee ID is required';
        }

        if (!password) {
            newErrors.password = 'Password is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleLogin = async () => {
        if (!validateForm()) return;

        setLoading(true);

        try {
            const response = await axios.post(`${API_BASE_URL}/employeeAuth/login`, {
                employeeId: employeeId.toLowerCase(),
                password: password
            });

            if (response.status === 200 && response.data.token) {
                // Clear ALL old data first to prevent conflicts
                await AsyncStorage.multiRemove([
                    'token',
                    'admin',
                    'business',
                    'employee',
                    'counterUser'
                ]);

                // Store new employee session data
                await AsyncStorage.setItem('token', response.data.token);
                if (response.data.refreshToken) {
                    await AsyncStorage.setItem('refreshToken', response.data.refreshToken);
                }
                if (response.data.counterUser) {
                    await AsyncStorage.setItem('counterUser', JSON.stringify(response.data.counterUser));
                }
                if (response.data.employee) {
                    await AsyncStorage.setItem('employee', JSON.stringify(response.data.employee));
                }
                if (response.data.business) {
                    await AsyncStorage.setItem('business', JSON.stringify(response.data.business));
                }

                // Check if password change is required
                if (response.data.requirePasswordChange) {
                    navigation.navigate('ChangePassword', {
                        employeeId: response.data.employee.employeeId,
                        currentPassword: password
                    });
                } else {
                    navigation.reset({
                        index: 0,
                        routes: [{ name: 'EmployeeDrawer' }],
                    });
                }

                setEmployeeId('');
                setPassword('');
            }
        } catch (error) {
            console.error('Login error:', error);
            Alert.alert('Login Failed', error.response?.data?.message || 'Invalid Employee ID or password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <LinearGradient
            colors={['#f093fb', '#f5576c']}
            style={styles.container}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
        >
            <StatusBar barStyle="light-content" />

            {/* Back Button */}
            {navigation.canGoBack() && (
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <MaterialIcons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
            )}

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
                            <MaterialIcons name="person" size={50} color="#f5576c" />
                        </View>
                    </View>

                    <Text style={styles.title}>Employee Login</Text>
                    <Text style={styles.subtitle}>Sign in with your employee ID</Text>

                    {/* Glass Card */}
                    <View style={styles.glassCard}>
                        {/* Employee ID Input */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Employee ID</Text>
                            <View style={[
                                styles.inputContainer,
                                errors.employeeId && styles.inputError
                            ]}>
                                <MaterialIcons name="badge" size={20} color="#f5576c" />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter your ID (e.g., salon@john)"
                                    placeholderTextColor="#aaa"
                                    autoCapitalize="none"
                                    value={employeeId}
                                    onChangeText={(val) => {
                                        setEmployeeId(val.toLowerCase());
                                        if (errors.employeeId) setErrors({ ...errors, employeeId: null });
                                    }}
                                />
                            </View>
                            {errors.employeeId && (
                                <Text style={styles.errorText}>{errors.employeeId}</Text>
                            )}
                        </View>

                        {/* Password Input */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Password</Text>
                            <View style={[
                                styles.inputContainer,
                                errors.password && styles.inputError
                            ]}>
                                <MaterialIcons name="lock" size={20} color="#f5576c" />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter your password"
                                    placeholderTextColor="#aaa"
                                    secureTextEntry={!showPassword}
                                    value={password}
                                    onChangeText={(val) => {
                                        setPassword(val);
                                        if (errors.password) setErrors({ ...errors, password: null });
                                    }}
                                />
                                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                    <Entypo
                                        name={showPassword ? "eye" : "eye-with-line"}
                                        size={20}
                                        color="#f5576c"
                                    />
                                </TouchableOpacity>
                            </View>
                            {errors.password && (
                                <Text style={styles.errorText}>{errors.password}</Text>
                            )}
                        </View>

                        {/* Login Button */}
                        <TouchableOpacity
                            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                            onPress={handleLogin}
                            disabled={loading}
                            activeOpacity={0.8}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <Text style={styles.loginButtonText}>Sign In</Text>
                                    <MaterialIcons name="arrow-forward" size={20} color="#fff" />
                                </>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Admin Login */}
                    <TouchableOpacity
                        style={styles.adminLink}
                        onPress={() => navigation.navigate('Login')}
                    >
                        <MaterialIcons name="admin-panel-settings" size={18} color="rgba(255,255,255,0.8)" />
                        <Text style={styles.adminLinkText}>Login as Admin</Text>
                    </TouchableOpacity>
                </Animated.View>
            </KeyboardAvoidingView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    backButton: {
        position: 'absolute',
        top: 50,
        left: 20,
        zIndex: 10,
        padding: 10,
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
        marginBottom: 30,
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
    loginButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f5576c',
        paddingVertical: 15,
        borderRadius: 12,
        gap: 8,
        marginTop: 10,
        shadowColor: '#f5576c',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    loginButtonDisabled: {
        opacity: 0.7,
    },
    loginButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    adminLink: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 30,
        gap: 6,
    },
    adminLinkText: {
        color: 'rgba(255, 255, 255, 0.9)',
        fontSize: 14,
    },
});
