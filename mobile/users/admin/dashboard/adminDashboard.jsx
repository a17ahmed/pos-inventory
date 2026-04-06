import Constants from 'expo-constants';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import React, { useCallback, useEffect, useState } from 'react'

import { FontAwesome5 } from '@expo/vector-icons';
import AdminDataCard from './adminDataCard';
import { Feather } from '@expo/vector-icons';
import { Foundation } from '@expo/vector-icons';

import SalesChart from '../dashboard/graph';
import axios from 'axios';
import { useFocusEffect } from '@react-navigation/native';

// import AdminNavbar from './adminNavbar';

const AdminDashboard = () => {

    const API_BASE_URL = Constants.expoConfig.extra.API_BASE_URL;


    //Get token from async storage
    const getToken = async () => {
        try {
            const token = await AsyncStorage.getItem('token'); /*To get Stored Token from async storage*/
            return token;
        } catch (error) {
            return null;
        }
    };

    const [isLoading, setIsLoading] = useState(true)

    //Counter User Data
    const [noCounterUser, setNoCounterUser] = useState([]);
    const getNoCounterUserHandler = async () => {
        try {
            const token = await getToken();

            if (token) {
                const response = await axios.get(`${API_BASE_URL}/counterUser`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });
                setNoCounterUser(response.data.length);
            } else {
                return null;
            }
        }
        catch (error) {
            return null;
        }
    }

    // Receipt Data
    const [noReceipts, setNoReceipts] = useState([]);
    const [totalSales, setTotalSales] = useState(0);
    const [todayTotalSales, setTodayTotalSales] = useState(0);
    const getNoReceiptHandler = async () => {
        try {
            const token = await getToken();

            if (token) {
                const response = await axios.get(`${API_BASE_URL}/receipt?all=true`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });
                // Handle both old (array) and new (object with receipts) response formats
                const receiptsData = response.data?.receipts || response.data || [];
                setNoReceipts(receiptsData.length);

                // Calculate total sales from the receipt data START
                const salesArray = receiptsData.map((receipt) => receipt.totalBill);
                const total = salesArray.reduce((accumulator, currentValue) => accumulator + currentValue, 0);
                setTotalSales(total);
                // Calculate total sales from the receipt data END


                // Calculate today total sales from the receipt data START
                const today = new Date(); // Get today's date
                today.setHours(0, 0, 0, 0); // Set time to the start of the day (midnight)

                // Filter receipts created today
                const todayReceipts = receiptsData.filter((receipt) => {
                    const receiptDate = new Date(receipt.createdAt);
                    return receiptDate >= today;
                });

                // Calculate total sales from the filtered receipts
                const todaySalesArray = todayReceipts.map((receipt) => receipt.totalBill);
                const todayTotal = todaySalesArray.reduce((accumulator, currentValue) => accumulator + currentValue, 0);
                setTodayTotalSales(todayTotal);
                // Calculate today total sales from the receipt data END
            } else {
                return null
            }
        }
        catch (error) {
            return null;
        }
    }

    //Admin Data
    const [noADmin, setNoAdmins] = useState([]);
    const getNoAdmin = async () => {
        try {
            const token = await getToken();

            if (token) {
                const response = await axios.get(`${API_BASE_URL}/admin`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });
                setNoAdmins(response.data.length);
                setIsLoading(false);
            } else {
                return null;
            }
        }
        catch (error) {
            return null;
        }
    }

    useEffect(() => {
        Promise.all([
            getNoCounterUserHandler(),
            getNoReceiptHandler(),
            getNoAdmin()
        ]).finally(() => setIsLoading(false));
    }, []);

    // Use useFocusEffect to fetch data whenever the screen gains focus
    useFocusEffect(
        useCallback(() => {
            getNoCounterUserHandler();
            getNoReceiptHandler();
            getNoAdmin();
        }, [])
    );


    if (isLoading) {
        return <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="blue" />
            <Text>Loading data...</Text>
        </View>
    }

    return (
        <View style={styles.adminDashboardContainer}>
            {/* <View>
                <AdminNavbar />
            </View> */}

            <ScrollView>
                <View style={styles.adminDataCard}>
                    <AdminDataCard icon={<View style={{ backgroundColor: "#d4f2f4", padding: 15, borderRadius: 100, }}><Feather name="book" size={25} color="#87c6c7" /></View>} val={totalSales} title="Sales" />

                    <AdminDataCard icon={<View style={{ backgroundColor: "#fce1dd", padding: 15, borderRadius: 100, }}><Foundation name="dollar-bill" size={25} color="#e7a0a2" /></View>} val={todayTotalSales} title="Today Sales" />

                    <AdminDataCard icon={<View style={{ backgroundColor: "#fcedde", padding: 15, borderRadius: 100, }}><FontAwesome5 name="receipt" size={25} color="#e3b14f" /></View>} val={noReceipts} title="Receipts" />

                    <AdminDataCard icon={<View style={{ backgroundColor: "#d4e9f6", padding: 15, borderRadius: 100, }}><FontAwesome5 name="user-tie" size={25} color="#8b9faa" /></View>} val={noADmin} title="Admins" />

                    <AdminDataCard icon={<View style={{ backgroundColor: "#d4e9f6", padding: 15, borderRadius: 100, }}><Feather name="users" size={25} color="#8b9faa" /></View>} val={noCounterUser} title="Counter User" />
                </View>

                <View style={{ flex: 1, width: '100%' }}>
                    <SalesChart />
                </View>

            </ScrollView>

        </View>
    )
}

export default AdminDashboard;


const styles = StyleSheet.create({

    adminDashboardContainer: {
        flex: 1,
        backgroundColor: '#f0f5fb',
    },
    adminDataCard: {
        flex: 1,
        paddingTop: 20,
        paddingHorizontal: 40,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
})