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

export default function LoginScreen({ navigation }) {
    const API_BASE_URL = Constants.expoConfig.extra.API_BASE_URL;

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    useEffect(() => {
        checkExistingSession();
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

    const checkExistingSession = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            const admin = await AsyncStorage.getItem('admin');
            const business = await AsyncStorage.getItem('business');

            // Only auto-login if we have admin data (not employee data)
            if (token && admin && business) {
                navigation.reset({
                    index: 0,
                    routes: [{ name: 'AdminDrawer' }],
                });
            }
        } catch (error) {
            console.log('No existing session');
        }
    };

    const validateForm = () => {
        const newErrors = {};

        if (!email.trim()) {
            newErrors.email = 'Email is required';
        } else if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
            newErrors.email = 'Please enter a valid email';
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
            const response = await axios.post(`${API_BASE_URL}/adminAuth/login`, {
                email: email,
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

                // Store new admin session data
                await AsyncStorage.setItem('token', response.data.token);
                if (response.data.refreshToken) {
                    await AsyncStorage.setItem('refreshToken', response.data.refreshToken);
                }

                if (response.data.admin) {
                    await AsyncStorage.setItem('admin', JSON.stringify(response.data.admin));
                }

                if (response.data.business) {
                    await AsyncStorage.setItem('business', JSON.stringify(response.data.business));
                }

                // Navigate to dashboard
                navigation.reset({
                    index: 0,
                    routes: [{ name: 'AdminDrawer' }],
                });

                setEmail('');
                setPassword('');
            }
        } catch (error) {
            console.error('Login error:', error);
            const message = error.response?.data?.message || 'Invalid email or password';
            Alert.alert('Login Failed', message);
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
                            <MaterialIcons name="point-of-sale" size={50} color="#667eea" />
                        </View>
                    </View>

                    <Text style={styles.title}>Welcome Back</Text>
                    <Text style={styles.subtitle}>Sign in to your account</Text>

                    {/* Glass Card */}
                    <View style={styles.glassCard}>
                        {/* Email Input */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Email</Text>
                            <View style={[
                                styles.inputContainer,
                                errors.email && styles.inputError
                            ]}>
                                <MaterialIcons name="email" size={20} color="#667eea" />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter your email"
                                    placeholderTextColor="#aaa"
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    value={email}
                                    onChangeText={(val) => {
                                        setEmail(val);
                                        if (errors.email) setErrors({ ...errors, email: null });
                                    }}
                                />
                            </View>
                            {errors.email && (
                                <Text style={styles.errorText}>{errors.email}</Text>
                            )}
                        </View>

                        {/* Password Input */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Password</Text>
                            <View style={[
                                styles.inputContainer,
                                errors.password && styles.inputError
                            ]}>
                                <MaterialIcons name="lock" size={20} color="#667eea" />
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
                                        color="#667eea"
                                    />
                                </TouchableOpacity>
                            </View>
                            {errors.password && (
                                <Text style={styles.errorText}>{errors.password}</Text>
                            )}
                        </View>

                        {/* Forgot Password */}
                        <TouchableOpacity
                            style={styles.forgotPassword}
                            onPress={() => navigation.navigate('EmailValidation')}
                        >
                            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                        </TouchableOpacity>

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

                    {/* Counter User Login */}
                    <TouchableOpacity
                        style={styles.counterUserLink}
                        onPress={() => navigation.navigate('CounterUserLogin')}
                    >
                        <MaterialIcons name="person" size={18} color="rgba(255,255,255,0.8)" />
                        <Text style={styles.counterUserText}>Login as Counter User</Text>
                    </TouchableOpacity>

                    {/* Create Account */}
                    <View style={styles.createAccountContainer}>
                        <Text style={styles.createAccountText}>Don't have an account? </Text>
                        <TouchableOpacity onPress={() => navigation.navigate('Welcome')}>
                            <Text style={styles.createAccountLink}>Create Business</Text>
                        </TouchableOpacity>
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
    forgotPassword: {
        alignSelf: 'flex-end',
        marginBottom: 20,
    },
    forgotPasswordText: {
        color: '#667eea',
        fontSize: 13,
        fontWeight: '500',
    },
    loginButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#667eea',
        paddingVertical: 15,
        borderRadius: 12,
        gap: 8,
        shadowColor: '#667eea',
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
    counterUserLink: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 25,
        gap: 6,
    },
    counterUserText: {
        color: 'rgba(255, 255, 255, 0.9)',
        fontSize: 14,
    },
    createAccountContainer: {
        flexDirection: 'row',
        marginTop: 20,
    },
    createAccountText: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 14,
    },
    createAccountLink: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
});
