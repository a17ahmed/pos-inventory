import { StyleSheet, Text, View, TouchableOpacity } from 'react-native'
import React from 'react'

import { FontAwesome5 } from '@expo/vector-icons';

const AdminNavbar = () => {
    return (
        <View style={styles.navBar}>
            <Text style={styles.navText}>
                Admin
            </Text>

            <TouchableOpacity>
                <View>
                    <Text>
                        <FontAwesome5 name="user-tie" size={24} color="white" />
                    </Text>
                </View>
            </TouchableOpacity>
        </View>
    )
}

export default AdminNavbar

const styles = StyleSheet.create({
    navBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 15,
        paddingVertical: 10,
        backgroundColor: '#1d62ee',
    },

    navText: {
        color: 'white',
        fontWeight: 'bold',
    },
})