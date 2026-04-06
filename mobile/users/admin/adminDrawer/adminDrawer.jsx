import { StyleSheet, Text, View } from 'react-native'
import React, { useState, useEffect } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage';

import { MaterialCommunityIcons, FontAwesome, MaterialIcons } from '@expo/vector-icons';

import { createDrawerNavigator } from "@react-navigation/drawer";

import AdminCustomDrawer from "./adminCustomDrawer";

// Screens and Navigations
import AdminDashboard from '../../../screens/dashboard/AdminDashboard';
import CounterUserNavigation from '../counterUser/counterUserNavigation';
import Sales from '../sales/sales';

// Staff management
import StaffNavigation from '../staff/staffNavigation';

import { colors, getBusinessConfig } from '../../../constants/theme';

const Drawer = createDrawerNavigator();

const AdminDrawer = (props) => {
    const [adminData, setAdminData] = useState(null);
    const [businessData, setBusinessData] = useState(null);
    const [businessConfig, setBusinessConfig] = useState(null);
    const [businessType, setBusinessType] = useState('retail');

    useEffect(() => {
        loadStoredData();
    }, []);

    const loadStoredData = async () => {
        try {
            const adminStr = await AsyncStorage.getItem('admin');
            const businessStr = await AsyncStorage.getItem('business');

            if (adminStr) {
                setAdminData(JSON.parse(adminStr));
            }
            if (businessStr) {
                const business = JSON.parse(businessStr);
                setBusinessData(business);

                // Get business type config for dynamic labels
                const typeCode = business.businessType?.code || 'retail';
                setBusinessType(typeCode);
                setBusinessConfig(getBusinessConfig(typeCode));
            }
        } catch (error) {
            console.log('Error loading stored data:', error);
        }
    };

    const primaryColor = businessConfig?.color?.primary || colors.primary;

    return (
        <Drawer.Navigator
            drawerContent={(drawerProps) => (
                <AdminCustomDrawer
                    {...drawerProps}
                    adminData={adminData}
                    businessData={businessData}
                />
            )}
            screenOptions={{
                headerStyle: {
                    backgroundColor: colors.white,
                    elevation: 0,
                    shadowOpacity: 0,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                },
                headerTintColor: colors.text,
                headerTitleStyle: {
                    fontWeight: '600',
                },
                drawerLabelStyle: {
                    marginLeft: -16,
                    fontSize: 15,
                    fontWeight: '500',
                },
                drawerActiveBackgroundColor: `${primaryColor}15`,
                drawerActiveTintColor: primaryColor,
                drawerInactiveTintColor: colors.textSecondary,
                drawerItemStyle: {
                    borderRadius: 12,
                    marginHorizontal: 8,
                    marginVertical: 2,
                },
            }}
        >
            {/* Dashboard */}
            <Drawer.Screen
                name="Admin Dashboard"
                component={AdminDashboard}
                options={{
                    title: 'Dashboard',
                    drawerIcon: ({ color }) => (
                        <MaterialCommunityIcons name="view-dashboard-outline" size={22} color={color} />
                    ),
                }}
            />

            {/* Counter Users */}
            <Drawer.Screen
                name="Counter Users"
                component={CounterUserNavigation}
                options={{
                    title: 'Counter Users',
                    drawerIcon: ({ color }) => (
                        <MaterialIcons name="people" size={22} color={color} />
                    ),
                }}
            />

            {/* Sales & Reports */}
            <Drawer.Screen
                name="Sales"
                component={Sales}
                options={{
                    title: 'Sales & Reports',
                    drawerIcon: ({ color }) => (
                        <MaterialIcons name="receipt-long" size={22} color={color} />
                    ),
                }}
            />
        </Drawer.Navigator>
    )
}

export default AdminDrawer

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
        alignItems: "center",
        justifyContent: "center",
    },
})
