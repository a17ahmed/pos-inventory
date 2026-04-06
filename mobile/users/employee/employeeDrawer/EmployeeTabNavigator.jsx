import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ActivityIndicator, Text, TouchableOpacity, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../../constants/api';
import { connectSocket, disconnectSocket } from '../../../services/socket';

// Business Context
import { useBusiness } from '../../../context/BusinessContext';

// Dashboard screen
import RetailDashboard from '../dashboard/RetailDashboard';

// Common screens
import TransactionsScreen from '../transactions/TransactionsScreen';
import MyProfileScreen from '../dashboard/MyProfileScreen';
import CheckoutScreen from '../billing/CheckoutScreen';
import ReturnsScreen from '../returns/ReturnsScreen';

// Retail-specific screens
import ProductsScreen from '../products/ProductsScreen';
import PendingBillsScreen from '../pending/PendingBillsScreen';

// Receipts
import ReceiptsScreen from '../receipts/ReceiptsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Home Stack (includes checkout and bill screens)
const HomeStack = ({ employeeData, businessData, businessType, businessSettings }) => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="HomeMain">
                {(props) => (
                    <RetailDashboard
                        {...props}
                        employeeData={employeeData}
                        businessData={businessData}
                        businessSettings={businessSettings}
                    />
                )}
            </Stack.Screen>
            <Stack.Screen
                name="Checkout"
                component={CheckoutScreen}
                options={{
                    headerShown: true,
                    title: 'Checkout',
                    headerStyle: { backgroundColor: '#fff' },
                    headerTintColor: '#1e293b',
                }}
            />
            <Stack.Screen name="Returns">
                {(props) => (
                    <ReturnsScreen
                        {...props}
                        employeeData={employeeData}
                        businessData={businessData}
                    />
                )}
            </Stack.Screen>
        </Stack.Navigator>
    );
};

// Products Stack (for retail employees)
const ProductsStack = ({ employeeData, businessData }) => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="ProductsMain">
                {(props) => (
                    <ProductsScreen
                        {...props}
                        employeeData={employeeData}
                        businessData={businessData}
                    />
                )}
            </Stack.Screen>
        </Stack.Navigator>
    );
};

// Pending Bills Stack (for retail employees)
const PendingBillsStack = ({ employeeData, businessData }) => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="PendingBillsMain">
                {(props) => (
                    <PendingBillsScreen
                        {...props}
                        employeeData={employeeData}
                        businessData={businessData}
                    />
                )}
            </Stack.Screen>
        </Stack.Navigator>
    );
};

// Transactions Stack
const TransactionsStack = ({ employeeData, businessData }) => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="TransactionsMain">
                {(props) => (
                    <TransactionsScreen
                        {...props}
                        employeeData={employeeData}
                        businessData={businessData}
                    />
                )}
            </Stack.Screen>
        </Stack.Navigator>
    );
};

// Profile Stack
const ProfileStack = ({ employeeData, businessData, businessType, navigation, onSignOut }) => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="ProfileMain">
                {(props) => (
                    <MyProfileScreen
                        {...props}
                        employeeData={employeeData}
                        businessData={businessData}
                        businessType={businessType}
                        onSignOut={onSignOut}
                    />
                )}
            </Stack.Screen>
        </Stack.Navigator>
    );
};

