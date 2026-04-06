import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ExpenseListScreen from './ExpenseListScreen';
import AddExpenseScreen from './AddExpenseScreen';
import ExpenseDetailScreen from './ExpenseDetailScreen';

const Stack = createNativeStackNavigator();

const ExpenseNavigation = () => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="ExpenseList" component={ExpenseListScreen} />
            <Stack.Screen name="AddExpense" component={AddExpenseScreen} />
            <Stack.Screen name="ExpenseDetail" component={ExpenseDetailScreen} />
        </Stack.Navigator>
    );
};

export default ExpenseNavigation;
