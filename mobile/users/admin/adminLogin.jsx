import Constants from 'expo-constants';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { StyleSheet, Text, View, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';

import React, { useState } from 'react'

import { Entypo } from '@expo/vector-icons';
import axios from 'axios';

export default function AdminLogin({ navigation }) {
    const API_BASE_URL = Constants.expoConfig.extra.API_BASE_URL;

    const [loading, setLoading] = useState(false); // Add loading state

    const [showPassword, setShowPassword] = useState(false);

    const togglePasswordVisibility = () => {
        setShowPassword(!showPassword);
    };

    const [adminEmail, setAdminEmail] = useState("");
    const [adminPwd, setAdminPwd] = useState("");

    const adminDashboardNavigate = async () => {
        try {
            if (adminEmail === "" || adminPwd === "") {
                Alert.alert('Validation Error', 'Please fill in both email and password fields.');
                return;
            } else {
                setLoading(true); // Show loading spinner

                const response = await axios.post(`${API_BASE_URL}/adminAuth/login`, {
                    email: adminEmail,
                    password: adminPwd,
                });
                if (response.status === 200 && response.data.token) {

                    await AsyncStorage.setItem('token', response.data.token);
                    await AsyncStorage.setItem('admin', JSON.stringify(response.data.admin));
                    await AsyncStorage.setItem('business', JSON.stringify(response.data.business));

                    navigation.navigate('AdminDrawer', { adminEmail: adminEmail });

                    setAdminEmail("");
                    setAdminPwd("");
                } else {
                    // Authentication failed
                    Alert.alert('Authentication Error', 'Email or Password is Incorrect');
                }
            }

        } catch (error) {
            // Handle any network or server errors here
            Alert.alert('Error', 'Wrong Email or Password');
        } finally {
            setLoading(false); // Hide loading spinner
        }
    };

    return (
        <View style={styles.container}>

            {/* ADMIN-login-input-fields */}

            <Text style={styles.adminLoginHead}>Admin Login</Text>

            <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#ccc"
                value={adminEmail} onChangeText={(val) => setAdminEmail(val)}
            />

            <View style={styles.passwordContainer}>
                <TextInput
                    style={styles.passwordInput}
                    placeholder="Password"
                    placeholderTextColor="#ccc"
                    secureTextEntry={!showPassword}
                    value={adminPwd} onChangeText={(val) => setAdminPwd(val)}
                />

                <TouchableOpacity onPress={togglePasswordVisibility} style={styles.eyeIcon}>
                    <Entypo name={showPassword ? "eye" : "eye-with-line"} size={20} color="#1d62ee" />
                </TouchableOpacity>
            </View>

            <TouchableOpacity title="Forget Password" onPress={() => navigation.navigate('EmailValidation')} >
                <Text style={styles.forgetButton}>Forget Password?</Text>
            </TouchableOpacity>

            <TouchableOpacity title="Login" style={styles.loginButton} onPress={adminDashboardNavigate}>
                {loading ?
                    <ActivityIndicator size="large" color="white" /> // Show spinner while logging
                    :
                    <Text style={styles.loginButtonText}>Log in</Text>
                }
            </TouchableOpacity>
        </View >
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',

    },

    adminLoginHead: {
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

    forgetButton: {
        color: '#1d62ee',
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

})