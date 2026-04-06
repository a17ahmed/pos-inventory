import React, { useEffect, useRef } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    Animated,
    Dimensions,
    StatusBar
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function WelcomeScreen({ navigation }) {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(50)).current;
    const scaleAnim = useRef(new Animated.Value(0.8)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 800,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 800,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 8,
                tension: 40,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    return (
        <LinearGradient
            colors={['#667eea', '#764ba2']}
            style={styles.container}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
        >
            <StatusBar barStyle="light-content" />

            <Animated.View
                style={[
                    styles.content,
                    {
                        opacity: fadeAnim,
                        transform: [
                            { translateY: slideAnim },
                            { scale: scaleAnim }
                        ],
                    },
                ]}
            >
                {/* Logo/Icon */}
                <View style={styles.iconContainer}>
                    <View style={styles.iconBackground}>
                        <MaterialIcons name="point-of-sale" size={80} color="#667eea" />
                    </View>
                </View>

                {/* Title */}
                <Text style={styles.title}>Universal POS</Text>
                <Text style={styles.subtitle}>
                    Your all-in-one point of sale solution
                </Text>

                {/* Features */}
                <View style={styles.featuresContainer}>
                    <View style={styles.featureItem}>
                        <MaterialIcons name="restaurant" size={24} color="rgba(255,255,255,0.9)" />
                        <Text style={styles.featureText}>Restaurant</Text>
                    </View>
                    <View style={styles.featureItem}>
                        <MaterialIcons name="storefront" size={24} color="rgba(255,255,255,0.9)" />
                        <Text style={styles.featureText}>Retail</Text>
                    </View>
                    <View style={styles.featureItem}>
                        <MaterialIcons name="content-cut" size={24} color="rgba(255,255,255,0.9)" />
                        <Text style={styles.featureText}>Service</Text>
                    </View>
                </View>

                {/* Get Started Button */}
                <TouchableOpacity
                    style={styles.getStartedButton}
                    onPress={() => navigation.navigate('BusinessType')}
                    activeOpacity={0.8}
                >
                    <Text style={styles.getStartedText}>Get Started</Text>
                    <MaterialIcons name="arrow-forward" size={24} color="#667eea" />
                </TouchableOpacity>

                {/* Already have account */}
                <TouchableOpacity
                    style={styles.loginLink}
                    onPress={() => navigation.navigate('Login')}
                >
                    <Text style={styles.loginLinkText}>
                        Already have an account? <Text style={styles.loginLinkBold}>Sign In</Text>
                    </Text>
                </TouchableOpacity>
            </Animated.View>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 30,
    },
    iconContainer: {
        marginBottom: 30,
    },
    iconBackground: {
        width: 140,
        height: 140,
        borderRadius: 70,
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
        fontSize: 36,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 10,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.85)',
        textAlign: 'center',
        marginBottom: 40,
    },
    featuresContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 50,
        gap: 30,
    },
    featureItem: {
        alignItems: 'center',
        gap: 8,
    },
    featureText: {
        color: 'rgba(255, 255, 255, 0.9)',
        fontSize: 12,
        fontWeight: '500',
    },
    getStartedButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        paddingVertical: 16,
        paddingHorizontal: 40,
        borderRadius: 30,
        gap: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 8,
        width: width * 0.7,
    },
    getStartedText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#667eea',
    },
    loginLink: {
        marginTop: 30,
    },
    loginLinkText: {
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: 14,
    },
    loginLinkBold: {
        fontWeight: 'bold',
        color: '#fff',
    },
});
