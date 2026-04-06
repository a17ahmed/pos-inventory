import { View, useToast, Checkbox, Actionsheet, useDisclose } from "native-base";
import { StyleSheet, KeyboardAvoidingView, Platform, Alert, TextInput } from 'react-native';
import { MaterialIcons, Entypo, Feather } from '@expo/vector-icons';
import React, { useState, useEffect } from 'react';
import { TouchableOpacity, Text, ScrollView } from "react-native";
import api from "../../constants/api";
import { EMPLOYEE_ROLES, EMPLOYEE_STATUSES } from "../../constants/employeeConfig";

export default function AddEmployee({ navigation, config }) {
    const toast = useToast();

    // Get roles from config, fallback to default EMPLOYEE_ROLES
    const availableRoles = config?.roles?.length > 0 ? config.roles : EMPLOYEE_ROLES;
    const defaultRole = config?.defaultRole || "employee";

    const initialState = {
        name: "",
        phone: "",
        email: "",
        role: defaultRole,
        specializations: "",
        commissionRate: "0",
        status: "active",
    };

    const [employee, setEmployee] = useState(initialState);
    const [username, setUsername] = useState("");
    const [businessPrefix, setBusinessPrefix] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [requirePasswordChange, setRequirePasswordChange] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [idAvailable, setIdAvailable] = useState(null);
    const [checkingId, setCheckingId] = useState(false);

    const roleSheet = useDisclose();
    const statusSheet = useDisclose();

    const shouldShowField = (fieldName) => {
        return config?.showFields?.includes(fieldName) ?? true;
    };

    useEffect(() => {
        fetchBusinessPrefix();
    }, []);

    useEffect(() => {
        if (employee.name && !username) {
            const autoUsername = employee.name.toLowerCase().replace(/\s+/g, '');
            setUsername(autoUsername);
        }
    }, [employee.name]);

    useEffect(() => {
        if (username && businessPrefix) {
            const timer = setTimeout(() => {
                checkIdAvailability();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [username, businessPrefix]);

    const fetchBusinessPrefix = async () => {
        try {
            const response = await api.get('/employee/prefix');
            setBusinessPrefix(response.data.prefix);
        } catch (error) {
            console.error('Error fetching prefix:', error);
            setBusinessPrefix('emp@');
        }
    };

    const checkIdAvailability = async () => {
        if (!username) return;
        setCheckingId(true);
        try {
            const fullId = `${businessPrefix}${username}`;
            const response = await api.get(`/employee/check-id?employeeId=${fullId}`);
            setIdAvailable(response.data.available);
        } catch (error) {
            console.error('Error checking ID:', error);
            setIdAvailable(null);
        } finally {
            setCheckingId(false);
        }
    };

    const getFullEmployeeId = () => {
        return `${businessPrefix}${username}`.toLowerCase();
    };

    const addEmployeeToDb = async () => {
        if (!employee.name.trim()) {
            toast.show({ description: "Please enter name", status: "warning" });
            return;
        }
        if (!username.trim()) {
            toast.show({ description: "Please enter a username for Employee ID", status: "warning" });
            return;
        }
        if (!password || password.length < 4) {
            toast.show({ description: "Password must be at least 4 characters", status: "warning" });
            return;
        }
        if (idAvailable === false) {
            toast.show({ description: "Employee ID is already taken", status: "warning" });
            return;
        }

        setIsSubmitting(true);

        const employeeData = {
            ...employee,
            employeeId: getFullEmployeeId(),
            username: username,
            password: password,
            requirePasswordChange: requirePasswordChange,
            commissionRate: parseInt(employee.commissionRate) || 0,
            specializations: employee.specializations
                ? employee.specializations.split(',').map(s => s.trim()).filter(s => s)
                : [],
        };

        try {
            const response = await api.post('/employee', employeeData);
            const { employee: savedEmployee } = response.data;

            Alert.alert(
                `${config?.label || 'Employee'} Created!`,
                `Login Credentials:\n\nEmployee ID: ${savedEmployee.employeeId}\nPassword: ${password}\n\n${requirePasswordChange ? '(Password change required on first login)' : ''}\n\nPlease share these credentials.`,
                [{ text: 'OK' }]
            );

            setEmployee(initialState);
            setUsername("");
            setPassword("");
            setRequirePasswordChange(true);
            setIdAvailable(null);
            navigation.goBack();
        } catch (error) {
            if (error.response?.data?.suggestedId) {
                Alert.alert(
                    'ID Already Taken',
                    `Suggested: ${error.response.data.suggestedId}`,
                    [
                        { text: 'Cancel', style: 'cancel' },
                        {
                            text: 'Use Suggested',
                            onPress: () => {
                                const suggestedUsername = error.response.data.suggestedId.split('@')[1];
                                setUsername(suggestedUsername);
                            }
                        }
                    ]
                );
            } else {
                toast.show({
                    description: error.response?.data?.message || "Failed to add employee",
                    status: "error"
                });
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const getRoleLabel = () => availableRoles.find(r => r.value === employee.role)?.label || "Select role";
    const getStatusLabel = () => EMPLOYEE_STATUSES.find(s => s.value === employee.status)?.label || "Select status";

    const headerColor = config?.headerColor || "#06b6d4";
    const buttonColor = config?.buttonColor || "#06b6d4";

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
                        <MaterialIcons name="person-add" size={28} color={headerColor} />
                    </View>
                    <Text style={styles.headerTitle}>{config?.addTitle || "Add Employee"}</Text>
                    <Text style={styles.headerSubtitle}>Fill in the details below</Text>
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
                                onChangeText={(val) => {
                                    setEmployee({ ...employee, name: val });
                                    if (!username || username === employee.name.toLowerCase().replace(/\s+/g, '')) {
                                        setUsername(val.toLowerCase().replace(/\s+/g, ''));
                                    }
                                }}
                            />
                        </View>
                    </View>

                    {/* Employee ID */}
                    <View style={styles.inputWrapper}>
                        <Text style={styles.label}>Employee ID <Text style={styles.required}>*</Text></Text>
                        <View style={styles.employeeIdRow}>
                            <View style={styles.prefixBox}>
                                <Text style={styles.prefixText}>{businessPrefix}</Text>
                            </View>
                            <View style={[styles.inputContainer, styles.usernameContainer]}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="username"
                                    placeholderTextColor="#9ca3af"
                                    value={username}
                                    onChangeText={(val) => setUsername(val.toLowerCase().replace(/\s+/g, ''))}
                                    autoCapitalize="none"
                                />
                                {checkingId && <Text style={styles.checkingText}>...</Text>}
                                {!checkingId && idAvailable === true && username && (
                                    <MaterialIcons name="check-circle" size={20} color="#10b981" />
                                )}
                                {!checkingId && idAvailable === false && username && (
                                    <MaterialIcons name="cancel" size={20} color="#ef4444" />
                                )}
                            </View>
                        </View>
                        {idAvailable === false && (
                            <Text style={styles.errorText}>This ID is already taken</Text>
                        )}
                        {idAvailable === true && username && (
                            <Text style={styles.successText}>Available: {getFullEmployeeId()}</Text>
                        )}
                    </View>

                    {/* Password */}
                    <View style={styles.inputWrapper}>
                        <Text style={styles.label}>Password <Text style={styles.required}>*</Text></Text>
                        <View style={styles.inputContainer}>
                            <MaterialIcons name="lock" size={20} color="#9ca3af" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Set initial password"
                                placeholderTextColor="#9ca3af"
                                secureTextEntry={!showPassword}
                                value={password}
                                onChangeText={setPassword}
                            />
                            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                <Entypo
                                    name={showPassword ? "eye" : "eye-with-line"}
                                    size={20}
                                    color="#9ca3af"
                                />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Checkbox */}
                    <View style={styles.checkboxRow}>
                        <Checkbox
                            value="requireChange"
                            isChecked={requirePasswordChange}
                            onChange={() => setRequirePasswordChange(!requirePasswordChange)}
                            colorScheme="cyan"
                            size="sm"
                        >
                            <Text style={styles.checkboxLabel}>Require password change on first login</Text>
                        </Checkbox>
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

                {/* Submit Button */}
                <TouchableOpacity
                    style={[
                        styles.submitBtn,
                        { backgroundColor: buttonColor },
                        (isSubmitting || idAvailable === false) && styles.submitBtnDisabled
                    ]}
                    onPress={addEmployeeToDb}
                    disabled={isSubmitting || idAvailable === false}
                >
                    <MaterialIcons name="person-add" size={20} color="white" />
                    <Text style={styles.submitBtnText}>
                        {isSubmitting ? 'Creating...' : `Create ${config?.label || 'Employee'}`}
                    </Text>
                </TouchableOpacity>

                <View style={{ height: 32 }} />
            </ScrollView>

            {/* Role Actionsheet */}
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
                                <Text style={[styles.sheetItemText, employee.role === role.value && { color: headerColor, fontWeight: '600' }]}>
                                    {role.label}
                                </Text>
                                {employee.role === role.value && <MaterialIcons name="check" size={20} color={headerColor} />}
                            </View>
                        </Actionsheet.Item>
                    ))}
                </Actionsheet.Content>
            </Actionsheet>

            {/* Status Actionsheet */}
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
                                <Text style={[styles.sheetItemText, employee.status === status.value && { color: headerColor, fontWeight: '600' }]}>
                                    {status.label}
                                </Text>
                                {employee.status === status.value && <MaterialIcons name="check" size={20} color={headerColor} />}
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
    scrollView: {
        flex: 1,
    },
    content: {
        padding: 16,
    },
    header: {
        alignItems: 'center',
        marginBottom: 24,
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
    employeeIdRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    prefixBox: {
        backgroundColor: '#e2e8f0',
        paddingHorizontal: 14,
        height: 50,
        borderRadius: 12,
        justifyContent: 'center',
    },
    prefixText: {
        fontSize: 15,
        color: '#64748b',
        fontWeight: '500',
    },
    usernameContainer: {
        flex: 1,
    },
    checkingText: {
        color: '#64748b',
        fontSize: 14,
    },
    errorText: {
        fontSize: 12,
        color: '#ef4444',
        marginTop: 6,
    },
    successText: {
        fontSize: 12,
        color: '#10b981',
        marginTop: 6,
    },
    checkboxRow: {
        marginTop: 4,
    },
    checkboxLabel: {
        fontSize: 14,
        color: '#64748b',
        marginLeft: 8,
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
    hintText: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 6,
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
