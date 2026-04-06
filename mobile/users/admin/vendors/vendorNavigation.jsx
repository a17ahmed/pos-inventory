import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import SupplyListScreen from './SupplyListScreen';
import AddSupplyScreen from './AddSupplyScreen';
import SupplyDetailScreen from './SupplyDetailScreen';
import AddVendorScreen from './AddVendorScreen';

const Stack = createNativeStackNavigator();

const VendorNavigation = () => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="SupplyList" component={SupplyListScreen} />
            <Stack.Screen name="AddSupply" component={AddSupplyScreen} />
            <Stack.Screen name="SupplyDetail" component={SupplyDetailScreen} />
            <Stack.Screen name="AddVendor" component={AddVendorScreen} />
        </Stack.Navigator>
    );
};

export default VendorNavigation;
