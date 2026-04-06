import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing, borderRadius, shadows } from '../../constants/theme';

const StatCard = ({
    title,
    value,
    icon,
    color = colors.primary,
    secondaryColor,
    trend,
    trendValue,
    onPress,
    style
}) => {
    const gradientColors = secondaryColor
        ? [color, secondaryColor]
        : [color, color];

    const renderContent = () => (
        <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradient}
        >
            <View style={styles.iconContainer}>
                <MaterialIcons name={icon} size={28} color="rgba(255,255,255,0.9)" />
            </View>

            <View style={styles.content}>
                <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
                <Text style={styles.title} numberOfLines={1}>{title}</Text>

                {trend && (
                    <View style={styles.trendContainer}>
                        <MaterialIcons
                            name={trend === 'up' ? 'trending-up' : 'trending-down'}
                            size={16}
                            color={trend === 'up' ? '#4ade80' : '#f87171'}
                        />
                        <Text style={[
                            styles.trendValue,
                            { color: trend === 'up' ? '#4ade80' : '#f87171' }
                        ]}>
                            {trendValue}
                        </Text>
                    </View>
                )}
            </View>
        </LinearGradient>
    );

    if (onPress) {
        return (
            <Pressable
                style={({ pressed }) => [
                    styles.container,
                    style,
                    pressed && { transform: [{ scale: 0.97 }] }
                ]}
                onPress={onPress}
            >
                {renderContent()}
            </Pressable>
        );
    }

    return (
        <View style={[styles.container, style]}>
            {renderContent()}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: borderRadius.xl,
        overflow: 'hidden',
        ...shadows.lg,
    },
    gradient: {
        padding: spacing.lg,
        minHeight: 140,
    },
    iconContainer: {
        width: 50,
        height: 50,
        borderRadius: borderRadius.md,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.md,
    },
    content: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    value: {
        fontSize: 28,
        fontWeight: 'bold',
        color: colors.textWhite,
        marginBottom: 4,
        minHeight: 34,
    },
    title: {
        fontSize: typography.bodySmall.fontSize,
        color: 'rgba(255, 255, 255, 0.85)',
        fontWeight: '500',
    },
    trendContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.sm,
        gap: 4,
    },
    trendValue: {
        fontSize: typography.caption.fontSize,
        fontWeight: '600',
    },
});

export default StatCard;
