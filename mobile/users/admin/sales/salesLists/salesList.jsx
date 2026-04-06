import Constants from "expo-constants";

import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  Alert,
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
} from "react-native";
import { useToast } from "native-base";
import React, { useState, useEffect, useCallback } from "react";
import SalesListCard from "./salesListCard";
import axios from "axios";
import { useFocusEffect } from "@react-navigation/native";
import { Button, Icon } from "native-base";
import { AntDesign, Ionicons } from "@expo/vector-icons";
import * as Print from "expo-print";
import { ActivityIndicator } from "react-native";

const SalesList = () => {
  const API_BASE_URL = Constants.expoConfig.extra.API_BASE_URL;

  //Get token from async storage
  const getToken = async () => {
    try {
      const token = await AsyncStorage.getItem(
        "token"
      ); /*To get Stored Token from async storage*/
      return token;
    } catch (error) {
      return null;
    }
  };

  const toast = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [receipts, setReceipts] = useState([]);
  const [filteredReceipts, setFilteredReceipts] = useState([]);

  // Pagination state
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalReceipts, setTotalReceipts] = useState(0);

  const getReceiptDataHandler = async () => {
    try {
      const token = await getToken();

      if (token) {
        setPage(1);
        setHasMore(true);
        const response = await axios.get(`${API_BASE_URL}/receipt?page=1&limit=30`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        // Handle both old (array) and new (object with receipts) response formats
        const data = response.data?.receipts || response.data || [];
        const pagination = response.data?.pagination;

        setReceipts(Array.isArray(data) ? data : []);

        if (pagination) {
          setHasMore(pagination.hasMore);
          setTotalReceipts(pagination.total);
        } else {
          setHasMore(data.length === 30);
        }

        setIsLoading(false);
      } else {
        return null;
      }
    } catch (error) {
      setIsLoading(false);
      return null;
    }
  };

  const loadMoreReceipts = async () => {
    if (!isLoadingMore && hasMore) {
      setIsLoadingMore(true);
      try {
        const token = await getToken();
        if (!token) return;

        const nextPage = page + 1;
        const response = await axios.get(`${API_BASE_URL}/receipt?page=${nextPage}&limit=30`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        // Handle both old (array) and new (object with receipts) response formats
        const data = response.data?.receipts || response.data || [];
        const pagination = response.data?.pagination;

        if (data.length === 0 || (pagination && !pagination.hasMore)) {
          setHasMore(false);
          toast.show({
            description: "No more receipts",
            placement: "top",
          });
        } else {
          const uniqueReceipts = data.filter((newReceipt) => {
            return !receipts.some(
              (existingReceipt) => existingReceipt._id === newReceipt._id
            );
          });

          setReceipts(prev => [...prev, ...uniqueReceipts]);
          setPage(nextPage);

          if (pagination) {
            setHasMore(pagination.hasMore);
          }
        }
      } catch (error) {
        console.log('Error loading more receipts:', error);
      } finally {
        setIsLoadingMore(false);
      }
    }
  };

  useEffect(() => {
    getReceiptDataHandler();
  }, []);

  // Use useFocusEffect to fetch data whenever the screen gains focus
  useFocusEffect(
    useCallback(() => {
      getReceiptDataHandler();
    }, [])
  );

  //TO PRINT
  const print = async (
    receiptsId,
    receiptsDate,
    receiptsTime,
    receiptsCashierName,
    receiptsCustomerName,
    receiptItems,
    receiptsPrice,
    receiptsGst,
    receiptsQuantity,
    receiptsCashGiven
  ) => {
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
                <p><strong>Invoice#:</strong> ${receiptsId}</p>
                <p> <strong>Date:</strong> ${receiptsDate}</p>
                <p> <strong>Time:</strong> ${receiptsTime}</p>
                <p> <strong>Cashier:</strong> ${receiptsCashierName}</p>
                <p> <strong>Customer:</strong> ${receiptsCustomerName}</p>
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
                    ${receiptItems
        .map(
          (item) => `
                    <tr class="item-row">
                        <td class="item-name">${item.name}</td>
                        <td class="item-qty">${item.qty}</td>
                        <td class="item-price">${item.price / item.qty}</td>
                        <td class="item-total">${item.price}</td>
                    </tr>
                    `
        )
        .join("")}
                </tbody>
            </table>
            <div class="total">
            <div class="total-item">
                <p><strong>Total Price:</strong></p>
                <p>${receiptsPrice} Rs</p>
            </div>
            <div class="total-item">
                <p><strong>Total GST:</strong></p>
                <p>${receiptsGst} Rs</p>
            </div>
            <div class="total-item">
                <p><strong>Total Quantity:</strong></p>
                <p>${receiptsQuantity}</p>
            </div>
            <!-- Border-top for "Cash Given" -->
            <div class="total-item">
                <p><strong>Cash Given:</strong></p>
                <p>${receiptsCashGiven} Rs</p>
            </div>
            <div class="total-item">
                <p><strong>Balance:</strong></p>
                <p>${receiptsCashGiven - receiptsPrice} Rs</p>
            </div>
        </div>
        <div class="footer">
        <p><strong>Software by: </strong>P2P clouds <br>phone No comer here</p>
        </div>
        </div>
    </body>
    </html>
    
`;

    toast.show({
      description: "Printing...",
      status: "success",
    });
    try {
      // Print the HTML string to the printer
      await Print.printAsync({
        html,
      });
    } catch (error) {
      return null;
    }
  };

  const printAll = async () => {
    const allReceipts = filteredReceipts;
    const receiptTableDetail = allReceipts
      ?.map((receipt) => {
        const receiptItems = receipt.items
          .map((item) => {
            return `
        <tr class="item-row">
          <td class="item-name">${item.name}</td>
          <td class="item-qty">${item.qty}</td>
          <td class="item-price">${item.price / item.qty}</td>
          <td class="item-total">${item.price}</td>
        </tr>
      `;
          })
          .join("");

        return `
    <div class="invoice">
      <div class="header">
        <h2>My Mart</h2>
        <h4>Address comes here</h4>
        <h4>phone no comes here</h4>
        <p>
          <strong>Bill Invoice</strong>
        </p>
      </div>
      <div class="invoice-details">
        <p>
          <strong>Invoice#:</strong> ${receipt.billNumber}
        </p>
        <p>
          <strong>Date:</strong> ${receipt.date}
        </p>
        <p>
          <strong>Time:</strong> ${receipt.time}
        </p>
        <p>
          <strong>Cashier:</strong> ${receipt.cashierName}
        </p>
        <p>
          <strong>Customer:</strong> ${receipt.customerName}
        </p>
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
        <tbody>${receiptItems}</tbody>
      </table>
      <div class="total">
        <div class="total-item">
          <p>
            <strong>Total Price:</strong>
          </p>
          <p>${receipt.totalBill} Rs</p>
        </div>
        <div class="total-item">
          <p>
            <strong>Total GST:</strong>
          </p>
          <p>${receipt.totalGST} Rs</p>
        </div>
        <div class="total-item">
          <p>
            <strong>Total Quantity:</strong>
          </p>
          <p>${receipt.totalQty}</p>
        </div>
        <div class="total-item">
          <p>
            <strong>Cash Given:</strong>
          </p>
          <p>${receipt.cashGiven} Rs</p>
        </div>
        <div class="total-item">
          <p>
            <strong>Balance:</strong>
          </p>
          <p>${receipt.cashGiven - receipt.totalBill} Rs</p>
        </div>
      </div>
      <div class="footer">
        <p>
          <strong>Software by: </strong>P2P clouds <br />
          phone No comes here
        </p>
      </div>
    </div>
  `;
      })
      .join("");
    const html = `
          <html>
          <head>
              <style>
                  body {
                      font-family: Arial, sans-serif;
                      padding: 20px;

                      width:100%;
                      height: 99vh;
                  }
                  .invoice {
                      border: 1px solid #ccc;
                      padding: 20px;
                      width: 300px;
                      margin: 40vh auto;
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
          ${receiptTableDetail}
          </body>
          </html>

      `;

    try {
      toast.show({
        description: "Printing...",
        status: "success",
      });
      // Print the HTML string to the printer
      await Print.printAsync({
        html,
      });
    } catch (error) {
      return null;
    }
  };

  const filterReceipts = () => {
    const filtered = receipts.filter((data) => {
      const billNumberMatch = (data.billNumber || '')
        .toString()
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

      const dateMatch = (data.date || '')
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

      const priceMatch = (data.totalBill || 0)
        .toString()
        .includes(searchQuery.toLowerCase());

      return billNumberMatch || dateMatch || priceMatch;
    });

    setFilteredReceipts(filtered);
  };

  useEffect(() => {
    filterReceipts(); // Initial filtering when receipts load
  }, [searchQuery, receipts]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="blue" />
        <Text>Loading data...</Text>
      </View>
    );
  }
  return (
    <View style={styles.container}>
      <View style={styles.btnContainer}>
        <Button
          leftIcon={<Icon as={Ionicons} name="download-outline" size="19" />}
          variant="outline"
          style={{ width: 110, marginBottom: 10, borderRadius: 5 }}
          onPress={printAll}
        >
          Download
        </Button>
      </View>
      <TextInput
        style={styles.searchInput}
        placeholder="Search by invoice# ,date ,price"
        onChangeText={(text) => setSearchQuery(text)}
        value={searchQuery}
      />
      <FlatList
        data={filteredReceipts}
        renderItem={({ item }) => {
          return <SalesListCard data={item} print={print} />;
        }}
        keyExtractor={(item) => item._id?.toString() || item.id?.toString()}
        onEndReached={loadMoreReceipts}
        onEndReachedThreshold={0.3}
        ListFooterComponent={() => {
          if (isLoadingMore) {
            return (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color="#6366f1" />
                <Text style={styles.footerText}>Loading more...</Text>
              </View>
            );
          }
          if (!hasMore && receipts.length > 0) {
            return (
              <Text style={styles.endText}>
                End of list ({totalReceipts || receipts.length} receipts)
              </Text>
            );
          }
          return null;
        }}
      />
    </View>
  );
};

export default SalesList;

const styles = StyleSheet.create({
  container: {
    marginTop: 10,
    alignItems: "center",
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  searchInput: {
    height: 40,
    borderColor: "gray",
    borderWidth: 1,
    paddingHorizontal: 10,
    marginBottom: 10,
    width: "90%",
    borderRadius: 5,
  },
  btnContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  footerLoader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  footerText: {
    color: "#64748b",
    fontSize: 14,
  },
  endText: {
    textAlign: "center",
    color: "#94a3b8",
    fontSize: 13,
    paddingVertical: 20,
  },
});
