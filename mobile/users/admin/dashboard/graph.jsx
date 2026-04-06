import Constants from 'expo-constants';

import AsyncStorage from '@react-native-async-storage/async-storage';

import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { Text, View, StyleSheet, Dimensions, ScrollView, } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart } from 'react-native-chart-kit';

const SalesGraph = () => {

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

    const [salesData, setSalesData] = useState([]);;
    const getSalesData = async () => {
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
                setSalesData(receiptsData);
            } else {
                return null;
            }
        }
        catch (error) {
            return null;
        }
    }

    useEffect(() => {
        getSalesData();
    }, [])

    const groupedSalesByDay = {};

    salesData.forEach(sale => {
        if (!sale.date) return;
        const dateParts = sale.date.split('-');
        if (dateParts.length < 3) return;
        const dateMonthYear = `${dateParts[0]}-${dateParts[1]}-${dateParts[2]}`; // Format: DD-MM-YYYY

        if (!groupedSalesByDay[dateMonthYear]) {
            groupedSalesByDay[dateMonthYear] = 0;
        }

        groupedSalesByDay[dateMonthYear] += (sale.totalBill || 0);
    });

    const chartData = Object.keys(groupedSalesByDay).map(dateMonthYear => ({
        month: dateMonthYear,
        amount: groupedSalesByDay[dateMonthYear],
    }));

    const chartWidth = Dimensions.get('window').width * 1;

    return (
        <ScrollView horizontal>
            <View style={styles.chartContainer}>
                <Text style={styles.header}>Sales Chart</Text>
                <BarChart
                    data={{
                        labels: chartData.map(item => item.month),
                        datasets: [
                            {
                                data: chartData.map(item => item.amount),
                            },
                        ],
                    }}
                    width={chartWidth} // Adjust width for horizontal scrolling
                    height={220}
                    yAxisLabel={'Rs'}
                    yAxisSuffix={''}
                    fromZero={true} // Start y-axis from zero
                    chartConfig={{
                        backgroundColor: '#1cc910',
                        backgroundGradientFrom: '#eff3ff',
                        backgroundGradientTo: '#efefef',
                        color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                        style: {
                            borderRadius: 16,
                            marginLeft: 30,
                        },
                        propsForLabels: {
                            fontSize: 8,
                        },
                    }}
                    style={styles.chart}
                    segments={6} // Customize the number of segments on the y-axis
                />
            </View>
        </ScrollView>
    );
};

export default () => {
    return (
        <SafeAreaView style={{ flex: 1 }}>
            <ScrollView>
                <View style={styles.container}>
                    <SalesGraph />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({

    chartContainer: {
        width: '100%', // Occupy the full width
    },
    chart: {
        marginVertical: 8,
        borderRadius: 16,
    },

    container: {
        flex: 1,
        backgroundColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        padding: 10,
    },
    header: {
        textAlign: 'center',
        fontSize: 18,
    },
});