import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  ActivityIndicator,
} from "react-native";
import React, { useState, useEffect } from "react";
import MenuListCard from "./menuListCard";
import api from "../../../../constants/api";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";

const MenuList = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [menuList, setMenuList] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [filteredMenuList, setFilteredMenuList] = useState([]);

  const getMenuDataHandler = async () => {
    try {
      const response = await api.get("/menu");
      setMenuList(response.data);
      setFilteredMenuList(response.data);
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
    }
  };

  //search
  const handleSearch = (text) => {

    const filteredItems = menuList.filter(
      (item) =>
        item.name?.toLowerCase().includes(text.toLowerCase()) ||
        item.price?.toString().includes(text)
    );

    setFilteredMenuList(filteredItems);
    setSearchText(text);
  };

  useEffect(() => {
    getMenuDataHandler();
  }, []);

  useFocusEffect(
    useCallback(() => {
      getMenuDataHandler();
    }, [])
  );

  if (isLoading) {
    return <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="blue" />
      <Text>Loading data...</Text>
    </View>
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search menu by name or price..."
        value={searchText}
        onChangeText={handleSearch}
      />
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="blue" />
          <Text>Loading data...</Text>
        </View>
      ) : filteredMenuList.length === 0 ? (
        <Text>No menu found</Text>
      ) : (
        <FlatList
          data={filteredMenuList}
          renderItem={({ item }) => {
            return <MenuListCard data={item} />;
          }}
          keyExtractor={(item) => (item._id || item.id || Math.random()).toString()}
        />
      )}
    </View>
  );
};

export default MenuList;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    marginTop: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  searchInput: {
    width: "90%",
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "gray",
    borderRadius: 5,
  },
});
