import { StyleSheet, Text, View, TouchableOpacity } from 'react-native'
import React from 'react'
import Card from './card'

import { FontAwesome5, Fontisto, Entypo, Feather, MaterialCommunityIcons } from '@expo/vector-icons';

const SalesListCard = ({ data, print }) => {

    return (
        <View style={styles.container}>
            <View style={styles.cardContainer}>
                <View style={{ width: "48%" }}>
                    <Card iconName="Invoice# " icon={<MaterialCommunityIcons name="receipt" size={24} color="gold" />} data={data.billNumber} />
                </View>

                <View style={{ width: "48%" }}>
                    <Card iconName="Total Bill " icon={<FontAwesome5 name="money-bill" size={24} color="green" />} data={data.totalBill} />
                </View>
            </View>

            <View style={styles.cardContainer}>
                <View style={{ width: "96%" }}>
                    <Card iconName="Cashier " icon={<Feather name="user-check" size={24} color="orange" />} data={data.cashierName} />
                </View>
            </View>

            <View style={styles.cardContainer}>
                <View style={{ width: "48%" }}>
                    <Card iconName="Date " icon={<Fontisto name="date" size={24} color="red" />} data={data.date} />
                </View>

                <View style={{ width: "48%" }}>
                    <Card iconName="Time " icon={<Entypo name="clock" size={24} color="purple" />} data={data.time} />
                </View>
            </View>

            <View style={styles.cardContainer}>
                <TouchableOpacity onPress={() => print(data.billNumber, data.date, data.time, data.cashierName, data.customerName, data.items, data.totalBill, data.totalGST, data.totalQty, data.cashGiven)} style={styles.cardIcon}>
                    <View>
                        <Entypo name="print" size={24} color="#ffffff" />
                    </View>
                </TouchableOpacity>
            </View>
        </View>
    )
}

export default SalesListCard

const styles = StyleSheet.create({
    container: {
        backgroundColor: "lightgrey",
        marginBottom: 20,
        padding: 5,
        borderTopRightRadius: 20,
        borderTopLeftRadius: 20,

        shadowColor: 'blue',
        //Add shadow for android
        elevation: 8,
        // Add shadow properties for shadow on iOS
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    cardContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingVertical: 8,
    },

    cardIcon: {
        paddingHorizontal: 40,
        paddingVertical: 10,
        borderTopRightRadius: 10,
        borderTopLeftRadius: 10,
        backgroundColor: "#1d62ee",
    },
})