// Custom Tab Bar Component - YouTube style compact
const CustomTabBar = ({ state, descriptors, navigation, config }) => {
    const insets = useSafeAreaInsets();

    // Use config colors instead of hardcoded switch
    const activeColor = config?.colors?.primary || '#8b5cf6';

    // Minimum bottom padding of 6, use safe area if available (for notched iPhones)
    const bottomPadding = Math.max(insets.bottom, 6);

    return (
        <View style={[styles.tabBarContainer, { paddingBottom: bottomPadding }]}>
            <View style={styles.tabBar}>
                {state.routes.map((route, index) => {
                    const { options } = descriptors[route.key];
                    const isFocused = state.index === index;

                    const onPress = () => {
                        const event = navigation.emit({
                            type: 'tabPress',
                            target: route.key,
                            canPreventDefault: true,
                        });

                        if (!isFocused && !event.defaultPrevented) {
                            navigation.navigate(route.name);
                        }
                    };

                    let iconName;
                    let label;

                    switch (route.name) {
                        case 'Home':
                            iconName = isFocused ? 'home' : 'home-outline';
                            label = 'Home';
                            break;
                        case 'Products':
                            iconName = isFocused ? 'cube' : 'cube-outline';
                            label = 'Products';
                            break;
                        case 'Pending':
                            iconName = isFocused ? 'time' : 'time-outline';
                            label = 'Pending';
                            break;
                        case 'Transactions':
                            iconName = isFocused ? 'receipt' : 'receipt-outline';
                            label = 'Sales';
                            break;
                        case 'Profile':
                            iconName = isFocused ? 'person-circle' : 'person-circle-outline';
                            label = 'Profile';
                            break;
                        default:
                            iconName = 'ellipse';
                            label = route.name;
                    }

                    return (
                        <TouchableOpacity
                            key={route.key}
                            onPress={onPress}
                            style={styles.tabItem}
                            activeOpacity={0.7}
                        >
                            {isFocused ? (
                                <View style={[styles.activeTabBg, { backgroundColor: `${activeColor}20` }]}>
                                    <Ionicons
                                        name={iconName}
                                        size={22}
                                        color={activeColor}
                                    />
                                </View>
                            ) : (
                                <Ionicons
                                    name={iconName}
                                    size={22}
                                    color="#94a3b8"
                                />
                            )}
                            <Text style={[
                                styles.tabLabel,
                                { color: isFocused ? activeColor : '#94a3b8' }
                            ]}>
                                {label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
};

const EmployeeTabNavigator = ({ navigation }) => {
    const [loading, setLoading] = useState(true);
    const [employeeData, setEmployeeData] = useState(null);
    const [businessSettings, setBusinessSettings] = useState({});

    // Use BusinessContext for business type and config
    const { businessData, businessType, config, refresh: refreshBusiness } = useBusiness();

    useEffect(() => {
        loadUserData();
    }, []);

    // Initialize socket connection when employee data is loaded
    useEffect(() => {
        if (employeeData) {
            console.log('[Socket] Initializing socket connection for employee:', employeeData.name);
            connectSocket().catch(err => {
                console.log('[Socket] Connection failed:', err.message);
            });
        }

        // Cleanup on unmount
        return () => {
            disconnectSocket();
        };
    }, [employeeData]);

    const loadUserData = async () => {
        try {
            const [employeeStr, token] = await Promise.all([
                AsyncStorage.getItem('employee'),
                AsyncStorage.getItem('token')
            ]);

            if (!token || !employeeStr) {
                navigation.reset({
                    index: 0,
                    routes: [{ name: 'EmployeeLogin' }],
                });
                return;
            }

            const employee = JSON.parse(employeeStr);
            setEmployeeData(employee);

            // Refresh business context to ensure latest data
            await refreshBusiness();
        } catch (error) {
            console.error('Error loading user data:', error);
            await AsyncStorage.multiRemove(['token', 'employee', 'counterUser', 'business', 'admin']);
            navigation.reset({
                index: 0,
                routes: [{ name: 'EmployeeLogin' }],
            });
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={config?.colors?.primary || '#8b5cf6'} />
                <Text style={styles.loadingText}>Loading...</Text>
            </View>
        );
    }

    return (
        <Tab.Navigator
            tabBar={(props) => (
                <CustomTabBar {...props} config={config} />
            )}
            screenOptions={{
                headerShown: false,
            }}
        >
            <Tab.Screen name="Home">
                {(props) => (
                    <HomeStack
                        {...props}
                        employeeData={employeeData}
                        businessData={businessData}
                        businessType={businessType}
                        businessSettings={businessSettings}
                    />
                )}
            </Tab.Screen>

            <Tab.Screen name="Products">
                {(props) => (
                    <ProductsStack
                        {...props}
                        employeeData={employeeData}
                        businessData={businessData}
                    />
                )}
            </Tab.Screen>

            <Tab.Screen name="Pending">
                {(props) => (
                    <PendingBillsStack
                        {...props}
                        employeeData={employeeData}
                        businessData={businessData}
                    />
                )}
            </Tab.Screen>

            <Tab.Screen name="Transactions">
                {(props) => (
                    <TransactionsStack
                        {...props}
                        employeeData={employeeData}
                        businessData={businessData}
                    />
                )}
            </Tab.Screen>

            <Tab.Screen name="Profile">
                {(props) => (
                    <ProfileStack
                        {...props}
                        employeeData={employeeData}
                        businessData={businessData}
                        businessType={businessType}
                        navigation={navigation}
                        onSignOut={() => {
                            // Disconnect socket before navigating away
                            disconnectSocket();
                            navigation.reset({
                                index: 0,
                                routes: [{ name: 'EmployeeLogin' }],
                            });
                        }}
                    />
                )}
            </Tab.Screen>
        </Tab.Navigator>
    );
};

export default EmployeeTabNavigator;

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        backgroundColor: '#f8fafc',
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#64748b',
    },
    tabBarContainer: {
        backgroundColor: '#fff',
        paddingTop: 6,
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
    },
    tabBar: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
    },
    tabItem: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 2,
        minWidth: 60,
    },
    activeTabBg: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabLabel: {
        fontSize: 10,
        fontWeight: '500',
        marginTop: 2,
    },
});
