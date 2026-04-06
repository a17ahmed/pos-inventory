import React from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useToast } from "native-base";
import { MaterialIcons } from '@expo/vector-icons';
import { DrawerContentScrollView, DrawerItemList } from "@react-navigation/drawer";

const EmployeeCustomDrawer = (props) => {
    const toast = useToast();

    const { employeeData, businessData, businessType } = props;

    // Get gradient colors based on business type
    const getGradientColors = () => {
        switch (businessType) {
            case 'service':
                return ['#06b6d4', '#0891b2']; // Cyan
            case 'retail':
                return ['#8b5cf6', '#7c3aed']; // Purple
            default:
                return ['#f97316', '#ea580c']; // Orange
        }
    };

    // Get business type icon
    const getBusinessIcon = () => {
        switch (businessType) {
            case 'service':
                return 'content-cut';
            case 'retail':
                return 'shopping-cart';
            default:
                return 'restaurant';
        }
    };

    // Get business type label
    const getBusinessLabel = () => {
        switch (businessType) {
            case 'service':
                return 'Service Staff';
            case 'retail':
                return 'Sales Associate';
            default:
                return 'Order Staff';
        }
    };

    const handleSignOut = async () => {
        try {
            await AsyncStorage.multiRemove([
                'token',
                'employee',
                'counterUser',
                'business',
                'admin'
            ]);

            props.navigation.reset({
                index: 0,
                routes: [{ name: 'EmployeeLogin' }],
            });

            toast.show({
                description: "Signed out successfully",
                placement: "top",
                duration: 2000,
            });
        } catch (error) {
            console.error('Error signing out:', error);
            toast.show({
                description: "Error signing out",
                status: "error"
            });
        }
    };

    return (
        <View style={styles.container}>
            <DrawerContentScrollView
                {...props}
                contentContainerStyle={styles.scrollContent}
            >
                {/* Header with gradient */}
                <LinearGradient
                    colors={getGradientColors()}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.header}
                >
                    {/* Avatar */}
                    <View style={styles.avatarContainer}>
                        <MaterialIcons name="person" size={40} color={getGradientColors()[0]} />
                    </View>

                    {/* Welcome */}
                    <Text style={styles.welcomeText}>Welcome!</Text>
                    <Text style={styles.userName}>
                        {employeeData?.name?.toUpperCase() || 'EMPLOYEE'}
                    </Text>

                    {/* Employee ID Badge */}
                    <View style={styles.idBadge}>
                        <MaterialIcons name="badge" size={14} color="rgba(255,255,255,0.9)" />
                        <Text style={styles.idText}>{employeeData?.employeeId || ''}</Text>
                    </View>

                    {/* Role Badge */}
                    <View style={styles.roleBadge}>
                        <MaterialIcons name={getBusinessIcon()} size={14} color="rgba(255,255,255,0.9)" />
                        <Text style={styles.roleText}>{getBusinessLabel()}</Text>
                    </View>

                    {/* Business Name */}
                    {businessData?.name && (
                        <View style={styles.businessInfo}>
                            <MaterialIcons name="store" size={14} color="rgba(255,255,255,0.7)" />
                            <Text style={styles.businessName}>{businessData.name}</Text>
                        </View>
                    )}
                </LinearGradient>

                {/* Navigation Items */}
                <View style={styles.drawerItems}>
                    <DrawerItemList {...props} />
                </View>
            </DrawerContentScrollView>

            {/* Footer */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={styles.signOutButton}
                    onPress={handleSignOut}
                >
                    <MaterialIcons name="logout" size={20} color="#ef4444" />
                    <Text style={styles.signOutText}>Sign Out</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

export default EmployeeCustomDrawer;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    scrollContent: {
        paddingTop: 0,
    },
    header: {
        padding: 20,
        paddingTop: 50,
        paddingBottom: 24,
    },
    avatarContainer: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 8,
    },
    welcomeText: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.8)',
    },
    userName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 10,
    },
    idBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        alignSelf: 'flex-start',
        gap: 6,
        marginBottom: 6,
    },
    idText: {
        fontSize: 12,
        color: '#fff',
        fontWeight: '500',
    },
    roleBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        alignSelf: 'flex-start',
        gap: 6,
        marginBottom: 8,
    },
    roleText: {
        fontSize: 12,
        color: '#fff',
        fontWeight: '500',
    },
    businessInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    businessName: {
        fontSize: 13,
        color: 'rgba(255, 255, 255, 0.7)',
    },
    drawerItems: {
        flex: 1,
        paddingTop: 8,
    },
    footer: {
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
        padding: 16,
    },
    signOutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        gap: 10,
    },
    signOutText: {
        fontSize: 15,
        color: '#ef4444',
        fontWeight: '500',
    },
});
