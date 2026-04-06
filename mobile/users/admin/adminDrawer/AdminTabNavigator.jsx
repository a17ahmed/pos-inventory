import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ActivityIndicator, Text, TouchableOpacity, Platform, Alert } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from 'native-base';

// Business Context
import { useBusiness } from '../../../context/BusinessContext';

// Dashboard
import AdminDashboard from '../../../screens/dashboard/AdminDashboard';
import InsightsScreen from '../../../screens/dashboard/InsightsScreen';

// Staff management
import StaffNavigation from '../staff/staffNavigation';
import CounterUserNavigation from '../counterUser/counterUserNavigation';

// Common screens
import Sales from '../sales/sales';

// Profile Screen Component
import AdminProfileScreen from './AdminProfileScreen';

// Settings and Management Screens
import BusinessSettings from '../settings/BusinessSettings';
import DailyReports from '../settings/DailyReports';
import ProductManagement from '../settings/ProductManagement';

// Expense Management Screens
import ExpenseListScreen from '../expenses/ExpenseListScreen';
import AddExpenseScreen from '../expenses/AddExpenseScreen';
import ExpenseDetailScreen from '../expenses/ExpenseDetailScreen';

// Vendor & Supply Management
import VendorNavigation from '../vendors/vendorNavigation';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Home Stack
const HomeStack = ({ businessData, adminData, businessType }) => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="DashboardMain">
                {(props) => (
                    <AdminDashboard
                        {...props}
                        businessData={businessData}
                        adminData={adminData}
                    />
                )}
            </Stack.Screen>
            <Stack.Screen name="Insights" component={InsightsScreen} />
        </Stack.Navigator>
    );
};

// Products Stack (inventory items)
const ItemsStack = () => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="ProductsMain" component={ProductManagement} />
        </Stack.Navigator>
    );
};

// Staff/Counter Users Stack
const StaffStack = ({ businessType }) => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="CounterUsersMain" component={CounterUserNavigation} />
        </Stack.Navigator>
    );
};

// Sales Stack
const SalesStack = ({ businessType }) => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="SalesMain">
                {(props) => <Sales {...props} businessType={businessType} />}
            </Stack.Screen>
        </Stack.Navigator>
    );
};

// Profile Stack
const ProfileStack = ({ adminData, businessData, businessType, navigation }) => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="ProfileMain">
                {(props) => (
                    <AdminProfileScreen
                        {...props}
                        adminData={adminData}
                        businessData={businessData}
                        businessType={businessType}
                        onSignOut={() => {
                            navigation.reset({
                                index: 0,
                                routes: [{ name: 'Login' }],
                            });
                        }}
                    />
                )}
            </Stack.Screen>
            <Stack.Screen name="BusinessSettings">
                {(props) => (
                    <BusinessSettings
                        {...props}
                        businessType={businessType}
                    />
                )}
            </Stack.Screen>
            <Stack.Screen name="DailyReports">
                {(props) => (
                    <DailyReports
                        {...props}
                        businessType={businessType}
                    />
                )}
            </Stack.Screen>
            <Stack.Screen name="ProductManagement">
                {(props) => (
                    <ProductManagement
                        {...props}
                        businessType={businessType}
                    />
                )}
            </Stack.Screen>
            <Stack.Screen name="Expenses" component={ExpenseListScreen} />
            <Stack.Screen name="AddExpense" component={AddExpenseScreen} />
            <Stack.Screen name="ExpenseDetail" component={ExpenseDetailScreen} />
            <Stack.Screen name="Vendors" component={VendorNavigation} />
            <Stack.Screen name="CounterUsers" component={CounterUserNavigation} />
        </Stack.Navigator>
    );
};

// Custom Tab Bar Component - YouTube style compact
const CustomTabBar = ({ state, descriptors, navigation, config }) => {
    const insets = useSafeAreaInsets();

    // Use config colors instead of hardcoded switch
    const activeColor = config?.colors?.primary || '#8b5cf6';

    // Minimum bottom padding of 6, use safe area if available (for notched devices)
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
                        case 'Items':
                            iconName = isFocused ? 'cube' : 'cube-outline';
                            label = 'Products';
                            break;
                        case 'Vendors':
                            iconName = isFocused ? 'cube' : 'cube-outline';
                            label = 'Supplies';
                            break;
                        case 'Sales':
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

const AdminTabNavigator = ({ navigation }) => {
    const [loading, setLoading] = useState(true);
    const [adminData, setAdminData] = useState(null);

    // Use BusinessContext for business type and config
    const { businessData, businessType, config, refresh: refreshBusiness } = useBusiness();

    useEffect(() => {
        loadUserData();
    }, []);

    const loadUserData = async () => {
        try {
            const [adminStr, token] = await Promise.all([
                AsyncStorage.getItem('admin'),
                AsyncStorage.getItem('token')
            ]);

            if (!token || !adminStr) {
                navigation.reset({
                    index: 0,
                    routes: [{ name: 'Login' }],
                });
                return;
            }

            const admin = JSON.parse(adminStr);
            setAdminData(admin);

            // Refresh business context to ensure latest data
            await refreshBusiness();
        } catch (error) {
            console.error('Error loading user data:', error);
            await AsyncStorage.multiRemove(['token', 'admin', 'business']);
            navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
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
                        adminData={adminData}
                        businessData={businessData}
                        businessType={businessType}
                    />
                )}
            </Tab.Screen>

            <Tab.Screen name="Items">
                {(props) => (
                    <ItemsStack
                        {...props}
                        businessType={businessType}
                    />
                )}
            </Tab.Screen>

            <Tab.Screen name="Vendors">
                {(props) => (
                    <VendorNavigation {...props} />
                )}
            </Tab.Screen>

            <Tab.Screen name="Sales">
                {(props) => (
                    <SalesStack {...props} businessType={businessType} />
                )}
            </Tab.Screen>

            <Tab.Screen name="Profile">
                {(props) => (
                    <ProfileStack
                        {...props}
                        adminData={adminData}
                        businessData={businessData}
                        businessType={businessType}
                        navigation={navigation}
                    />
                )}
            </Tab.Screen>
        </Tab.Navigator>
    );
};

export default AdminTabNavigator;

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
