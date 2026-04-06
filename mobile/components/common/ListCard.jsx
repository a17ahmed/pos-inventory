import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows } from '../../constants/theme';

const ListCard = ({
    title,
    subtitle,
    leftIcon,
    leftIconColor = colors.primary,
    rightContent,
    onPress,
    onEdit,
    onDelete,
    style
}) => {
    const CardWrapper = onPress ? TouchableOpacity : View;

    return (
        <CardWrapper
            style={[styles.container, style]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            {leftIcon && (
                <View style={[styles.iconContainer, { backgroundColor: `${leftIconColor}15` }]}>
                    <MaterialIcons name={leftIcon} size={24} color={leftIconColor} />
                </View>
            )}

            <View style={styles.content}>
                <Text style={styles.title} numberOfLines={1}>{title}</Text>
                {subtitle && (
                    <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
                )}
            </View>

            {rightContent && (
                <View style={styles.rightContent}>
                    {rightContent}
                </View>
            )}

            {(onEdit || onDelete) && (
                <View style={styles.actions}>
                    {onEdit && (
                        <TouchableOpacity
                            style={[styles.actionButton, styles.editButton]}
                            onPress={onEdit}
                        >
                            <MaterialIcons name="edit" size={18} color={colors.primary} />
                        </TouchableOpacity>
                    )}
                    {onDelete && (
                        <TouchableOpacity
                            style={[styles.actionButton, styles.deleteButton]}
                            onPress={onDelete}
                        >
                            <MaterialIcons name="delete-outline" size={18} color={colors.error} />
                        </TouchableOpacity>
                    )}
                </View>
            )}
        </CardWrapper>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.white,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginBottom: spacing.sm,
        ...shadows.sm,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: borderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    content: {
        flex: 1,
    },
    title: {
        fontSize: typography.body.fontSize,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 2,
    },
    subtitle: {
        fontSize: typography.bodySmall.fontSize,
        color: colors.textSecondary,
    },
    rightContent: {
        marginLeft: spacing.sm,
    },
    actions: {
        flexDirection: 'row',
        gap: spacing.xs,
        marginLeft: spacing.sm,
    },
    actionButton: {
        width: 36,
        height: 36,
        borderRadius: borderRadius.sm,
        alignItems: 'center',
        justifyContent: 'center',
    },
    editButton: {
        backgroundColor: `${colors.primary}15`,
    },
    deleteButton: {
        backgroundColor: `${colors.error}15`,
    },
});

export default ListCard;
