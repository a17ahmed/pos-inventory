import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import api from '../../constants/api';
import EmployeeListCard from './EmployeeListCard';

export default function EmployeeList({ navigation, config }) {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchEmployees = async () => {
        try {
            const response = await api.get('/employee');
            setEmployees(response.data);
        } catch (error) {
            console.error('Error fetching employees:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchEmployees();
        }, [])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchEmployees();
    };

    const handleEdit = (employee) => {
        navigation.navigate('EditEmployee', { employeeId: employee._id });
    };

    const handleDelete = (employeeId) => {
        setEmployees(prev => prev.filter(e => e._id !== employeeId));
    };

    const headerColor = config?.headerColor || "#06b6d4";

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={headerColor} />
                <Text style={styles.loadingText}>Loading {config?.labelPlural || 'employees'}...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {employees.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <MaterialIcons name="person-off" size={64} color="#d1d5db" />
                    <Text style={styles.emptyTitle}>No {config?.labelPlural || 'Employees'} Yet</Text>
                    <Text style={styles.emptySubtitle}>
                        Add your first {config?.label?.toLowerCase() || 'employee'} to get started
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={employees}
                    keyExtractor={(item) => item._id}
                    renderItem={({ item }) => (
                        <EmployeeListCard
                            employee={item}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                            config={config}
                        />
                    )}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={headerColor}
                        />
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f3f4f6',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f3f4f6',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#6b7280',
    },
    listContent: {
        padding: 16,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#374151',
        marginTop: 16,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#6b7280',
        marginTop: 8,
        textAlign: 'center',
    },
});
