import Constants from 'expo-constants';

import axios from 'axios';
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useToast } from 'native-base';

const EmailValidationScreen = ({ navigation }) => {
  const API_BASE_URL = Constants.expoConfig.extra.API_BASE_URL;

  const toast = useToast();

  const [validEmail, setValidEmail] = useState("");

  const OTPVerificationAndNavigate = async () => {
    try {
      if (validEmail === "") {
        Alert.alert('Empty Field', 'Please fill in email field');
      } else {
        const response = await axios.post(`${API_BASE_URL}/adminAuth/forgot-password`, { email: validEmail });
        toast.show({
          description: "OTP SENT SUCCESSFULLY",
          status: "success"
        });
        navigation.navigate('OTPVerificationScreen', { email: validEmail });
      }
    } catch (error) {
      Alert.alert('Email Error', 'Email is not Valid');
    }
  }

  return (
    <View style={styles.container}>

      <View style={styles.headerContainer}>
        <Text style={styles.header}>
          Forget your password?
        </Text>
      </View>

      <View style={styles.text1Container}>
        <Text style={styles.text1}>
          {/* Please enter your email you use to sign in to app */}
          Please enter your login email
        </Text>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#ccc"
        value={validEmail} onChangeText={(val) => setValidEmail(val)} />

      <TouchableOpacity style={styles.button} onPress={OTPVerificationAndNavigate}>
        <Text style={styles.buttonText}>Request Password Reset</Text>
      </TouchableOpacity>

      <TouchableOpacity title="Login" style={styles.login_button} onPress={() => navigation.navigate('AdminLogin')}>
        <Text style={styles.backLogin_ButtonText}> Back to Log in </Text>
      </TouchableOpacity>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContainer: {
    marginBottom: 20,
    width: '90%',
    alignItems: 'center',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1d62ee',
    textAlign: 'center',
  },
  text1Container: {
    width: '90%',
    alignItems: 'center',
  },
  text1: {
    fontSize: 15,
    color: 'black',
    textAlign: 'center',
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
  button: {
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
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },

  backLogin_ButtonText: {
    color: '#1d62ee',
    marginTop: 10,
  },


});

export default EmailValidationScreen;
