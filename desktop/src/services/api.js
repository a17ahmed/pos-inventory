import axios from 'axios';

// API Base URL - can be configured via environment or settings
const API_BASE_URL = localStorage.getItem('api_base_url') || 'http://localhost:3000';

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Refresh token queue to prevent race conditions
let isRefreshing = false;
let refreshSubscribers = [];

const subscribeTokenRefresh = (callback) => {
    refreshSubscribers.push(callback);
};

const onRefreshed = (token) => {
    refreshSubscribers.forEach((callback) => callback(token));
    refreshSubscribers = [];
};

const onRefreshFailed = (error) => {
    refreshSubscribers.forEach((callback) => callback(null, error));
    refreshSubscribers = [];
};

// Request interceptor - add auth token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor - handle token refresh
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // Skip token refresh for auth endpoints (login, register, etc.)
        const isAuthEndpoint = originalRequest?.url?.includes('/adminAuth/') ||
                               originalRequest?.url?.includes('/employeeAuth/') ||
                               originalRequest?.url?.includes('/auth/');

        // If 401 and not already retrying and not an auth endpoint
        if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
            originalRequest._retry = true;

            // Check if we have a refresh token before attempting refresh
            const refreshToken = localStorage.getItem('refreshToken');
            if (!refreshToken) {
                // No refresh token - redirect to login
                localStorage.removeItem('token');
                window.location.href = '/#/login';
                return Promise.reject(error);
            }

            // If already refreshing, queue this request
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    subscribeTokenRefresh((token, err) => {
                        if (err) {
                            reject(err);
                        } else {
                            originalRequest.headers.Authorization = `Bearer ${token}`;
                            resolve(api(originalRequest));
                        }
                    });
                });
            }

            isRefreshing = true;

            try {
                const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
                    refreshToken,
                });

                const { token, accessToken, refreshToken: newRefreshToken } = response.data;
                const newToken = token || accessToken; // Backend returns "token", handle both
                localStorage.setItem('token', newToken);
                if (newRefreshToken) {
                    localStorage.setItem('refreshToken', newRefreshToken);
                }

                isRefreshing = false;
                onRefreshed(newToken);

                originalRequest.headers.Authorization = `Bearer ${newToken}`;
                return api(originalRequest);
            } catch (refreshError) {
                isRefreshing = false;
                onRefreshFailed(refreshError);

                // Refresh failed - logout
                localStorage.removeItem('token');
                localStorage.removeItem('refreshToken');
                localStorage.removeItem('user');
                localStorage.removeItem('admin');
                localStorage.removeItem('employee');
                localStorage.removeItem('business');
                window.location.href = '/#/login';
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

// Update API base URL
export const setApiBaseUrl = (url) => {
    localStorage.setItem('api_base_url', url);
    api.defaults.baseURL = url;
};

export const getApiBaseUrl = () => {
    return api.defaults.baseURL;
};

export default api;
