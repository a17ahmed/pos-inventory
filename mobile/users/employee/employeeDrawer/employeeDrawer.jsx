import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ActivityIndicator, Text } from 'react-native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MaterialCommunityIcons, MaterialIcons, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import EmployeeCustomDrawer from './employeeCustomDrawer';

// Dashboard screen
import RetailDashboard from '../dashboard/RetailDashboard';

// Common screens
import TransactionsScreen from '../transactions/TransactionsScreen';
import MyProfileScreen from '../dashboard/MyProfileScreen';
import CheckoutScreen from '../billing/CheckoutScreen';

const Drawer = createDrawerNavigator();
const Stack = createNativeStackNavigator();

// Main Dashboard Stack (includes checkout)
const DashboardStack = ({ employeeData, businessData, businessType }) => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="DashboardMain">
                {(props) => (
                    <RetailDashboard
                        {...props}
                        employeeData={employeeData}
                        businessData={businessData}
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
        </Stack.Navigator>
    );
};

const EmployeeDrawer = ({ navigation }) => {
    const [loading, setLoading] = useState(true);
    const [employeeData, setEmployeeData] = useState(null);
    const [businessData, setBusinessData] = useState(null);
    const [businessType, setBusinessType] = useState(null);

    useEffect(() => {
        loadUserData();
    }, []);

    const loadUserData = async () => {
        try {
            const [employeeStr, businessStr, token] = await Promise.all([
                AsyncStorage.getItem('employee'),
                AsyncStorage.getItem('business'),
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
            const business = businessStr ? JSON.parse(businessStr) : null;

            setEmployeeData(employee);
            setBusinessData(business);

            // Determine business type
            const typeCode = business?.businessType?.code?.toLowerCase() || '';
            if (typeCode.includes('salon') || typeCode.includes('spa') || typeCode.includes('service') || typeCode.includes('clinic')) {
                setBusinessType('service');
            } else if (typeCode.includes('retail') || typeCode.includes('shop') || typeCode.includes('store')) {
                setBusinessType('retail');
            } else {
                setBusinessType('restaurant');
            }
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
                <ActivityIndicator size="large" color="#667eea" />
                <Text style={styles.loadingText}>Loading...</Text>
            </View>
        );
    }

    const getDashboardTitle = () => 'POS Terminal';

    return (
        <Drawer.Navigator
            drawerContent={(props) => (
                <EmployeeCustomDrawer
                    {...props}
                    employeeData={employeeData}
                    businessData={businessData}
                    businessType={businessType}
                />
            )}
            screenOptions={{
                headerStyle: {
                    backgroundColor: '#fff',
                    elevation: 2,
                    shadowOpacity: 0.1,
                },
                headerTintColor: '#1e293b',
                headerTitleStyle: {
                    fontWeight: '600',
                },
                drawerLabelStyle: {
                    marginLeft: -16,
                    fontSize: 15,
                    fontWeight: '500',
                },
                drawerActiveBackgroundColor: '#f0f9ff',
                drawerActiveTintColor: '#0284c7',
                drawerInactiveTintColor: '#64748b',
            }}
        >
            <Drawer.Screen
                name="Dashboard"
                options={{
                    title: getDashboardTitle(),
                    drawerIcon: ({ color, size }) => (
                        <MaterialCommunityIcons name="view-dashboard" size={size} color={color} />
                    ),
                }}
            >
                {(props) => (
                    <DashboardStack
                        {...props}
                        employeeData={employeeData}
                        businessData={businessData}
                        businessType={businessType}
                    />
                )}
            </Drawer.Screen>

            <Drawer.Screen
                name="Transactions"
                options={{
                    title: 'My Transactions',
                    drawerIcon: ({ color, size }) => (
                        <MaterialIcons name="receipt-long" size={size} color={color} />
                    ),
                }}
            >
                {(props) => (
                    <TransactionsScreen
                        {...props}
                        employeeData={employeeData}
                        businessData={businessData}
                    />
                )}
            </Drawer.Screen>

            <Drawer.Screen
                name="MyProfile"
                options={{
                    title: 'My Profile',
                    drawerIcon: ({ color, size }) => (
                        <Ionicons name="person-circle-outline" size={size} color={color} />
                    ),
                }}
            >
                {(props) => (
                    <MyProfileScreen
                        {...props}
                        employeeData={employeeData}
                        businessData={businessData}
                    />
                )}
            </Drawer.Screen>
        </Drawer.Navigator>
    );
};

export default EmployeeDrawer;

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
});
