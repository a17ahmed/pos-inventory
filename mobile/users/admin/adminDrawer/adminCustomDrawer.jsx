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

import { colors, typography, spacing, borderRadius, getBusinessConfig } from '../../../constants/theme';

const AdminCustomDrawer = (props) => {
    const toast = useToast();

    const adminData = props.adminData;
    const businessData = props.businessData;

    // Get business type config
    const businessTypeCode = businessData?.businessType?.code || 'restaurant';
    const businessConfig = getBusinessConfig(businessTypeCode);

    const handleSignOut = async () => {
        try {
            // Clear ALL user-related data from AsyncStorage
            await AsyncStorage.multiRemove([
                'token',
                'admin',
                'business',
                'employee',
                'counterUser'
            ]);

            props.navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
            });

            toast.show({
                description: "Signed out successfully",
                placement: "top",
                duration: 2000,
            });
        } catch (error) {
            console.log('Error signing out:', error);
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
                    colors={[businessConfig.color.primary, businessConfig.color.secondary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.header}
                >
                    {/* Business Icon */}
                    <View style={styles.avatarContainer}>
                        <MaterialIcons
                            name={businessConfig.icon}
                            size={40}
                            color={businessConfig.color.primary}
                        />
                    </View>

                    {/* Business Info */}
                    <Text style={styles.businessName}>
                        {businessData?.name || 'Your Business'}
                    </Text>
                    <View style={styles.businessTypeTag}>
                        <Text style={styles.businessTypeText}>
                            {businessConfig.name}
                        </Text>
                    </View>

                    {/* Admin Info */}
                    <View style={styles.adminInfo}>
                        <MaterialIcons name="person" size={16} color="rgba(255,255,255,0.8)" />
                        <Text style={styles.adminName}>
                            {adminData?.name || 'Admin'}
                        </Text>
                    </View>
                    <Text style={styles.adminEmail}>
                        {adminData?.email || ''}
                    </Text>
                </LinearGradient>

                {/* Navigation Items */}
                <View style={styles.drawerItems}>
                    <DrawerItemList {...props} />
                </View>
            </DrawerContentScrollView>

            {/* Footer */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={styles.settingsButton}
                    onPress={() => {}}
                >
                    <MaterialIcons name="settings" size={20} color={colors.textSecondary} />
                    <Text style={styles.footerButtonText}>Settings</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.signOutButton}
                    onPress={handleSignOut}
                >
                    <MaterialIcons name="logout" size={20} color={colors.error} />
                    <Text style={styles.signOutText}>Sign Out</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

export default AdminCustomDrawer;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.white,
    },
    scrollContent: {
        paddingTop: 0,
    },
    header: {
        padding: spacing.lg,
        paddingTop: spacing.xxl,
        paddingBottom: spacing.xl,
    },
    avatarContainer: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: colors.white,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.md,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 8,
    },
    businessName: {
        fontSize: typography.h3.fontSize,
        fontWeight: 'bold',
        color: colors.textWhite,
        marginBottom: spacing.xs,
    },
    businessTypeTag: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
        alignSelf: 'flex-start',
        marginBottom: spacing.md,
    },
    businessTypeText: {
        fontSize: typography.caption.fontSize,
        fontWeight: '600',
        color: colors.textWhite,
    },
    adminInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    adminName: {
        fontSize: typography.body.fontSize,
        fontWeight: '500',
        color: colors.textWhite,
    },
    adminEmail: {
        fontSize: typography.bodySmall.fontSize,
        color: 'rgba(255, 255, 255, 0.7)',
        marginTop: 2,
    },
    drawerItems: {
        flex: 1,
        paddingTop: spacing.md,
    },
    footer: {
        borderTopWidth: 1,
        borderTopColor: colors.border,
        padding: spacing.md,
        gap: spacing.xs,
    },
    settingsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        gap: spacing.sm,
    },
    footerButtonText: {
        fontSize: typography.body.fontSize,
        color: colors.textSecondary,
    },
    signOutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        gap: spacing.sm,
    },
    signOutText: {
        fontSize: typography.body.fontSize,
        color: colors.error,
        fontWeight: '500',
    },
});
