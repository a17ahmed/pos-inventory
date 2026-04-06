import { useEffect, useRef, useCallback, useState } from 'react';
import { connectSocket, getSocket, isSocketConnected } from '../services/socket';

/**
 * Hook to initialize and access the socket connection
 */
export const useSocket = () => {
    const socketRef = useRef(null);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        const initSocket = async () => {
            try {
                const socket = await connectSocket();
                socketRef.current = socket;
                setConnected(true);

                socket.on('disconnect', () => {
                    setConnected(false);
                });

                socket.on('connect', () => {
                    setConnected(true);
                });
            } catch (error) {
                console.error('[useSocket] Failed to connect:', error.message);
                setConnected(false);
            }
        };

        initSocket();

        // Cleanup: don't disconnect on unmount as socket is shared
        return () => {
            // Remove connection status listeners but keep socket alive
        };
    }, []);

    return { socket: socketRef.current || getSocket(), connected };
};

/**
 * Hook to subscribe to order-related socket events
 * @param {Object} handlers - Event handlers for different order events
 */
export const useOrderEvents = (handlers = {}) => {
    const { socket, connected } = useSocket();

    useEffect(() => {
        if (!socket || !connected) return;

        const {
            onOrderCreated,
            onOrderUpdated,
            onOrderStatusChanged,
            onOrderReady,
            onItemStatusChanged,
            onOrderCancelled
        } = handlers;

        // Register event listeners
        if (onOrderCreated) {
            socket.on('order:created', onOrderCreated);
        }
        if (onOrderUpdated) {
            socket.on('order:updated', onOrderUpdated);
        }
        if (onOrderStatusChanged) {
            socket.on('order:statusChanged', onOrderStatusChanged);
        }
        if (onOrderReady) {
            socket.on('order:ready', onOrderReady);
        }
        if (onItemStatusChanged) {
            socket.on('order:itemStatusChanged', onItemStatusChanged);
        }
        if (onOrderCancelled) {
            socket.on('order:cancelled', onOrderCancelled);
        }

        // Cleanup: unregister event listeners on unmount
        return () => {
            if (onOrderCreated) socket.off('order:created', onOrderCreated);
            if (onOrderUpdated) socket.off('order:updated', onOrderUpdated);
            if (onOrderStatusChanged) socket.off('order:statusChanged', onOrderStatusChanged);
            if (onOrderReady) socket.off('order:ready', onOrderReady);
            if (onItemStatusChanged) socket.off('order:itemStatusChanged', onItemStatusChanged);
            if (onOrderCancelled) socket.off('order:cancelled', onOrderCancelled);
        };
    }, [socket, connected, handlers]);

    return { socket, connected };
};

/**
 * Hook specifically for kitchen display real-time updates
 */
export const useKitchenSocket = (setOrders, toast) => {
    const handleOrderCreated = useCallback((order) => {
        setOrders(prev => {
            // Check if order already exists
            if (prev.some(o => o._id === order._id)) return prev;
            return [order, ...prev];
        });

        // Show notification outside of setState to avoid render cycle issues
        if (toast) {
            setTimeout(() => {
                toast.show({
                    description: `New order #${order.orderNumber}!`,
                    placement: 'top',
                    bg: 'orange.500'
                });
            }, 0);
        }
    }, [setOrders, toast]);

    const handleOrderUpdated = useCallback((order) => {
        setOrders(prev => prev.map(o =>
            o._id === order._id ? order : o
        ));
    }, [setOrders]);

    const handleOrderStatusChanged = useCallback(({ orderId, status }) => {
        setOrders(prev => {
            // Remove from kitchen list if no longer relevant
            if (status === 'served' || status === 'paid' || status === 'cancelled') {
                return prev.filter(o => o._id !== orderId);
            }
            // Update status
            return prev.map(o =>
                o._id === orderId ? { ...o, status } : o
            );
        });
    }, [setOrders]);

    const handleItemStatusChanged = useCallback(({ orderId, itemId, status }) => {
        setOrders(prev => prev.map(order => {
            if (order._id !== orderId) return order;
            return {
                ...order,
                items: order.items.map(item =>
                    item._id === itemId ? { ...item, status } : item
                )
            };
        }));
    }, [setOrders]);

    const handleOrderCancelled = useCallback(({ orderId }) => {
        setOrders(prev => prev.filter(o => o._id !== orderId));

        // Show notification outside of setState to avoid render cycle issues
        if (toast) {
            setTimeout(() => {
                toast.show({
                    description: 'Order cancelled',
                    placement: 'top',
                    bg: 'red.500'
                });
            }, 0);
        }
    }, [setOrders, toast]);

    return useOrderEvents({
        onOrderCreated: handleOrderCreated,
        onOrderUpdated: handleOrderUpdated,
        onOrderStatusChanged: handleOrderStatusChanged,
        onItemStatusChanged: handleItemStatusChanged,
        onOrderCancelled: handleOrderCancelled
    });
};

/**
 * Hook for pending orders screen with real-time updates
 */
export const usePendingOrdersSocket = (setOrders, toast) => {
    const handleOrderStatusChanged = useCallback(({ orderId, status }) => {
        setOrders(prev => {
            // Remove if paid or cancelled
            if (status === 'paid' || status === 'cancelled') {
                return prev.filter(o => o._id !== orderId);
            }
            // Update status
            return prev.map(o =>
                o._id === orderId ? { ...o, status } : o
            );
        });
    }, [setOrders]);

    const handleOrderUpdated = useCallback((order) => {
        setOrders(prev => {
            // Check if order exists
            const exists = prev.some(o => o._id === order._id);
            if (exists) {
                return prev.map(o => o._id === order._id ? order : o);
            }
            // Add new order if unpaid
            if (order.paymentStatus === 'pending') {
                return [order, ...prev];
            }
            return prev;
        });
    }, [setOrders]);

    const handleOrderCancelled = useCallback(({ orderId }) => {
        setOrders(prev => prev.filter(o => o._id !== orderId));
    }, [setOrders]);

    return useOrderEvents({
        onOrderStatusChanged: handleOrderStatusChanged,
        onOrderUpdated: handleOrderUpdated,
        onOrderCancelled: handleOrderCancelled
    });
};

export default {
    useSocket,
    useOrderEvents,
    useKitchenSocket,
    usePendingOrdersSocket
};
