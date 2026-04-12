import React, { createContext, useContext, useState, useEffect } from 'react';
import { adminLogin as adminLoginApi, logout as logoutApi } from '../services/api/auth';

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [userType, setUserType] = useState(null); // 'admin' or 'employee'

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = () => {
        try {
            const token = localStorage.getItem('token');
            const adminStr = localStorage.getItem('admin');
            const employeeStr = localStorage.getItem('employee');

            if (token && (adminStr || employeeStr)) {
                if (adminStr) {
                    const adminData = JSON.parse(adminStr);
                    setUser(adminData);
                    setUserType('admin');
                } else {
                    const employeeData = JSON.parse(employeeStr);
                    setUser(employeeData);
                    setUserType('employee');
                }
                setIsAuthenticated(true);
            } else {
                setUser(null);
                setUserType(null);
                setIsAuthenticated(false);
            }
        } catch (error) {
            console.error('Auth check error:', error);
            logout();
        } finally {
            setLoading(false);
        }
    };

    const login = async (email, password) => {
        try {
            const response = await adminLoginApi(email, password);
            const { token, refreshToken, admin, business } = response.data;

            localStorage.setItem('token', token);
            if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
            localStorage.setItem('admin', JSON.stringify(admin));
            localStorage.setItem('user', JSON.stringify(admin));
            localStorage.setItem('business', JSON.stringify(business));

            setUser(admin);
            setIsAuthenticated(true);

            return { success: true, user: admin, business };
        } catch (error) {
            const message = error.response?.data?.message || 'Login failed';
            return { success: false, error: message };
        }
    };

    const logout = async () => {
        try {
            const refreshToken = localStorage.getItem('refreshToken');
            if (refreshToken) {
                await logoutApi(refreshToken).catch(() => {});
            }
        } finally {
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
            localStorage.removeItem('admin');
            localStorage.removeItem('employee');
            localStorage.removeItem('counterUser');
            localStorage.removeItem('business');
            setUser(null);
            setUserType(null);
            setIsAuthenticated(false);
        }
    };

    // Computed properties
    const isAdmin = userType === 'admin';
    const isEmployee = userType === 'employee';

    const value = {
        user,
        loading,
        isAuthenticated,
        userType,
        isAdmin,
        isEmployee,
        login,
        logout,
        checkAuth,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
