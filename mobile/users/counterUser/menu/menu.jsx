import { StyleSheet, Text, View } from 'react-native'
import React from 'react'
import MenuList from './menuLists/menuList'

const Menu = () => {
    return (
        <View style={styles.container}>
            <MenuList />
        </View>
    )
}

export default Menu

const styles = StyleSheet.create({
    container:{
        flex: 1,
    }
})