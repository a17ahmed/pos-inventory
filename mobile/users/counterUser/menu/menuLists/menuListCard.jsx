import { StyleSheet, Text, View } from 'react-native'
import React from 'react'
import Card from './card'

import { MaterialIcons, MaterialCommunityIcons, AntDesign, FontAwesome5, Fontisto, Entypo, Feather } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native-gesture-handler';

const MenuListCard = ({ data }) => {

    return (
        <View style={styles.container}>
            <View style={styles.cardContainer}>
                <View style={{ width: "96%" }}>
                    <Card iconName="Menu Name " icon={<MaterialIcons name="food-bank" size={24} color="red" />} data={data.name} />
                </View>
            </View>

            <View style={styles.cardContainer}>
                <View style={{ width: "96%" }}>
                    <Card iconName="Category " icon={<MaterialCommunityIcons name="food-variant" size={24} color="black" />} data={data.category} />
                </View>
            </View>

            <View style={styles.cardContainer}>
                <View style={{ width: "48%" }}>
                    <Card iconName="Price " icon={<FontAwesome5 name="money-bill" size={24} color="green" />} data={data.price} />
                </View>

                <View style={{ width: "48%" }}>
                    <Card iconName="GST " icon={<AntDesign name="dingding" size={24} color="black" />} data={data.gst} />
                </View>
            </View>
        </View>
    )
}

export default MenuListCard

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
})