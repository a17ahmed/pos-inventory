/**
 * Centralized business type detection
 * Single source of truth - all detection keywords in one place
 */

const RETAIL_KEYWORDS = ['retail', 'shop', 'store', 'mart', 'grocery', 'pharmacy'];
const RESTAURANT_KEYWORDS = ['restaurant', 'food', 'cafe', 'kitchen', 'diner', 'bistro'];
const SERVICE_KEYWORDS = ['salon', 'spa', 'clinic', 'service', 'barber', 'beauty'];

export const BusinessTypes = {
    RETAIL: 'retail',
    RESTAURANT: 'restaurant',
    SERVICE: 'service',
};

/**
 * Detects business type from business object and optional employee data
 * @param {Object} business - Business object from AsyncStorage
 * @param {Object} employee - Optional employee object for role-based detection
 * @returns {string} - 'retail' | 'restaurant' | 'service'
 */
export const detectBusinessType = (business, employee = null) => {
    // Collect all possible sources for detection
    const sources = [
        business?.businessType?.code,
        business?.businessType?.name,
        business?.name,
        employee?.role,
    ].filter(Boolean).map(s => s.toLowerCase()).join(' ');

    // Check against keywords
    if (RETAIL_KEYWORDS.some(k => sources.includes(k))) {
        return BusinessTypes.RETAIL;
    }
    if (RESTAURANT_KEYWORDS.some(k => sources.includes(k))) {
        return BusinessTypes.RESTAURANT;
    }
    if (SERVICE_KEYWORDS.some(k => sources.includes(k))) {
        return BusinessTypes.SERVICE;
    }

    // Fallback: check explicit short codes
    const code = business?.businessType?.code?.toLowerCase();
    if (code === 'ret') return BusinessTypes.RETAIL;
    if (code === 'res') return BusinessTypes.RESTAURANT;

    // Default to service
    return BusinessTypes.SERVICE;
};
