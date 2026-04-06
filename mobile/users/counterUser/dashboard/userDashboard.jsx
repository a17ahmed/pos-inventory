import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View, Keyboard, FlatList, TouchableOpacity, } from "react-native";
import { Input, Box, Select, CheckIcon} from "native-base";
import Ionicons from "react-native-vector-icons/Ionicons";
import axios from "axios";
import CheckOut from '../bill/checkOut';
import { useFocusEffect } from '@react-navigation/native';
const UserDashboard = ({ employeeData, businessData }) => {
  const counterUserName = employeeData?.name || 'User';

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

  const [isCheckout, setIsCheckout] = useState(false);

  //Fetching Menu
  const [menuList, setMenuList] = useState([]);
  const getMenuDataHandler = async () => {
    try {
      const token = await getToken();

      if (token) {
        const response = await axios.get(`${API_BASE_URL}/menu`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        setMenuList(response.data);
      } else {
        return null;
      }
    }
    catch (error) {
      return null;
    }
  }

  useEffect(() => {
    getMenuDataHandler();
  }, []);

  // Use useFocusEffect to fetch data whenever the screen gains focus
  useFocusEffect(
    useCallback(() => {
      getMenuDataHandler();
    }, [])
  );


  const [name, setMenu] = useState("");
  const [qty, setQuantity] = useState("");
  const [selectedMenus, setSelectedMenus] = useState([]);


  const handleAddButtonClick = async () => {
    if (name && qty) {
      try {
        const token = await getToken();

        if (token) {
          const response = await axios.get(`${API_BASE_URL}/menu/name/${name}`, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          const menuItem = response.data;

          setSelectedMenus((prevMenus) => [...prevMenus, { category: menuItem.category, description: menuItem.description, name, qty, price: menuItem.price * qty, gst: menuItem.gst * qty }]);
          setMenu("");
          setQuantity("");

          setIsCheckout(true);

          // Dismiss the keyboard
          Keyboard.dismiss();
        } else {
          return null;
        }
      } catch (error) {
        return null;
      }
    }

  };

  const handleDeleteButton = (index) => {
    const updatedMenus = selectedMenus.filter((_, i) => i !== index);
    setSelectedMenus(updatedMenus);

    if (updatedMenus.length === 0) {
      setIsCheckout(false);
    }
  };

  const clearSelectedMenus = () => {
    setSelectedMenus([]);
    setIsCheckout(false);
  };

  return (
    <View style={styles.container}>

      <View style={{ paddingTop: 20 }}>
        <Box>
          <Select
            style={{ height: 50, fontSize: 17 }}
            selectedValue={name}
            minWidth={'85%'}
            accessibilityLabel="Choose Menu"
            placeholder="Choose Menu"
            _selectedItem={{
              bg: "teal.600",
              endIcon: <CheckIcon size={5} />,
            }}
            mt={1}
            onValueChange={(itemValue) => setMenu(itemValue)}>
            {menuList.map((menuItem) => (
              <Select.Item
                key={menuItem._id}
                label={menuItem.name}
                value={menuItem.name}
              />
            ))}
          </Select>
        </Box>
      </View>

      <View style={{ paddingTop: 20 }}>
        <Input
          style={{ fontSize: 17 }}
          placeholder="Quantity"
          w="85%"
          h={50}
          keyboardType="numeric"
          value={qty}
          onChangeText={setQuantity}
        />
      </View>

      <TouchableOpacity onPress={handleAddButtonClick} style={styles.addBtnContainer}>
        <View>
          <Text style={styles.btnText}>
            Add
          </Text>
        </View>
      </TouchableOpacity>

      {/* FlatList */}
      <View style={styles.flatListContainer}>
        <View style={styles.listHead}>
          <Text style={styles.listHeadText}>Items</Text>
          <Text style={styles.listHeadText}>Quantity</Text>
          <Text style={styles.listHeadText}>Remove</Text>
        </View>

        <FlatList
          data={selectedMenus}
          keyExtractor={(item, index) => index.toString()}
          renderItem={({ item, index }) => (
            <View style={styles.selectedMenuRow}>
              <View style={{ width: "40%" }}>
                <Text style={styles.listValue}>{item.name}</Text>
              </View>

              <View style={{ width: "30%" }}>
                <Text style={styles.listValue}>{item.qty}</Text>
              </View>

              <View style={{ width: "20%" }}>
                <TouchableOpacity onPress={() => handleDeleteButton(index)} style={styles.removeButton}>
                  <Ionicons name="remove-circle-sharp" size={22} color={"red"} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      </View>


      {/* FlatList */}

      {isCheckout && <CheckOut receiptItems={selectedMenus} onModalClose={clearSelectedMenus} counterUserName={counterUserName} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
  },

  addBtnContainer: {
    borderWidth: 1,
    padding: 12,
    margin: 15,
    width: "80%",
    borderRadius: 4,
    backgroundColor: "#006851",
    alignItems: 'center',
  },

  btnText: {
    color: '#ffffff',
  },

  flatListContainer: {
    height: '60%',
    width: '100%'
  },

  listHead: {
    flexDirection: "row",
    paddingVertical: 10,
    justifyContent: "space-between",
    borderBottomWidth: 1,
  },
  listHeadText: {
    marginLeft: 30,
    marginRight: 30,
  },

  selectedMenuRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    justifyContent: "space-between",
    backgroundColor: "rgb(204, 204, 204)",
  },

  listValue: {
    // flex: 1,
    // textAlign: "center",
  },

  removeButton: {
    marginLeft: 20,
  }
});

export default UserDashboard;