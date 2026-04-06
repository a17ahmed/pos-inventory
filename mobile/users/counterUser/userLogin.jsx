import Constants from 'expo-constants';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { Text, View, StyleSheet, TextInput, TouchableOpacity, TouchableWithoutFeedback, Keyboard, Alert, ActivityIndicator } from 'react-native';
import React, { useEffect, useState } from 'react';

import { Entypo } from '@expo/vector-icons';
import axios from 'axios';

const UserLogin = ({ navigation }) => {
  const API_BASE_URL = Constants.expoConfig.extra.API_BASE_URL;

  const [loading, setLoading] = useState(false); // Add loading state

  const keyboardDismiss = () => {
    Keyboard.dismiss();
  };

  const [showPassword, setShowPassword] = useState(false);

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const [oderId, setOderId] = useState("");
  const [userPwd, setUserPwd] = useState("");
  const userDashboardNavigate = async () => {

    //LOGIN
    try {
      if (oderId === "" || userPwd === "") {
        Alert.alert('Validation Error', 'Please fill in both user-id and password fields.');
      } else {
        setLoading(true); // Show loading spinner

        const response = await axios.post(`${API_BASE_URL}/counterUserAuth/login`, {
          oderId: oderId.toUpperCase(),
          password: userPwd,
        });
        if (response.status === 200 && response.data.token) {

          await AsyncStorage.setItem('token', response.data.token);
          await AsyncStorage.setItem('counterUser', JSON.stringify(response.data.counterUser));
          await AsyncStorage.setItem('business', JSON.stringify(response.data.business));

          // Check if password change is required
          if (response.data.requirePasswordChange) {
            navigation.navigate('ChangePassword', {
              oderId: response.data.counterUser.oderId,
              currentPassword: userPwd
            });
          } else {
            navigation.navigate('UserDrawer', { oderId: oderId });
          }

          setOderId("");
          setUserPwd("");
        } else {
          // Authentication failed
          Alert.alert('Authentication Error', 'User-ID or Password is Incorrect');
        }
      }

    } catch (error) {
      // Handle any network or server errors here
      Alert.alert('Login Error', error.response?.data?.message || 'Wrong ID or Password');
    } finally {
      setLoading(false); // Hide loading spinner
    }
  };

  return (

    <TouchableWithoutFeedback onPress={keyboardDismiss}>

      <View style={styles.container}>

        {/* button-move-to-admin-login */}

        <View style={styles.adminBtnContainer}>

          <TouchableOpacity style={styles.adminBtn}

            onPress={() => navigation.navigate('AdminLogin')} >

            <Text style={styles.adminBtnText}>Admin Login</Text>

          </TouchableOpacity>

        </View>


        {/* login-input-fields */}

        <Text style={styles.loginHead}>LOGIN</Text>

        <TextInput
          style={styles.input}
          placeholder="User ID (e.g., SER001)"
          placeholderTextColor="#ccc"
          autoCapitalize="characters"
          value={oderId} onChangeText={(val) => setOderId(val.toUpperCase())}
        />

        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Password"
            placeholderTextColor="#ccc"
            secureTextEntry={!showPassword}
            value={userPwd} onChangeText={(val) => setUserPwd(val)}
          />

          <TouchableOpacity onPress={togglePasswordVisibility} style={styles.eyeIcon}>
            <Entypo name={showPassword ? "eye" : "eye-with-line"} size={20} color="#1d62ee" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity title="Login" style={styles.loginButton} onPress={userDashboardNavigate}>
          {loading ?
            <ActivityIndicator size="large" color="white" /> // Show spinner while logging
            :
            <Text style={styles.loginButtonText}>Log in</Text>
          }
        </TouchableOpacity>

      </View >
    </TouchableWithoutFeedback>
  );
};

export default UserLogin;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loginHead: {
    color: '#1d62ee',
    fontSize: 32,
    marginBottom: 40,
    fontWeight: 'bold'
  },

  input: {
    width: '80%',
    height: 50,
    borderColor: '#1d62ee',
    borderBottomWidth: 1,
    fontSize: 18,
    marginBottom: 20,
    paddingHorizontal: 10,

  },

  passwordContainer: {
    width: '80%',
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: "space-between",
    borderColor: '#1d62ee',
    borderBottomWidth: 1,
    marginBottom: 20,
    paddingHorizontal: 10,
  },

  passwordInput: {
    flex: 1,
    fontSize: 18,
  },

  eyeIcon: {
    padding: 10,
  },

  passwordToggle: {
    color: '#1d62ee',
    marginTop: 10,
  },

  loginButton: {
    width: '60%',
    height: 50,
    backgroundColor: '#007BFF',
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5, // Android shadow
    shadowColor: '#000', // iOS shadow
    shadowOffset: { width: 0, height: 2 }, // iOS shadow
    shadowOpacity: 0.2, // iOS shadow
    marginTop: 15
  },

  loginButtonText: {
    color: 'white',
    fontSize: 20,
  },

  adminBtnText: {
    color: '#007BFF',
    textAlign: "right",
    fontWeight: 'bold',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#007BFF',
    padding: 5,
    paddingHorizontal: 7,
    fontSize: 16
  },

  adminBtnContainer: {
    position: "absolute",
    top: 50,
    left: 20
  }

});
