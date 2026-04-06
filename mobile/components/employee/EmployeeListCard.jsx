import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import api from '../../constants/api';

const getStatusColor = (status) => {
    switch (status) {
        case 'active': return '#10b981';
        case 'inactive': return '#ef4444';
        case 'on_leave': return '#f59e0b';
        default: return '#6b7280';
    }
};

const getStatusLabel = (status) => {
    switch (status) {
        case 'active': return 'Active';
        case 'inactive': return 'Inactive';
        case 'on_leave': return 'On Leave';
        default: return status;
    }
};

const getRoleLabel = (role) => {
    switch (role) {
        case 'employee': return 'Employee';
        case 'senior': return 'Senior';
        case 'manager': return 'Manager';
        default: return role;
    }
};

export default function EmployeeListCard({ employee, onEdit, onDelete, config }) {
    const showRole = config?.listFields?.includes('role');
    const showPhone = config?.listFields?.includes('phone');

    const handleDelete = () => {
        Alert.alert(
            'Delete Employee',
            `Are you sure you want to delete ${employee.name}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.delete(`/employee/${employee._id}`);
                            if (onDelete) onDelete(employee._id);
                        } catch (error) {
                            console.error('Error deleting employee:', error);
                            Alert.alert('Error', 'Failed to delete employee');
                        }
                    }
                }
            ]
        );
    };

    return (
        <View style={styles.card}>
            <View style={styles.leftSection}>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                        {employee.name?.charAt(0)?.toUpperCase() || 'E'}
                    </Text>
                </View>

                <View style={styles.info}>
                    <Text style={styles.name}>{employee.name}</Text>
                    <Text style={styles.employeeId}>{employee.employeeId}</Text>

                    <View style={styles.tagsRow}>
                        {showRole && (
                            <View style={styles.roleTag}>
                                <Text style={styles.roleText}>{getRoleLabel(employee.role)}</Text>
                            </View>
                        )}
                        <View style={[styles.statusTag, { backgroundColor: getStatusColor(employee.status) + '20' }]}>
                            <View style={[styles.statusDot, { backgroundColor: getStatusColor(employee.status) }]} />
                            <Text style={[styles.statusText, { color: getStatusColor(employee.status) }]}>
                                {getStatusLabel(employee.status)}
                            </Text>
                        </View>
                    </View>

                    {showPhone && employee.phone && (
                        <View style={styles.phoneRow}>
                            <Feather name="phone" size={12} color="#6b7280" />
                            <Text style={styles.phoneText}>{employee.phone}</Text>
                        </View>
                    )}
                </View>
            </View>

            <View style={styles.actions}>
                <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => onEdit && onEdit(employee)}
                >
                    <MaterialIcons name="edit" size={18} color="#3b82f6" />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={handleDelete}
                >
                    <MaterialIcons name="delete" size={18} color="#ef4444" />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    leftSection: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#e0f2fe',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    avatarText: {
        fontSize: 20,
        fontWeight: '600',
        color: '#0284c7',
    },
    info: {
        flex: 1,
    },
    name: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: 2,
    },
    employeeId: {
        fontSize: 13,
        color: '#6b7280',
        marginBottom: 6,
    },
    tagsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    roleTag: {
        backgroundColor: '#f3f4f6',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    roleText: {
        fontSize: 11,
        color: '#4b5563',
        fontWeight: '500',
    },
    statusTag: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        gap: 4,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '500',
    },
    phoneRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 2,
    },
    phoneText: {
        fontSize: 12,
        color: '#6b7280',
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    editBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#eff6ff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    deleteBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#fef2f2',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
