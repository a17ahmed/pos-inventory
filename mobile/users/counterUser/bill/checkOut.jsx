import { Button, Modal, Stack, FormControl, Input, useToast } from "native-base";

import { StyleSheet, Text, View, Alert } from 'react-native';

import React, { useState, useRef } from 'react';

import api from "../../../constants/api";

import * as Print from 'expo-print';

const CheckOut = ({ receiptItems, onModalClose, counterUserName }) => {

    const toast = useToast();
    const idempotencyKeyRef = useRef(`${Date.now()}-${Math.random().toString(36).slice(2, 11)}`);

    //MODAL PART START
    const [placement, setPlacement] = useState(undefined);
    const [open, setOpen] = useState(false);

    const [marginTop, setMarginTop] = useState("auto");

    const openModal = placement => {
        setOpen(true);
        setPlacement(placement);
    };

    const styles = {
        top: {
            marginBottom: "auto",
            marginTop: marginTop,
        },
    };

    // Event handlers for input focus and blur
    const handleInputFocus = () => {
        setMarginTop("10px"); // Change marginTop when input is focused
    };

    const handleInputBlur = () => {
        setMarginTop("auto"); // Reset marginTop when input is blurred
    };
    //MODAL PART END


    // Calculate total price from receiptItems
    const totalPrice = receiptItems.reduce((total, item) => total + item.price, 0);

    // Calculate total gst from receiptItems
    const totalGst = receiptItems.reduce((total, item) => total + parseInt(item.gst), 0);

    const totalPriceTotalGst = totalPrice + totalGst

    // Calculate total quantity from receiptItems
    const totalQty = receiptItems.reduce((total, item) => total + parseInt(item.qty), 0);

    const [checkOutDetails, setCheckOutDetails] = useState({ cashierName: counterUserName, customerName: "Walking Customer", cashGiven: "0" });

    const balance = parseInt(checkOutDetails.cashGiven) - totalPriceTotalGst;

    // date
    const currentDate = new Date();
    const day = currentDate.getDate();
    const monthIndex = currentDate.getMonth();
    const year = currentDate.getFullYear();
    const monthNames = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    const formattedDate = `${day}-${monthNames[monthIndex]}-${year}`;

    // time
    const hours = currentDate.getHours();
    const minutes = currentDate.getMinutes();
    const seconds = currentDate.getSeconds();
    const amPm = hours >= 12 ? 'PM' : 'AM';
    const formattedTime = `${hours % 12}:${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds} ${amPm}`;

    //Post Data in Db
    const receiptData = {
        items: receiptItems,
        cashierName: checkOutDetails.cashierName,
        customerName: checkOutDetails.customerName,
        date: formattedDate,
        time: formattedTime,
        totalBill: totalPriceTotalGst,
        totalGST: totalGst,
        totalQty: totalQty,
        cashGiven: checkOutDetails.cashGiven,
        idempotencyKey: idempotencyKeyRef.current,
    }

    //Print invoice
    const html = `
    <html>
    <head>
        <style>
            body {
                font-family: Arial, sans-serif;
                padding: 20px;
            }
            .invoice {
                border: 1px solid #ccc;
                padding: 20px;
                width: 300px;
                margin: 0 auto;
            }
            .header {
                text-align: center;   
            }
            .header h4,h2{
              margin: -3px;
              padding:3px;
            }
            .header p{
              border: 1px solid black;
              padding: 10px;
            }
            .invoice-details p{
                margin-top: -12px;
                
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 10px;
                margin-bottom: 25px;
            }
            td {
                padding: 8px;
                
            }
            th {
                background-color: #f2f2f2;
                border: 1px solid #ccc;
                padding: 8px;
                text-align: left;
            }
            .total p{
                margin-top: -12px;
            }
            .total {
              display: flex;
              flex-direction: column;
              align-items: flex-end; /* Align items to the right within the column */
          }
          
          .total-item {
              display: flex;
              justify-content: space-between; /* Create space between label and value */
              width: 100%;
          }
          
            .item-row {
                display: table-row;
            }
            .item-name,
            .item-qty,
            .item-price,
            .item-total{
                display: table-cell;
                padding-right: 20px;
            }
            .item-name{
              text-align:left
            }
            .item-qty{
              text-align: center;
            }
            .item-price{
              text-align: center;
            }
            .item-total{
              text-align:right
            }
            .footer{
            text-align: center;
            }
            
            /* Add border-top to .total-item for "Cash Given" */
            .total-item:nth-child(4) {
                border-top: 2px solid black;
                margin-top: -5px;
                padding-top: 15px;

            }
        </style>
    </head>
    <body>
        <div class="invoice">
            <div class="header">
                <h2>My Mart</h2>
                <h4>Address comes here</h4>
                <h4>phone no comes her</h4>
                <p><strong>Bill Invoice</strong></p>
            </div>
            <div class="invoice-details">
                <p><strong>Invoice#:</strong> ${randomBillNumber}</p>
                <p> <strong>Date:</strong> ${formattedDate}</p>
                <p> <strong>Time:</strong> ${formattedTime}</p>
                <p> <strong>Cashier:</strong> ${checkOutDetails.cashierName}</p>
                <p> <strong>Customer:</strong> ${checkOutDetails.customerName}</p>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Item</th>
                        <th>Qty</th>
                        <th>Price</th>
                        <th>total</th>
                    </tr>
                </thead>
                <tbody>
                    ${receiptItems.map(item => `
                    <tr class="item-row">
                        <td class="item-name">${item.name}</td>
                        <td class="item-qty">${item.qty}</td>
                        <td class="item-price">${item.price / item.qty}</td>
                        <td class="item-total">${item.price}</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
            <div class="total">
            <div class="total-item">
                <p><strong>Total Price:</strong></p>
                <p>${totalPrice} Rs</p>
            </div>
            <div class="total-item">
                <p><strong>Total GST:</strong></p>
                <p>${totalGst} Rs</p>
            </div>
            <div class="total-item">
                <p><strong>Total Quantity:</strong></p>
                <p>${totalQty}</p>
            </div>
            <!-- Border-top for "Cash Given" -->
            <div class="total-item">
                <p><strong>Cash Given:</strong></p>
                <p>${checkOutDetails.cashGiven} Rs</p>
            </div>
            <div class="total-item">
                <p><strong>Balance:</strong></p>
                <p>${balance} Rs</p>
            </div>
        </div>
        <div class="footer">
        <p><strong>Software by: </strong>P2P clouds <br>phone No comer here</p>
        </div>
        </div>
    </body>
    </html>
    
`;


    const printInvoice = async () => {
        try {
            // Print the HTML string to the printer
            await Print.printAsync({
                html,
            });
        } catch (error) {
            return null;
        }
    };


    //Save Data in DB
    const saveHandler = async () => {
        if (checkOutDetails.cashGiven === null || checkOutDetails.cashGiven <= 0) {
            Alert.alert('Cash Field is Empty!', 'Enter Amount in Cash Field');
        } else if (checkOutDetails.cashGiven < totalPriceTotalGst) {
            Alert.alert('Cash Filed Error!', 'Cash Amount can not be smaller then Bill');
        } else {
            try {
                await api.post('/receipt', receiptData);

                // Close the modal after successful data submission
                setOpen(false);

                //Clear menu List after closing the modal
                onModalClose();

                //Print
                printInvoice();

                //toast
                toast.show({
                    description: "Bill Saved & sent for Printing",
                    status: "success"
                });
            } catch (error) {
                toast.show({
                    description: "Error saving bill",
                    status: "error"
                });
            }
        }
    }

    return (
        <View>
            <Button onPress={() => openModal("top")} style={stylesS.btnContainer}>Checkout</Button>

            <Modal isOpen={open} safeAreaTop={true}>
                <Modal.Content maxWidth="500px" minWidth="320px" {...styles[placement]}>
                    <Modal.CloseButton onPress={() => { setOpen(false); onModalClose(); }} />

                    <Modal.Header>Check Out Bill</Modal.Header>

                    <Modal.Body>
                        <FormControl>
                            <FormControl.Label>Cashier Name</FormControl.Label>
                            <Input placeholder="Enter Cashier Name"
                                value={checkOutDetails.cashierName}
                                onFocus={handleInputFocus} // Handle input focus
                                onBlur={handleInputBlur}   // Handle input blur
                            />
                        </FormControl>
                        <FormControl mt="3">
                            <FormControl.Label>Customer Name</FormControl.Label>
                            <Input
                                placeholder="Enter Customer Name"
                                value={checkOutDetails.customerName}
                                onChangeText={(val) => setCheckOutDetails({ ...checkOutDetails, customerName: val })}
                                onFocus={handleInputFocus} // Handle input focus
                                onBlur={handleInputBlur}   // Handle input blur
                            />
                        </FormControl>
                        <FormControl mt="3">
                            <FormControl.Label>Amount to pay</FormControl.Label>
                            <Text>
                                {totalPriceTotalGst} Rs (including {totalGst} Rs GST)
                            </Text>
                        </FormControl>
                        <FormControl mt="3">
                            <FormControl.Label>Cash Given</FormControl.Label>
                            <Input
                                placeholder="Cash"
                                keyboardType='numeric'
                                value={checkOutDetails.cashGiven}
                                onChangeText={(val) => setCheckOutDetails({ ...checkOutDetails, cashGiven: val })}
                                onFocus={handleInputFocus} // Handle input focus
                                onBlur={handleInputBlur}   // Handle input blur
                            />
                        </FormControl>

                        <View style={{ marginTop: 10 }}>
                            <Text style={{ textAlign: "right" }}>Cash Back: {balance}</Text>
                        </View>
                    </Modal.Body>

                    <Modal.Footer>
                        <Button onPress={saveHandler} style={{ backgroundColor: "#0f53dc", }}>
                            Save&Print
                        </Button>
                    </Modal.Footer>
                </Modal.Content>
            </Modal>
        </View>
    )
}

export default CheckOut

const stylesS = StyleSheet.create({
    btnContainer: {
        marginTop: 10,
        backgroundColor: "#006851",
    },
})