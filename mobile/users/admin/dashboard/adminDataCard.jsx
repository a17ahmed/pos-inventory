import { StyleSheet, Text, View } from 'react-native'
import React from 'react'

const AdminDataCard = ({ icon, val, title }) => {
    return (
        <View style={styles.adminCardDataContainer}>
            <View style={{ marginEnd: 20 }}>
                {icon}
            </View>


            <View>
                <Text style={{ fontSize: 18, minWidth: '40%', maxWidth: '100%' }}>
                    {val}
                </Text>
                <Text>
                    {title}
                </Text>
            </View>


        </View>
    )
}

export default AdminDataCard

const styles = StyleSheet.create({
    adminCardDataContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        // paddingVertical: 30,w
        paddingHorizontal: 30,
        padding: 10,
        marginBottom: 30,
        backgroundColor: '#ffffff',

        //Add shadow for android
        elevation: 10,

        // Add shadow properties for shadow on iOS
        shadowColor: 'black',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
})