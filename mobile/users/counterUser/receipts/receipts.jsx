import { StyleSheet, Text, View } from 'react-native'
import React from 'react'
import ReceiptsList from './receiptsLists/receiptsList'

const Receipts = () => {
    return (
        <View style={styles.container}>
            <ReceiptsList />
        </View>
    )
}

export default Receipts

const styles = StyleSheet.create({
    container:{
        flex:1,
    }
})