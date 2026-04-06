import React from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    Image
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useToast } from "native-base";
import { MaterialIcons } from '@expo/vector-icons';
import { DrawerContentScrollView, DrawerItemList } from "@react-navigation/drawer";

const UserCustomDrawer = (props) => {
    const toast = useToast();

    const employeeData = props.employeeData;
    const businessData = props.businessData;

    const handleSignOut = async () => {
        try {
            // Clear ALL user-related data from AsyncStorage
            await AsyncStorage.multiRemove([
                'token',
                'employee',
                'counterUser',
                'business',
                'admin'
            ]);

            // Navigate back to login screen with reset
            props.navigation.reset({
                index: 0,
                routes: [{ name: 'CounterUserLogin' }],
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
                    colors={['#1d62ee', '#3b82f6']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.header}
                >
                    {/* User Avatar */}
                    <View style={styles.avatarContainer}>
                        <MaterialIcons name="person" size={40} color="#1d62ee" />
                    </View>

                    {/* Welcome Text */}
                    <Text style={styles.welcomeText}>
                        Welcome!
                    </Text>
                    <Text style={styles.userName}>
                        {employeeData?.name?.toUpperCase() || 'USER'}
                    </Text>

                    {/* Employee ID Badge */}
                    <View style={styles.idBadge}>
                        <MaterialIcons name="badge" size={14} color="rgba(255,255,255,0.8)" />
                        <Text style={styles.idText}>
                            {employeeData?.employeeId || ''}
                        </Text>
                    </View>

                    {/* Business Name */}
                    {businessData?.name && (
                        <View style={styles.businessInfo}>
                            <MaterialIcons name="store" size={14} color="rgba(255,255,255,0.7)" />
                            <Text style={styles.businessName}>
                                {businessData.name}
                            </Text>
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

export default UserCustomDrawer;

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
        fontSize: 22,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 8,
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
        marginBottom: 8,
    },
    idText: {
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
