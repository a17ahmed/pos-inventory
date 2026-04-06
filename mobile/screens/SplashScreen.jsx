import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    Dimensions,
    StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../constants/api';

const { width, height } = Dimensions.get('window');

export default function SplashScreen({ navigation }) {
    const scaleAnim = useRef(new Animated.Value(0.5)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const textOpacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Start animations
        Animated.sequence([
            Animated.parallel([
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    friction: 4,
                    tension: 40,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 500,
                    useNativeDriver: true,
                }),
            ]),
            Animated.timing(textOpacity, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start();

        // Check for existing session after a brief delay
        const timer = setTimeout(() => {
            checkSession();
        }, 1500);

        return () => clearTimeout(timer);
    }, []);

    const checkSession = async () => {
        try {
            const [token, admin, employee, business] = await Promise.all([
                AsyncStorage.getItem('token'),
                AsyncStorage.getItem('admin'),
                AsyncStorage.getItem('employee'),
                AsyncStorage.getItem('business'),
            ]);

            if (token && business) {
                // Validate token is still valid by making a lightweight authenticated API call
                let businessData;
                try {
                    businessData = JSON.parse(business);
                } catch (e) {
                    await AsyncStorage.multiRemove(['token', 'refreshToken', 'admin', 'employee', 'business', 'counterUser']);
                    navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
                    return;
                }
                try {
                    await api.get(`/business/${businessData.id || businessData._id}`);
                } catch (validationError) {
                    // If it's a 401, token is expired - clear and go to login
                    if (validationError.response?.status === 401) {
                        await AsyncStorage.multiRemove(['token', 'refreshToken', 'admin', 'employee', 'business', 'counterUser']);
                        navigation.reset({
                            index: 0,
                            routes: [{ name: 'Login' }],
                        });
                        return;
                    }
                    // If it's a network error (server down), still allow in -
                    // the token might be valid, and the interceptor will handle
                    // 401s when the server comes back
                }

                // Check if admin session
                if (admin) {
                    navigation.reset({
                        index: 0,
                        routes: [{ name: 'AdminDrawer' }],
                    });
                    return;
                }

                // Check if employee session
                if (employee) {
                    navigation.reset({
                        index: 0,
                        routes: [{ name: 'EmployeeDrawer' }],
                    });
                    return;
                }
            }

            // No valid session, go to welcome
            navigation.reset({
                index: 0,
                routes: [{ name: 'Welcome' }],
            });
        } catch (error) {
            console.error('Session check error:', error);
            // Clear any corrupted data
            await AsyncStorage.multiRemove(['token', 'refreshToken', 'admin', 'employee', 'business', 'counterUser']);
            navigation.reset({
                index: 0,
                routes: [{ name: 'Welcome' }],
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

            <View style={styles.content}>
                <Animated.View
                    style={[
                        styles.iconContainer,
                        {
                            opacity: opacityAnim,
                            transform: [{ scale: scaleAnim }],
                        },
                    ]}
                >
                    <View style={styles.iconBackground}>
                        <MaterialIcons name="point-of-sale" size={60} color="#667eea" />
                    </View>
                </Animated.View>

                <Animated.View style={{ opacity: textOpacity }}>
                    <Text style={styles.title}>POS System</Text>
                    <Text style={styles.subtitle}>Universal Point of Sale</Text>
                </Animated.View>

                <Animated.View
                    style={[
                        styles.loadingContainer,
                        { opacity: textOpacity },
                    ]}
                >
                    <View style={styles.loadingDots}>
                        <LoadingDot delay={0} />
                        <LoadingDot delay={200} />
                        <LoadingDot delay={400} />
                    </View>
                </Animated.View>
            </View>

            <Text style={styles.footer}>Powered by Modern Tech</Text>
        </LinearGradient>
    );
}

// Animated loading dot component
const LoadingDot = ({ delay }) => {
    const scaleAnim = useRef(new Animated.Value(0.5)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(scaleAnim, {
                    toValue: 1,
                    duration: 400,
                    delay,
                    useNativeDriver: true,
                }),
                Animated.timing(scaleAnim, {
                    toValue: 0.5,
                    duration: 400,
                    useNativeDriver: true,
                }),
            ])
        );
        animation.start();
        return () => animation.stop();
    }, []);

    return (
        <Animated.View
            style={[
                styles.dot,
                { transform: [{ scale: scaleAnim }] },
            ]}
        />
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconContainer: {
        marginBottom: 24,
    },
    iconBackground: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 15,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.8)',
        textAlign: 'center',
    },
    loadingContainer: {
        marginTop: 40,
    },
    loadingDots: {
        flexDirection: 'row',
        gap: 8,
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
    },
    footer: {
        position: 'absolute',
        bottom: 40,
        alignSelf: 'center',
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: 12,
    },
});
