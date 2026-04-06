/**
 * BusinessContext - Single source of truth for business type and configuration
 *
 * Usage:
 *   const { businessType, config, isRetail, isRestaurant, isService } = useBusiness();
 */

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { detectBusinessType, BusinessTypes } from '../config/businessTypes';
import { getBusinessConfig } from '../config';

const BusinessContext = createContext(null);

export const BusinessProvider = ({ children }) => {
    const [businessData, setBusinessData] = useState(null);
    const [employeeData, setEmployeeData] = useState(null);
    const [businessType, setBusinessType] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // Load business and employee data from AsyncStorage
    const loadData = useCallback(async () => {
        try {
            setIsLoading(true);
            const [businessStr, employeeStr] = await Promise.all([
                AsyncStorage.getItem('business'),
                AsyncStorage.getItem('employee'),
            ]);

            const business = businessStr ? JSON.parse(businessStr) : null;
            const employee = employeeStr ? JSON.parse(employeeStr) : null;

            setBusinessData(business);
            setEmployeeData(employee);

            if (business) {
                const detectedType = detectBusinessType(business, employee);
                setBusinessType(detectedType);
            } else {
                setBusinessType(null);
            }
        } catch (error) {
            console.error('BusinessContext: Error loading data:', error);
            setBusinessType(BusinessTypes.SERVICE); // Default fallback
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Memoized config - prevents re-renders when config hasn't changed
    const config = useMemo(() => {
        return businessType ? getBusinessConfig(businessType) : null;
    }, [businessType]);

    // Memoized context value - prevents unnecessary re-renders
    const value = useMemo(() => ({
        // Data
        businessData,
        employeeData,
        businessType,
        config,
        isLoading,

        // Convenience booleans
        isRetail: businessType === BusinessTypes.RETAIL,
        isRestaurant: businessType === BusinessTypes.RESTAURANT,
        isService: businessType === BusinessTypes.SERVICE,

        // Methods
        refresh: loadData,

        // Update business type manually (useful after login)
        setBusinessType: (type) => setBusinessType(type),
        updateBusinessData: (data) => {
            setBusinessData(data);
            if (data) {
                const detectedType = detectBusinessType(data, employeeData);
                setBusinessType(detectedType);
            }
        },
    }), [businessData, employeeData, businessType, config, isLoading, loadData]);

    return (
        <BusinessContext.Provider value={value}>
            {children}
        </BusinessContext.Provider>
    );
};

/**
 * Hook to access business context
 * @returns {Object} Business context value
 */
export const useBusiness = () => {
    const context = useContext(BusinessContext);
    if (!context) {
        throw new Error('useBusiness must be used within a BusinessProvider');
    }
    return context;
};

export default BusinessContext;
