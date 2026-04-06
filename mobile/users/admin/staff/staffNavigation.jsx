import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TouchableOpacity, StatusBar, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

// Shared employee components
import { AddEmployee, EditEmployee, EmployeeList } from '../../../components/employee';
import { EMPLOYEE_CONFIG } from '../../../constants/employeeConfig';

const Stack = createNativeStackNavigator();

const StaffNavigation = ({ businessType = 'service' }) => {
    // Get config based on business type
    const config = businessType === 'restaurant'
        ? EMPLOYEE_CONFIG.restaurant
        : EMPLOYEE_CONFIG.service;

    // Wrapper components to pass config
    const StaffListScreen = (props) => <EmployeeList {...props} config={config} />;
    const AddStaffScreen = (props) => <AddEmployee {...props} config={config} />;
    const EditStaffScreen = (props) => <EditEmployee {...props} config={config} />;

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
                name="StaffList"
                component={StaffListScreen}
                options={({ navigation }) => ({
                    title: config.labelPlural,
                    headerRight: () => (
                        <TouchableOpacity
                            onPress={() => navigation.navigate('AddEmployee')}
                            style={{ marginRight: 8 }}
                        >
                            <Feather name="user-plus" size={22} color={config.buttonColor} />
                        </TouchableOpacity>
                    ),
                })}
            />
            <Stack.Screen
                name="AddEmployee"
                component={AddStaffScreen}
                options={{
                    title: config.addTitle,
                }}
            />
            <Stack.Screen
                name="EditEmployee"
                component={EditStaffScreen}
                options={{
                    title: config.editTitle,
                }}
            />
            </Stack.Navigator>
        </View>
    );
};

export default StaffNavigation;
