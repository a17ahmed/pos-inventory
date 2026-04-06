import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { StyleSheet, Text, View, ActivityIndicator } from 'react-native'
import React, { useEffect, useState } from 'react'

import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';

import { createDrawerNavigator } from "@react-navigation/drawer";

import UserCustomDrawer from "./userCustomDrawer";

import UserDashboard from '../dashboard/userDashboard';
import Menu from '../menu/menu';
import Receipts from '../receipts/receipts';

const Drawer = createDrawerNavigator();

const UserDrawer = ({ navigation }) => {
    const [loading, setLoading] = useState(true);
    const [employeeData, setEmployeeData] = useState(null);
    const [businessData, setBusinessData] = useState(null);

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

            // If no token or employee data, redirect to login
            if (!token || !employeeStr) {
                navigation.reset({
                    index: 0,
                    routes: [{ name: 'CounterUserLogin' }],
                });
                return;
            }

            const employee = JSON.parse(employeeStr);
            const business = businessStr ? JSON.parse(businessStr) : null;

            setEmployeeData(employee);
            setBusinessData(business);
        } catch (error) {
            console.error('Error loading user data:', error);
            // Clear invalid data and redirect to login
            await AsyncStorage.multiRemove(['token', 'employee', 'counterUser', 'business']);
            navigation.reset({
                index: 0,
                routes: [{ name: 'CounterUserLogin' }],
            });
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#1d62ee" />
                <Text style={styles.loadingText}>Loading...</Text>
            </View>
        );
    }

    const employeeName = employeeData?.name || 'User';

    return (
        <Drawer.Navigator
            drawerContent={(props) => (
                <UserCustomDrawer
                    {...props}
                    employeeData={employeeData}
                    businessData={businessData}
                />
            )}
            screenOptions={{
                drawerLabelStyle: { marginLeft: -20, fontSize: 15 },
                drawerInactiveTintColor: "#333"
            }}
        >
            <Drawer.Screen
                name="User Dashboard"
                options={{
                    drawerIcon: ({ color }) => (
                        <MaterialCommunityIcons name="view-dashboard-outline" size={22} color={color} />
                    ),
                }}>
                {(props) => (
                    <UserDashboard
                        {...props}
                        employeeData={employeeData}
                        businessData={businessData}
                    />
                )}
            </Drawer.Screen>

            <Drawer.Screen
                name="Menu"
                component={Menu}
                options={{
                    drawerIcon: ({ color }) => (
                        <MaterialIcons name="menu-book" size={24} color={color} />
                    ),
                }}
            />

            <Drawer.Screen
                name="Receipts"
                component={Receipts}
                options={{
                    drawerIcon: ({ color }) => (
                        <MaterialCommunityIcons name="point-of-sale" size={22} color={color} />
                    ),
                }}
            />
        </Drawer.Navigator>
    );
};

export default UserDrawer;

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        backgroundColor: "#fff",
        alignItems: "center",
        justifyContent: "center",
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#666',
    },
});
