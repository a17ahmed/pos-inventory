import Constants from 'expo-constants';

import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Keyboard, Alert } from 'react-native';

import axios from 'axios';

import { useToast } from 'native-base';


const OTPVerificationScreen = ({ route, navigation }) => {
  const email = route.params.email;

  const API_BASE_URL = Constants.expoConfig.extra.API_BASE_URL;

  const toast = useToast();

  const [otpStatusMessage, setOtpStatusMessage] = useState('');
  const otpInputs = Array(6).fill('');
  const otpInputRefs = otpInputs.map((_, index) => useRef(null));

  const focusNextInput = (index) => {
    if (index < otpInputs.length - 1) {
      otpInputRefs[index + 1].current.focus();
    } else if (index === otpInputs.length - 1) {
      // If this is the last OTP field, dismiss the keyboard
      Keyboard.dismiss();
    }
  };

  //RESEND OTP START
  const resendOtp = async () => {
    try {
      const response = await axios.post(`${API_BASE_URL}/adminAuth/forgot-password`, { email: email });
      toast.show({
        description: "OTP RESENT SUCCESSFULLY",
        status: "success"
      });

      // Clear all OTP input fields
      const otpInputs = Array(6).fill('');
      otpInputRefs.forEach((ref, index) => {
        ref.current.clear(); // Clear the TextInput
      });

    } catch (error) {
      Alert.alert('Email Error', 'Email is not Valid');
    }
  }
  //RESEND OTP END

  const handleVerify = async () => {

    // Check if any OTP input field is empty
    if (otpInputs.some((input) => input === '')) {
      Alert.alert('Empty Field', 'Please fill in all OTP fields');
    }

    // Combine OTP inputs into a single string for verification
    const enteredOtp = otpInputs.join('');

    //OTP verification
    try {
      const response = await axios.post(`${API_BASE_URL}/adminAuth/verifying-otp`, { email: email, otp: enteredOtp });
      if (response.status === 200) {
        setOtpStatusMessage('OTP Verified Successfully');
        //CLEAR OTP FIELDS
        otpInputRefs.forEach((ref, index) => {
          ref.current.clear(); // Clear the TextInput
        });
        navigation.navigate('NewPassword', { email: email, otp: enteredOtp });
      }
    } catch (error) {
      //CLEAR OTP FIELDS
      otpInputRefs.forEach((ref, index) => {
        ref.current.clear(); // Clear the TextInput
      });
      setOtpStatusMessage('Error verifying OTP');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>OTP Verification</Text>
      <View style={styles.otpContainer}>
        {otpInputs.map((value, index) => (
          <TextInput
            key={index}
            style={styles.otpBox}
            keyboardType="numeric"
            maxLength={1}
            onChangeText={(text) => {
              // Update the OTP input array
              const updatedOtpInputs = [...otpInputs];
              updatedOtpInputs[index] = text;
              otpInputs[index] = text;

              // Update the state and focus on the next input field
              focusNextInput(index);
            }}
            ref={otpInputRefs[index]} />
        ))}
      </View>

      <TouchableOpacity style={styles.verifyButton} onPress={handleVerify}>
        <Text style={styles.verifyButtonText}>Verify</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={resendOtp}>
        <Text style={styles.resendButtonText}>Resend OTP</Text>
      </TouchableOpacity>
      <Text style={styles.statusMessage}>{otpStatusMessage}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff', // You can change the background color
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  otpBox: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderColor: '#1d62ee',
    borderRadius: 8,
    fontSize: 20,
    textAlign: 'center',
    marginHorizontal: 5,
  },
  verifyButton: {
    marginTop: 20,
    backgroundColor: '#1d62ee',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  resendButtonText: {
    color: '#1d62ee',
    marginTop: '5%'
  },
  statusMessage: {
    color: '#1d62ee',
    fontSize: 20,
    marginTop: '5%'
  }

});

export default OTPVerificationScreen;
