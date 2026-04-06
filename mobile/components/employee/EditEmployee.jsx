import { View, useToast, Checkbox, Actionsheet, useDisclose } from "native-base";
import { StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, TextInput } from 'react-native';
import { MaterialIcons, Entypo } from '@expo/vector-icons';
import React, { useState, useEffect } from 'react';
import { TouchableOpacity, Text, ScrollView } from "react-native";
import api from "../../constants/api";
import { EMPLOYEE_ROLES, EMPLOYEE_STATUSES } from "../../constants/employeeConfig";

export default function EditEmployee({ navigation, route, config }) {
    const toast = useToast();
    const { employeeId } = route.params || {};

    const [employee, setEmployee] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Password reset state
    const [showResetPassword, setShowResetPassword] = useState(false);
    const [newPassword, setNewPassword] = useState("");
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [requirePasswordChange, setRequirePasswordChange] = useState(true);
    const [isResettingPassword, setIsResettingPassword] = useState(false);

    // Actionsheet controls
    const roleSheet = useDisclose();
    const statusSheet = useDisclose();

    // Check if field should be shown based on config
    const shouldShowField = (fieldName) => {
        return config?.showFields?.includes(fieldName) ?? true;
    };

    // Get available roles from config (business-type specific)
    const availableRoles = config?.roles?.length > 0 ? config.roles : EMPLOYEE_ROLES;

    useEffect(() => {
        if (employeeId) {
            fetchEmployee();
        }
    }, [employeeId]);

    const fetchEmployee = async () => {
        try {
            const response = await api.get(`/employee/${employeeId}`);
            const data = response.data;
            setEmployee({
                ...data,
                specializations: data.specializations?.join(', ') || '',
                commissionRate: String(data.commissionRate || 0)
            });
        } catch (error) {
            console.error('Error fetching employee:', error);
            toast.show({
                description: "Failed to load employee data",
                status: "error"
            });
        } finally {
            setLoading(false);
        }
    };

    const updateEmployee = async () => {
        if (!employee.name.trim()) {
            toast.show({
                description: "Please enter name",
                status: "warning"
            });
            return;
        }

        setIsSubmitting(true);

        const updateData = {
            name: employee.name,
            phone: employee.phone,
            email: employee.email,
            role: employee.role,
            status: employee.status,
            commissionRate: parseInt(employee.commissionRate) || 0,
            specializations: employee.specializations
                ? employee.specializations.split(',').map(s => s.trim()).filter(s => s)
                : [],
        };

        try {
            await api.patch(`/employee/${employeeId}`, updateData);

            toast.show({
                description: `${config?.label || 'Employee'} updated successfully`,
                status: "success"
            });

            navigation.goBack();
        } catch (error) {
            console.error('Error updating employee:', error);
            toast.show({
                description: error.response?.data?.message || "Failed to update",
                status: "error"
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetPassword = async () => {
        if (!newPassword || newPassword.length < 4) {
            toast.show({
                description: "Password must be at least 4 characters",
                status: "warning"
            });
            return;
        }

        setIsResettingPassword(true);

        try {
            await api.post(`/employee/${employeeId}/reset-password`, {
                newPassword: newPassword,
                requirePasswordChange: requirePasswordChange
            });

            Alert.alert(
                'Password Reset',
                `Password has been reset successfully.\n\nNew Password: ${newPassword}\n\n${requirePasswordChange ? '(Will be required to change on next login)' : ''}`,
                [{ text: 'OK' }]
            );

            setNewPassword("");
            setShowResetPassword(false);
            setRequirePasswordChange(true);
        } catch (error) {
            console.error('Error resetting password:', error);
            toast.show({
                description: error.response?.data?.message || "Failed to reset password",
                status: "error"
            });
        } finally {
            setIsResettingPassword(false);
        }
    };

    const getRoleLabel = () => availableRoles.find(r => r.value === employee?.role)?.label || "Select role";
    const getStatusLabel = () => EMPLOYEE_STATUSES.find(s => s.value === employee?.status)?.label || "Select status";

    const headerColor = config?.headerColor || "#06b6d4";
    const buttonColor = config?.buttonColor || "#06b6d4";

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={headerColor} />
                <Text style={styles.loadingText}>Loading...</Text>
            </View>
        );
    }

    if (!employee) {
        return (
            <View style={styles.loadingContainer}>
                <MaterialIcons name="error-outline" size={48} color="#ef4444" />
                <Text style={styles.errorText}>Employee not found</Text>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View style={[styles.headerIcon, { backgroundColor: headerColor + '15' }]}>
                        <MaterialIcons name="edit" size={28} color={headerColor} />
                    </View>
                    <Text style={styles.headerTitle}>{config?.editTitle || "Edit Employee"}</Text>
                    <Text style={styles.headerSubtitle}>Update details below</Text>
                </View>

                {/* Employee ID Badge */}
                <View style={styles.idBadge}>
                    <MaterialIcons name="badge" size={18} color="#64748b" />
                    <Text style={styles.idBadgeText}>ID: </Text>
                    <Text style={styles.idBadgeValue}>{employee.employeeId}</Text>
                </View>

                {/* Card 1: Basic Info */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Basic Information</Text>

                    {/* Name */}
                    <View style={styles.inputWrapper}>
                        <Text style={styles.label}>Full Name <Text style={styles.required}>*</Text></Text>
                        <View style={styles.inputContainer}>
                            <MaterialIcons name="person" size={20} color="#9ca3af" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Enter full name"
                                placeholderTextColor="#9ca3af"
                                value={employee.name}
                                onChangeText={(val) => setEmployee({ ...employee, name: val })}
                            />
                        </View>
                    </View>
                </View>

                {/* Card 2: Contact Info (Service businesses only) */}
                {(shouldShowField('phone') || shouldShowField('email')) && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Contact Information</Text>

                        {shouldShowField('phone') && (
                            <View style={styles.inputWrapper}>
                                <Text style={styles.label}>Phone Number</Text>
                                <View style={styles.inputContainer}>
                                    <MaterialIcons name="phone" size={20} color="#9ca3af" style={styles.inputIcon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Enter phone number"
                                        placeholderTextColor="#9ca3af"
                                        keyboardType="phone-pad"
                                        value={employee.phone}
                                        onChangeText={(val) => setEmployee({ ...employee, phone: val })}
                                    />
                                </View>
                            </View>
                        )}

                        {shouldShowField('email') && (
                            <View style={styles.inputWrapper}>
                                <Text style={styles.label}>Email Address</Text>
                                <View style={styles.inputContainer}>
                                    <MaterialIcons name="email" size={20} color="#9ca3af" style={styles.inputIcon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Enter email address"
                                        placeholderTextColor="#9ca3af"
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        value={employee.email}
                                        onChangeText={(val) => setEmployee({ ...employee, email: val.toLowerCase() })}
                                    />
                                </View>
                            </View>
                        )}
                    </View>
                )}

                {/* Card 3: Role & Status */}
                {(shouldShowField('role') || shouldShowField('status')) && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Role & Status</Text>

                        {shouldShowField('role') && (
                            <View style={styles.inputWrapper}>
                                <Text style={styles.label}>Role</Text>
                                <TouchableOpacity style={styles.selectContainer} onPress={roleSheet.onOpen}>
                                    <MaterialIcons name="work" size={20} color="#9ca3af" style={styles.inputIcon} />
                                    <Text style={styles.selectText}>{getRoleLabel()}</Text>
                                    <MaterialIcons name="keyboard-arrow-down" size={24} color="#9ca3af" />
                                </TouchableOpacity>
                            </View>
                        )}

                        {shouldShowField('status') && (
                            <View style={styles.inputWrapper}>
                                <Text style={styles.label}>Status</Text>
                                <TouchableOpacity style={styles.selectContainer} onPress={statusSheet.onOpen}>
                                    <MaterialIcons name="toggle-on" size={20} color="#9ca3af" style={styles.inputIcon} />
                                    <Text style={styles.selectText}>{getStatusLabel()}</Text>
                                    <MaterialIcons name="keyboard-arrow-down" size={24} color="#9ca3af" />
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                )}

                {/* Card 4: Skills (Service businesses only) */}
                {(shouldShowField('specializations') || shouldShowField('commissionRate')) && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Skills & Compensation</Text>

                        {shouldShowField('specializations') && (
                            <View style={styles.inputWrapper}>
                                <Text style={styles.label}>Specializations</Text>
                                <View style={styles.inputContainer}>
                                    <MaterialIcons name="star" size={20} color="#9ca3af" style={styles.inputIcon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="e.g., Haircut, Coloring, Styling"
                                        placeholderTextColor="#9ca3af"
                                        value={employee.specializations}
                                        onChangeText={(val) => setEmployee({ ...employee, specializations: val })}
                                    />
                                </View>
                                <Text style={styles.hintText}>Separate multiple skills with commas</Text>
                            </View>
                        )}

                        {shouldShowField('commissionRate') && (
                            <View style={styles.inputWrapper}>
                                <Text style={styles.label}>Commission Rate (%)</Text>
                                <View style={styles.inputContainer}>
                                    <MaterialIcons name="percent" size={20} color="#9ca3af" style={styles.inputIcon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="0"
                                        placeholderTextColor="#9ca3af"
                                        keyboardType="numeric"
                                        value={employee.commissionRate}
                                        onChangeText={(val) => setEmployee({ ...employee, commissionRate: val.replace(/[^0-9]/g, '') })}
                                    />
                                </View>
                            </View>
                        )}
                    </View>
                )}

                {/* Save Button */}
                <TouchableOpacity
                    style={[
                        styles.submitBtn,
                        { backgroundColor: buttonColor },
                        isSubmitting && styles.submitBtnDisabled
                    ]}
                    onPress={updateEmployee}
                    disabled={isSubmitting}
                >
                    <MaterialIcons name="save" size={20} color="white" />
                    <Text style={styles.submitBtnText}>
                        {isSubmitting ? 'Saving...' : 'Save Changes'}
                    </Text>
                </TouchableOpacity>

                {/* Reset Password Card */}
                <View style={styles.resetCard}>
                    <TouchableOpacity
                        style={styles.resetHeader}
                        onPress={() => setShowResetPassword(!showResetPassword)}
                        activeOpacity={0.7}
                    >
                        <View style={styles.resetHeaderLeft}>
                            <View style={styles.resetIconBg}>
                                <MaterialIcons name="lock-reset" size={20} color="#d97706" />
                            </View>
                            <Text style={styles.resetHeaderText}>Reset Password</Text>
                        </View>
                        <MaterialIcons
                            name={showResetPassword ? "keyboard-arrow-up" : "keyboard-arrow-down"}
                            size={24}
                            color="#d97706"
                        />
                    </TouchableOpacity>

                    {showResetPassword && (
                        <View style={styles.resetContent}>
                            <View style={styles.inputWrapper}>
                                <Text style={styles.label}>New Password</Text>
                                <View style={styles.inputContainer}>
                                    <MaterialIcons name="lock" size={20} color="#9ca3af" style={styles.inputIcon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Enter new password"
                                        placeholderTextColor="#9ca3af"
                                        secureTextEntry={!showNewPassword}
                                        value={newPassword}
                                        onChangeText={setNewPassword}
                                    />
                                    <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)}>
                                        <Entypo
                                            name={showNewPassword ? "eye" : "eye-with-line"}
                                            size={20}
                                            color="#9ca3af"
                                        />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={styles.checkboxRow}>
                                <Checkbox
                                    value="requireChange"
                                    isChecked={requirePasswordChange}
                                    onChange={() => setRequirePasswordChange(!requirePasswordChange)}
                                    colorScheme="warning"
                                    size="sm"
                                >
                                    <Text style={styles.checkboxLabel}>
                                        Require password change on next login
                                    </Text>
                                </Checkbox>
                            </View>

                            <TouchableOpacity
                                style={[styles.resetBtn, isResettingPassword && styles.submitBtnDisabled]}
                                onPress={resetPassword}
                                disabled={isResettingPassword}
                            >
                                <MaterialIcons name="lock-reset" size={18} color="white" />
                                <Text style={styles.resetBtnText}>
                                    {isResettingPassword ? 'Resetting...' : 'Reset Password'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                <View style={{ height: 32 }} />
            </ScrollView>

            {/* Role Selection Actionsheet */}
            <Actionsheet isOpen={roleSheet.isOpen} onClose={roleSheet.onClose}>
                <Actionsheet.Content>
                    <Text style={styles.sheetTitle}>Select Role</Text>
                    {availableRoles.map((role) => (
                        <Actionsheet.Item
                            key={role.value}
                            onPress={() => {
                                setEmployee({ ...employee, role: role.value });
                                roleSheet.onClose();
                            }}
                        >
                            <View style={styles.sheetItem}>
                                <Text style={[
                                    styles.sheetItemText,
                                    employee.role === role.value && { color: headerColor, fontWeight: '600' }
                                ]}>
                                    {role.label}
                                </Text>
                                {employee.role === role.value && (
                                    <MaterialIcons name="check" size={20} color={headerColor} />
                                )}
                            </View>
                        </Actionsheet.Item>
                    ))}
                </Actionsheet.Content>
            </Actionsheet>

            {/* Status Selection Actionsheet */}
            <Actionsheet isOpen={statusSheet.isOpen} onClose={statusSheet.onClose}>
                <Actionsheet.Content>
                    <Text style={styles.sheetTitle}>Select Status</Text>
                    {EMPLOYEE_STATUSES.map((status) => (
                        <Actionsheet.Item
                            key={status.value}
                            onPress={() => {
                                setEmployee({ ...employee, status: status.value });
                                statusSheet.onClose();
                            }}
                        >
                            <View style={styles.sheetItem}>
                                <Text style={[
                                    styles.sheetItemText,
                                    employee.status === status.value && { color: headerColor, fontWeight: '600' }
                                ]}>
                                    {status.label}
                                </Text>
                                {employee.status === status.value && (
                                    <MaterialIcons name="check" size={20} color={headerColor} />
                                )}
                            </View>
                        </Actionsheet.Item>
                    ))}
                </Actionsheet.Content>
            </Actionsheet>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        gap: 12,
    },
    loadingText: {
        fontSize: 16,
        color: '#64748b',
    },
    errorText: {
        fontSize: 16,
        color: '#ef4444',
        marginTop: 8,
    },
    scrollView: {
        flex: 1,
    },
    content: {
        padding: 16,
    },
    header: {
        alignItems: 'center',
        marginBottom: 16,
        paddingTop: 8,
    },
    headerIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 4,
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#64748b',
    },
    idBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'center',
        backgroundColor: '#e2e8f0',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        marginBottom: 20,
    },
    idBadgeText: {
        fontSize: 14,
        color: '#64748b',
        marginLeft: 8,
    },
    idBadgeValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1e293b',
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1e293b',
        marginBottom: 16,
    },
    inputWrapper: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: '#475569',
        marginBottom: 8,
    },
    required: {
        color: '#ef4444',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        paddingHorizontal: 14,
        height: 50,
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        fontSize: 15,
        color: '#1e293b',
    },
    hintText: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 6,
    },
    selectContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        paddingHorizontal: 14,
        height: 50,
    },
    selectText: {
        flex: 1,
        fontSize: 15,
        color: '#1e293b',
    },
    submitBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 54,
        borderRadius: 14,
        gap: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    submitBtnDisabled: {
        opacity: 0.6,
    },
    submitBtnText: {
        fontSize: 16,
        fontWeight: '600',
        color: 'white',
    },
    resetCard: {
        backgroundColor: '#fffbeb',
        borderRadius: 16,
        marginTop: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#fef3c7',
    },
    resetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
    },
    resetHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    resetIconBg: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#fef3c7',
        alignItems: 'center',
        justifyContent: 'center',
    },
    resetHeaderText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#d97706',
    },
    resetContent: {
        padding: 16,
        paddingTop: 0,
    },
    checkboxRow: {
        marginBottom: 16,
    },
    checkboxLabel: {
        fontSize: 14,
        color: '#64748b',
        marginLeft: 8,
    },
    resetBtn: {
        flexDirection: 'row',
        backgroundColor: '#d97706',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        height: 48,
        gap: 8,
    },
    resetBtnText: {
        fontSize: 15,
        color: 'white',
        fontWeight: '600',
    },
    sheetTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1e293b',
        marginVertical: 12,
    },
    sheetItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
    },
    sheetItemText: {
        fontSize: 16,
        color: '#475569',
    },
});
