import Constants from 'expo-constants';

import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, BackHandler, Platform } from 'react-native';

import { useToast } from 'native-base';

const NewPassword = ({ route, navigation }) => {
  const API_BASE_URL = Constants.expoConfig.extra.API_BASE_URL;

  const toast = useToast();

  const email = route.params.email;
  const enteredOtp = route.params.otp;

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleConfirmPress = async () => {
    if (newPassword === confirmPassword) {

      try {
        const response = await axios.post(`${API_BASE_URL}/adminAuth/reset-password`, { email: email, otp: enteredOtp, newPassword: confirmPassword });
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => {
          navigation.navigate('AdminLogin');
        }, 2000);
        toast.show({
          description: "Password Reset SUCCESSFULLY",
          status: "success"
        });
      } catch (error) {
        return null;
      }
    } else {
      Alert.alert('Empty Field', 'Please fill in all OTP fields');
      setNewPassword("");
      setConfirmPassword("");
      return; // Stop further processing
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Forgot Password</Text>
      <TextInput
        style={styles.input}
        placeholder="New Password"
        secureTextEntry
        value={newPassword}
        onChangeText={(text) => setNewPassword(text)}
      />
      <TextInput
        style={styles.input}
        placeholder="Confirm Password"
        secureTextEntry
        value={confirmPassword}
        onChangeText={(text) => setConfirmPassword(text)}
      />
      <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmPress}>
        <Text style={styles.confirmButtonText}>Confirm</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff', // Background color for the entire screen
  },
  header: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1d62ee',
    marginBottom: 20,
  },
  input: {
    width: '80%',
    height: 40,
    borderColor: '#1d62ee', // Input border color
    borderWidth: 1,
    borderRadius: 8,
    paddingLeft: 10,
    marginBottom: 10,
  },
  confirmButton: {
    backgroundColor: '#1d62ee', // Button background color
    borderRadius: 8,
    padding: 12,
  },
  confirmButtonText: {
    color: '#fff', // Button text color
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default NewPassword;