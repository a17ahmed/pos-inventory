import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { authEvents } from './authEvents';
import { refreshTokens } from './tokenRefresh';

// Get socket URL from API URL (remove /api suffix)
const API_BASE_URL = Constants.expoConfig?.extra?.API_BASE_URL || 'http://localhost:5000/api';
const SOCKET_URL = API_BASE_URL.replace('/api', '');

let socket = null;
let connectionPromise = null;

/**
 * Connect to the socket server with JWT authentication
 */
export const connectSocket = async () => {
    // Return existing socket if connected
    if (socket?.connected) {
        return socket;
    }

    // Return pending connection if in progress
    if (connectionPromise) {
        return connectionPromise;
    }

    connectionPromise = new Promise(async (resolve, reject) => {
        try {
            const token = await AsyncStorage.getItem('token');

            if (!token) {
                connectionPromise = null;
                reject(new Error('No token available'));
                return;
            }

            // Get employee data for role
            const employeeStr = await AsyncStorage.getItem('employee');
            let employee = null;
            try {
                employee = employeeStr ? JSON.parse(employeeStr) : null;
            } catch (e) {
                console.warn('[Socket] Failed to parse employee data');
            }

            socket = io(SOCKET_URL, {
                auth: { token },
                transports: ['websocket'],
                reconnection: true,
                reconnectionAttempts: 10,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                timeout: 20000,
            });

            socket.on('connect', () => {
                console.log('[Socket] Connected:', socket.id);

                // Join role-specific room if employee has a role
                if (employee?.role) {
                    socket.emit('join:role', { role: employee.role });
                    console.log('[Socket] Joined role room:', employee.role);
                }

                connectionPromise = null;
                resolve(socket);
            });

            socket.on('connect_error', async (error) => {
                console.error('[Socket] Connection error:', error.message);

                // If the error is auth-related (token expired/invalid),
                // try to refresh the token before giving up
                if (error.message === 'Token verification failed' ||
                    error.message === 'Authentication required') {
                    console.warn('[Socket] Auth failed, attempting token refresh');

                    try {
                        console.log('[Socket] Calling shared refresh...');
                        // Use shared refresh function to prevent race conditions
                        const { token: newToken } = await refreshTokens();

                        // Update socket auth and reconnect
                        console.log('[Socket] Token refreshed, reconnecting...');
                        socket.auth.token = newToken;
                        socket.connect();
                        return; // Don't reject, let reconnect happen
                    } catch (refreshError) {
                        console.error('[Socket] Token refresh failed:', refreshError.message);
                    }

                    // Refresh failed or no refresh token - logout
                    console.warn('[Socket] Token refresh failed, triggering logout');
                    disconnectSocket();

                    // Clear storage and notify app
                    console.log('[Socket] Clearing local storage...');
                    try {
                        await AsyncStorage.multiRemove(['token', 'refreshToken', 'admin', 'business', 'employee', 'counterUser']);
                        console.log('[Socket] Storage cleared');
                    } catch (e) {
                        console.error('[Socket] Error clearing storage:', e.message);
                    }
                    console.log('[Socket] Emitting SESSION_EXPIRED event');
                    authEvents.emit({ type: 'SESSION_EXPIRED' });
                }

                connectionPromise = null;
                reject(error);
            });

            socket.on('disconnect', (reason) => {
                console.log('[Socket] Disconnected:', reason);
            });

            socket.on('reconnect', (attemptNumber) => {
                console.log('[Socket] Reconnected after', attemptNumber, 'attempts');
            });

            socket.on('reconnect_error', (error) => {
                console.error('[Socket] Reconnection error:', error.message);
            });

        } catch (error) {
            connectionPromise = null;
            reject(error);
        }
    });

    return connectionPromise;
};

/**
 * Disconnect from the socket server
 */
export const disconnectSocket = () => {
    if (socket) {
        console.log('[Socket] Disconnecting...');
        socket.removeAllListeners();
        socket.disconnect();
        socket = null;
    }
    connectionPromise = null;
};

/**
 * Get the current socket instance
 */
export const getSocket = () => socket;

/**
 * Check if socket is connected
 */
export const isSocketConnected = () => socket?.connected || false;

/**
 * Subscribe to a specific order for updates
 */
export const subscribeToOrder = (orderId) => {
    if (socket?.connected) {
        socket.emit('order:subscribe', { orderId });
    }
};

/**
 * Unsubscribe from a specific order
 */
export const unsubscribeFromOrder = (orderId) => {
    if (socket?.connected) {
        socket.emit('order:unsubscribe', { orderId });
    }
};

export default {
    connectSocket,
    disconnectSocket,
    getSocket,
    isSocketConnected,
    subscribeToOrder,
    unsubscribeFromOrder,
};
