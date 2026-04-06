import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { authEvents } from '../services/authEvents';
import { refreshTokens } from '../services/tokenRefresh';

const API_BASE_URL = Constants.expoConfig.extra.API_BASE_URL;

// Create axios instance with base URL
const api = axios.create({
    baseURL: API_BASE_URL,
});

// Add token to all requests automatically
api.interceptors.request.use(
    async (config) => {
        const token = await AsyncStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Track refresh state to avoid multiple simultaneous refreshes
let isRefreshing = false;
let refreshQueue = []; // queued requests waiting for token refresh

const processQueue = (error, token = null) => {
    refreshQueue.forEach(({ resolve, reject }) => {
        if (error) {
            reject(error);
        } else {
            resolve(token);
        }
    });
    refreshQueue = [];
};

// Handle 401 errors — try to refresh token before logging out
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // Only handle 401s, skip if already retried
        if (error.response?.status !== 401 || originalRequest._retry) {
            return Promise.reject(error);
        }

        console.log('[Auth] 401 received for:', originalRequest.url);
        const errorCode = error.response?.data?.code;
        console.log('[Auth] Error code:', errorCode);

        // Try to refresh on any token-related 401 (expired or invalid)
        const shouldAttemptRefresh = errorCode === 'TOKEN_EXPIRED' || errorCode === 'TOKEN_INVALID' || !errorCode;
        console.log('[Auth] Should attempt refresh:', shouldAttemptRefresh);

        if (shouldAttemptRefresh) {
            // If already refreshing, queue this request
            if (isRefreshing) {
                console.log('[Auth] Refresh in progress, queuing request:', originalRequest.url);
                return new Promise((resolve, reject) => {
                    refreshQueue.push({ resolve, reject });
                }).then(token => {
                    console.log('[Auth] Retrying queued request:', originalRequest.url);
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                    originalRequest._retry = true;
                    return api(originalRequest);
                });
            }

            isRefreshing = true;
            console.log('[Auth] Starting token refresh...');

            try {
                // Use shared refresh function to prevent race conditions with socket.js
                const { token: newToken } = await refreshTokens();

                // Resolve all queued requests with new token
                console.log('[Auth] Processing queued requests:', refreshQueue.length);
                processQueue(null, newToken);

                // Retry the original request
                console.log('[Auth] Retrying original request:', originalRequest.url);
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
                originalRequest._retry = true;
                return api(originalRequest);

            } catch (refreshError) {
                // Refresh failed — force logout
                console.error('[Auth] Refresh failed:', refreshError.message);
                console.log('[Auth] Response status:', refreshError.response?.status);
                console.log('[Auth] Response data:', JSON.stringify(refreshError.response?.data));

                processQueue(refreshError, null);
                await forceLogout('SESSION_EXPIRED');
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        // This shouldn't be reached now, but keep as fallback
        console.log('[Auth] Unhandled 401, forcing logout');
        await forceLogout('UNAUTHORIZED');
        return Promise.reject(error);
    }
);

let isLoggingOut = false;

async function forceLogout(type) {
    if (isLoggingOut) {
        console.log('[Auth] Logout already in progress, skipping');
        return;
    }
    isLoggingOut = true;
    console.log('[Auth] Force logout triggered, type:', type);

    try {
        // Try to revoke refresh token on server
        const refreshToken = await AsyncStorage.getItem('refreshToken');
        if (refreshToken) {
            console.log('[Auth] Revoking refresh token on server...');
            axios.post(`${API_BASE_URL}/auth/logout`, { refreshToken }).catch(() => {});
        }

        console.log('[Auth] Clearing local storage...');
        await AsyncStorage.multiRemove(['token', 'refreshToken', 'admin', 'business', 'employee', 'counterUser']);
        console.log('[Auth] Emitting auth event:', type);
        authEvents.emit({ type });
    } catch (clearError) {
        console.error('[Auth] Error during logout:', clearError);
    } finally {
        isLoggingOut = false;
    }
}

export default api;
export { API_BASE_URL };
