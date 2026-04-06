import React, { useCallback } from 'react';
import { TouchableOpacity, StatusBar, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

// Shared employee components
import { AddEmployee, EditEmployee, EmployeeList } from '../../../components/employee';
import { EMPLOYEE_CONFIG } from '../../../constants/employeeConfig';

const Stack = createNativeStackNavigator();

// Retail business config (Counter User)
const retailConfig = EMPLOYEE_CONFIG.retail;

// Wrapper components to pass config
const CounterUserListScreen = (props) => <EmployeeList {...props} config={retailConfig} />;
const AddCounterUserScreen = (props) => <AddEmployee {...props} config={retailConfig} />;
const EditCounterUserScreen = (props) => <EditEmployee {...props} config={retailConfig} />;

const CounterUserNavigation = () => {
    // Ensure status bar is set when screen is focused
    useFocusEffect(
        useCallback(() => {
            StatusBar.setBarStyle('dark-content');
            return () => {};
        }, [])
    );

    return (
        <View style={{ flex: 1, backgroundColor: '#f3f4f6' }}>
            <StatusBar barStyle="dark-content" backgroundColor="#fff" />
            <Stack.Navigator
                screenOptions={{
                    headerStyle: {
                        backgroundColor: '#fff',
                    },
                    headerTintColor: '#1f2937',
                    headerTitleStyle: {
                        fontWeight: '600',
                    },
                    headerShadowVisible: true,
                }}
            >
            <Stack.Screen
                name="CounterUserList"
                component={CounterUserListScreen}
                options={({ navigation }) => ({
                    title: 'Counter Users',
                    headerLeft: () => (
                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            style={{ marginLeft: 4, marginRight: 12 }}
                        >
                            <Feather name="arrow-left" size={22} color="#1f2937" />
                        </TouchableOpacity>
                    ),
                    headerRight: () => (
                        <TouchableOpacity
                            onPress={() => navigation.navigate('AddEmployee')}
                            style={{ marginRight: 8 }}
                        >
                            <Feather name="user-plus" size={22} color="#0891b2" />
                        </TouchableOpacity>
                    ),
                })}
            />
            <Stack.Screen
                name="AddEmployee"
                component={AddCounterUserScreen}
                options={{
                    title: 'Add Counter User',
                }}
            />
            <Stack.Screen
                name="EditEmployee"
                component={EditCounterUserScreen}
                options={{
                    title: 'Edit Counter User',
                }}
            />
            </Stack.Navigator>
        </View>
    );
};

export default CounterUserNavigation;
