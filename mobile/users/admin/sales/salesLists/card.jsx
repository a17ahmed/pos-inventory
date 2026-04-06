import { StyleSheet, Text, View } from 'react-native'
import React from 'react'
import { ScrollView } from 'react-native-gesture-handler'

const Card = ({ icon, data, iconName }) => {
    return (
        <View style={styles.container}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontWeight: "bold" }}>
                    {iconName}
                </Text>
                <Text>
                    {icon}
                </Text>
            </View>

            <View style={{ height: 35 }}>
                <ScrollView>
                    <Text>
                        {data}
                    </Text>
                </ScrollView>
            </View>
        </View>
    )
}

export default Card

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
        gap: 20,
        backgroundColor: '#ffffff',
        paddingVertical: 10,

        //Add shadow for android
        elevation: 8,
        // Add shadow properties for shadow on iOS
        shadowColor: 'black',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,

        borderRadius: 8,
    }
})