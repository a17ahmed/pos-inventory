import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { NativeBaseProvider, useToast } from "native-base";

import React, { useRef, useEffect, useCallback } from "react";

import { StyleSheet, BackHandler } from 'react-native';

// Auth event listener for forced logout on token expiry
import { authEvents } from './services/authEvents';
import { disconnectSocket } from './services/socket';

// Business Context Provider
import { BusinessProvider } from './context/BusinessContext';

// Polyfill for deprecated BackHandler.removeEventListener (needed for native-base)
if (!BackHandler.removeEventListener) {
    BackHandler.removeEventListener = () => {
        // No-op - the new API uses subscription.remove() instead
        // This prevents crashes from libraries using the old API
    };
}

// Splash Screen (checks for existing session)
import SplashScreen from './screens/SplashScreen';

// Auth Screens
import { LoginScreen, CounterUserLoginScreen, ChangePasswordScreen } from './screens/auth';

// Onboarding Screens
import {
    WelcomeScreen,
    BusinessTypeScreen,
    BusinessDetailsScreen,
    CreateAccountScreen
} from './screens/onboarding';

// Main App Screens
import EmployeeTabNavigator from './users/employee/employeeDrawer/EmployeeTabNavigator';
import AdminTabNavigator from './users/admin/adminDrawer/AdminTabNavigator';

// Password Recovery
import EmailValidation from './users/admin/forgetPassword/emailValidation';
import NewPassword from './users/admin/forgetPassword/newPassword';
import OTPVerificationScreen from './users/admin/forgetPassword/otpVerification';

const Stack = createNativeStackNavigator();

function AppContent() {
    const navigationRef = useRef(null);
    const toast = useToast();

    const handleAuthEvent = useCallback((event) => {
        // Disconnect socket on logout
        disconnectSocket();

        // Show appropriate message
        if (event.type === 'SESSION_EXPIRED') {
            toast.show({
                description: "Session expired. Please log in again.",
                placement: "top",
                duration: 3000,
            });
        }

        // Navigate to login screen
        if (navigationRef.current) {
            navigationRef.current.reset({
                index: 0,
                routes: [{ name: 'Login' }],
            });
        }
    }, [toast]);

    useEffect(() => {
        const unsubscribe = authEvents.subscribe(handleAuthEvent);
        return unsubscribe;
    }, [handleAuthEvent]);

    return (
        <NavigationContainer ref={navigationRef}>
            <Stack.Navigator
                initialRouteName="Splash"
                screenOptions={{ headerShown: false }}
            >
                {/* Splash Screen - checks for existing session */}
                <Stack.Screen
                    name="Splash"
                    component={SplashScreen}
                />

                {/* Onboarding Flow */}
                <Stack.Screen
                    name="Welcome"
                    component={WelcomeScreen}
                />
                <Stack.Screen
                    name="BusinessType"
                    component={BusinessTypeScreen}
                />
                <Stack.Screen
                    name="BusinessDetails"
                    component={BusinessDetailsScreen}
                />
                <Stack.Screen
                    name="CreateAccount"
                    component={CreateAccountScreen}
                />

                {/* Auth Screens */}
                <Stack.Screen
                    name="Login"
                    component={LoginScreen}
                />
                <Stack.Screen
                    name="EmployeeLogin"
                    component={CounterUserLoginScreen}
                />
                {/* Keep old name for backward compatibility */}
                <Stack.Screen
                    name="CounterUserLogin"
                    component={CounterUserLoginScreen}
                />
                <Stack.Screen
                    name="ChangePassword"
                    component={ChangePasswordScreen}
                />
                <Stack.Screen
                    name="EmailValidation"
                    component={EmailValidation}
                />
                <Stack.Screen
                    name="OTPVerificationScreen"
                    component={OTPVerificationScreen}
                />
                <Stack.Screen
                    name="NewPassword"
                    component={NewPassword}
                />

                {/* Main App Screens */}
                <Stack.Screen
                    name="EmployeeDrawer"
                    component={EmployeeTabNavigator}
                />
                {/* Keep old name for backward compatibility */}
                <Stack.Screen
                    name="UserDrawer"
                    component={EmployeeTabNavigator}
                />
                <Stack.Screen
                    name="AdminDrawer"
                    component={AdminTabNavigator}
                />
            </Stack.Navigator>
        </NavigationContainer>
    );
}

export default function App() {
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
                <NativeBaseProvider>
                    <BusinessProvider>
                        <AppContent />
                    </BusinessProvider>
                </NativeBaseProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
});
