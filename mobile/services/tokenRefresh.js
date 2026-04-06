import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Constants from 'expo-constants';

const API_BASE_URL = Constants.expoConfig?.extra?.API_BASE_URL || 'http://localhost:5000/api';

// Shared state to prevent multiple simultaneous refresh attempts
let refreshPromise = null;

/**
 * Shared token refresh function that prevents race conditions.
 * Multiple callers will share the same refresh request.
 *
 * @returns {Promise<{token: string, refreshToken: string}>} New tokens
 * @throws {Error} If refresh fails
 */
export async function refreshTokens() {
    // If a refresh is already in progress, wait for it
    if (refreshPromise) {
        console.log('[TokenRefresh] Refresh already in progress, waiting...');
        return refreshPromise;
    }

    console.log('[TokenRefresh] Starting token refresh...');

    refreshPromise = (async () => {
        try {
            const refreshToken = await AsyncStorage.getItem('refreshToken');

            if (!refreshToken) {
                throw new Error('No refresh token available');
            }

            console.log('[TokenRefresh] Calling refresh endpoint...');
            const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
                refreshToken
            }, { timeout: 10000 });

            const { token: newToken, refreshToken: newRefreshToken } = response.data;
            console.log('[TokenRefresh] Refresh successful, storing new tokens...');

            // Store new tokens
            await AsyncStorage.setItem('token', newToken);
            await AsyncStorage.setItem('refreshToken', newRefreshToken);
            console.log('[TokenRefresh] New tokens stored');

            return { token: newToken, refreshToken: newRefreshToken };
        } finally {
            // Clear the promise so future calls can refresh again
            refreshPromise = null;
        }
    })();

    return refreshPromise;
}
