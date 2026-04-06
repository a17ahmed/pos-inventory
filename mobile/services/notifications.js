import { Platform, Vibration } from 'react-native';

/**
 * Initialize notifications (placeholder for expo-notifications if needed later)
 * For now, we use in-app vibration and toast notifications
 */
export const initializeNotifications = async () => {
    // Placeholder for expo-notifications setup
    // Can be expanded to use push notifications later
    return true;
};

/**
 * Show order ready notification with vibration
 * @param {Object} orderData - Order data with orderNumber, table, customerName
 * @param {Function} toast - Native Base toast function
 */
export const showOrderReadyNotification = (orderData, toast) => {
    const { orderNumber, table, customerName } = orderData;

    // Vibrate pattern: wait, vibrate, wait, vibrate
    Vibration.vibrate([0, 300, 100, 300]);

    // Build notification message
    let message = `Order #${orderNumber} is ready!`;
    if (table?.tableNumber) {
        message += ` - Table ${table.tableNumber}`;
    } else if (customerName) {
        message += ` - ${customerName}`;
    }

    // Show toast notification
    if (toast) {
        toast.show({
            title: 'Order Ready',
            description: message,
            placement: 'top',
            duration: 5000,
            bg: 'green.500',
        });
    }
};

/**
 * Show new order notification (for kitchen)
 */
export const showNewOrderNotification = (orderData, toast) => {
    const { orderNumber, table } = orderData;

    // Vibrate
    Vibration.vibrate([0, 200, 100, 200]);

    let message = `New order #${orderNumber}`;
    if (table?.tableNumber) {
        message += ` - Table ${table.tableNumber}`;
    }

    if (toast) {
        toast.show({
            title: 'New Order',
            description: message,
            placement: 'top',
            duration: 4000,
            bg: 'orange.500',
        });
    }
};

/**
 * Show order cancelled notification
 */
export const showOrderCancelledNotification = (orderData, toast) => {
    const { orderNumber } = orderData;

    if (toast) {
        toast.show({
            description: `Order #${orderNumber} cancelled`,
            placement: 'top',
            duration: 3000,
            bg: 'red.500',
        });
    }
};

export default {
    initializeNotifications,
    showOrderReadyNotification,
    showNewOrderNotification,
    showOrderCancelledNotification,
};
