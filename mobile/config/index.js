/**
 * Business Configuration Index
 * Central export for all business configs
 */

import { retailConfig } from './retail.config';
import { restaurantConfig } from './restaurant.config';
import { serviceConfig } from './service.config';
import { BusinessTypes, detectBusinessType } from './businessTypes';

const configs = {
    [BusinessTypes.RETAIL]: retailConfig,
    [BusinessTypes.RESTAURANT]: restaurantConfig,
    [BusinessTypes.SERVICE]: serviceConfig,
};

/**
 * Get business configuration by type
 * @param {string} businessType - 'retail' | 'restaurant' | 'service'
 * @returns {Object} - Configuration object for the business type
 */
export const getBusinessConfig = (businessType) => {
    return configs[businessType] || serviceConfig; // Default to service
};

export {
    retailConfig,
    restaurantConfig,
    serviceConfig,
    BusinessTypes,
    detectBusinessType,
};
