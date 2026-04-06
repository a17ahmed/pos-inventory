import React, { useState, useEffect, useRef } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    Animated,
    Dimensions,
    StatusBar,
    ActivityIndicator,
    Alert,
    ScrollView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import axios from 'axios';

const { width, height } = Dimensions.get('window');

export default function BusinessTypeScreen({ navigation }) {
    const API_BASE_URL = Constants.expoConfig.extra.API_BASE_URL;

    const [businessTypes, setBusinessTypes] = useState([]);
    const [selectedType, setSelectedType] = useState(null);
    const [loading, setLoading] = useState(true);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    useEffect(() => {
        fetchBusinessTypes();
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

    const fetchBusinessTypes = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/business-types`);
            setBusinessTypes(response.data);
        } catch (error) {
            console.error('Error fetching business types:', error);
            Alert.alert('Error', 'Failed to load business types. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const getIconName = (iconCode) => {
        const iconMap = {
            'restaurant': 'restaurant',
            'storefront': 'storefront',
            'content-cut': 'content-cut',
            'briefcase': 'business-center'
        };
        return iconMap[iconCode] || 'business-center';
    };

    const handleContinue = () => {
        if (!selectedType) {
            Alert.alert('Selection Required', 'Please select a business type to continue.');
            return;
        }
        navigation.navigate('BusinessDetails', { businessType: selectedType });
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
                <View style={[styles.progressDot, styles.progressActive]} />
                <View style={styles.progressDot} />
                <View style={styles.progressDot} />
            </View>

            <ScrollView
                style={styles.scrollView}
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
                    <Text style={styles.title}>Select Your Business</Text>
                    <Text style={styles.subtitle}>
                        Choose the type that best describes your business
                    </Text>

                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#fff" />
                            <Text style={styles.loadingText}>Loading business types...</Text>
                        </View>
                    ) : (
                        <View style={styles.typesContainer}>
                            {businessTypes.map((type, index) => (
                                <TouchableOpacity
                                    key={type._id}
                                    style={[
                                        styles.typeCard,
                                        selectedType?._id === type._id && styles.typeCardSelected
                                    ]}
                                    onPress={() => setSelectedType(type)}
                                    activeOpacity={0.8}
                                >
                                    <View style={[
                                        styles.typeIconContainer,
                                        selectedType?._id === type._id && styles.typeIconSelected
                                    ]}>
                                        <MaterialIcons
                                            name={getIconName(type.icon)}
                                            size={40}
                                            color={selectedType?._id === type._id ? '#fff' : '#667eea'}
                                        />
                                    </View>
                                    <Text style={[
                                        styles.typeName,
                                        selectedType?._id === type._id && styles.typeNameSelected
                                    ]}>
                                        {type.name}
                                    </Text>
                                    <Text style={[
                                        styles.typeDescription,
                                        selectedType?._id === type._id && styles.typeDescriptionSelected
                                    ]}>
                                        {type.description}
                                    </Text>

                                    {/* Features */}
                                    <View style={styles.featuresRow}>
                                        {type.features?.slice(0, 3).map((feature, idx) => (
                                            <View key={idx} style={[
                                                styles.featureTag,
                                                selectedType?._id === type._id && styles.featureTagSelected
                                            ]}>
                                                <Text style={[
                                                    styles.featureTagText,
                                                    selectedType?._id === type._id && styles.featureTagTextSelected
                                                ]}>
                                                    {feature}
                                                </Text>
                                            </View>
                                        ))}
                                    </View>

                                    {selectedType?._id === type._id && (
                                        <View style={styles.selectedBadge}>
                                            <MaterialIcons name="check-circle" size={24} color="#667eea" />
                                        </View>
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {/* Continue Button */}
                    <TouchableOpacity
                        style={[
                            styles.continueButton,
                            !selectedType && styles.continueButtonDisabled
                        ]}
                        onPress={handleContinue}
                        disabled={!selectedType}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.continueButtonText}>Continue</Text>
                        <MaterialIcons name="arrow-forward" size={24} color="#667eea" />
                    </TouchableOpacity>
                </Animated.View>
            </ScrollView>
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
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingBottom: 30,
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
        marginBottom: 30,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        color: 'rgba(255, 255, 255, 0.8)',
        marginTop: 15,
        fontSize: 14,
    },
    typesContainer: {
        gap: 15,
    },
    typeCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 20,
        padding: 20,
        position: 'relative',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
    },
    typeCardSelected: {
        backgroundColor: 'rgba(255, 255, 255, 1)',
        borderWidth: 2,
        borderColor: '#667eea',
    },
    typeIconContainer: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: 'rgba(102, 126, 234, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    typeIconSelected: {
        backgroundColor: '#667eea',
    },
    typeName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4,
    },
    typeNameSelected: {
        color: '#667eea',
    },
    typeDescription: {
        fontSize: 13,
        color: '#666',
        marginBottom: 12,
    },
    typeDescriptionSelected: {
        color: '#444',
    },
    featuresRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    featureTag: {
        backgroundColor: 'rgba(102, 126, 234, 0.1)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    featureTagSelected: {
        backgroundColor: 'rgba(102, 126, 234, 0.2)',
    },
    featureTagText: {
        fontSize: 11,
        color: '#667eea',
        fontWeight: '500',
    },
    featureTagTextSelected: {
        color: '#5a6fd6',
    },
    selectedBadge: {
        position: 'absolute',
        top: 15,
        right: 15,
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
    continueButtonDisabled: {
        opacity: 0.6,
    },
    continueButtonText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#667eea',
    },
});
