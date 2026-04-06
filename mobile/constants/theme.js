// Color palette for the app
export const colors = {
    // Primary gradient colors
    primary: '#667eea',
    primaryDark: '#764ba2',
    primaryLight: '#8b9ff5',

    // Secondary colors
    secondary: '#f093fb',
    secondaryDark: '#f5576c',

    // Status colors
    success: '#10b981',
    successLight: '#d1fae5',
    warning: '#f59e0b',
    warningLight: '#fef3c7',
    error: '#ef4444',
    errorLight: '#fee2e2',
    info: '#3b82f6',
    infoLight: '#dbeafe',

    // Neutral colors
    white: '#ffffff',
    black: '#000000',
    background: '#f8fafc',
    card: '#ffffff',
    border: '#e2e8f0',

    // Text colors
    text: '#1e293b',
    textSecondary: '#64748b',
    textLight: '#94a3b8',
    textWhite: '#ffffff',

    // Business type colors
    restaurant: {
        primary: '#f97316',
        secondary: '#fb923c',
        light: '#fff7ed',
        icon: 'restaurant'
    },
    retail: {
        primary: '#8b5cf6',
        secondary: '#a78bfa',
        light: '#f5f3ff',
        icon: 'storefront'
    },
    service: {
        primary: '#06b6d4',
        secondary: '#22d3ee',
        light: '#ecfeff',
        icon: 'content-cut'
    }
};

// Typography
export const typography = {
    h1: {
        fontSize: 32,
        fontWeight: 'bold',
    },
    h2: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    h3: {
        fontSize: 20,
        fontWeight: '600',
    },
    h4: {
        fontSize: 18,
        fontWeight: '600',
    },
    body: {
        fontSize: 16,
        fontWeight: 'normal',
    },
    bodySmall: {
        fontSize: 14,
        fontWeight: 'normal',
    },
    caption: {
        fontSize: 12,
        fontWeight: 'normal',
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
    }
};

// Spacing
export const spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
};

// Border radius
export const borderRadius = {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    full: 9999,
};

// Shadows
export const shadows = {
    sm: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    md: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 4,
    },
    lg: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 8,
    },
    xl: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 12,
    }
};

// Get business type config
export const getBusinessConfig = (businessTypeCode) => {
    const configs = {
        restaurant: {
            name: 'Restaurant',
            color: colors.restaurant,
            icon: 'restaurant',
            primaryLabel: 'Menu Items',
            secondaryLabel: 'Orders',
            itemsLabel: 'Menu',
            addItemLabel: 'Add Menu Item',
        },
        retail: {
            name: 'Retail',
            color: colors.retail,
            icon: 'storefront',
            primaryLabel: 'Products',
            secondaryLabel: 'Inventory',
            itemsLabel: 'Products',
            addItemLabel: 'Add Product',
        },
        service: {
            name: 'Service',
            color: colors.service,
            icon: 'content-cut',
            primaryLabel: 'Services',
            secondaryLabel: 'Staff',
            itemsLabel: 'Services',
            addItemLabel: 'Add Service',
        }
    };

    return configs[businessTypeCode] || configs.restaurant;
};

export default {
    colors,
    typography,
    spacing,
    borderRadius,
    shadows,
    getBusinessConfig
};
