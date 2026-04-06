// Role options for SERVICE businesses (salon, spa, clinic)
const SERVICE_ROLES = [
    { label: "Employee", value: "employee" },
    { label: "Senior", value: "senior" },
    { label: "Manager", value: "manager" },
];

// Role options for RESTAURANT businesses
const RESTAURANT_ROLES = [
    { label: "Waiter", value: "waiter" },
    { label: "Chef", value: "chef" },
    { label: "Head Chef", value: "head_chef" },
    { label: "Manager", value: "manager" },
];

// Employee configuration based on business type
// This determines which fields are shown in the Add/Edit employee forms

export const EMPLOYEE_CONFIG = {
    // For service-based businesses (salon, spa, clinic, etc.)
    service: {
        label: "Staff",
        labelPlural: "Staff Members",
        addTitle: "ADD STAFF MEMBER",
        editTitle: "EDIT STAFF MEMBER",
        // Fields to show in forms (in order)
        showFields: [
            "name",
            "employeeId",
            "password",
            "phone",
            "email",
            "role",
            "specializations",
            "commissionRate",
            "status"
        ],
        // Fields to show in list view
        listFields: ["name", "employeeId", "role", "status", "phone"],
        // Colors
        headerColor: "#06b6d4", // Cyan
        buttonColor: "#06b6d4",
        // Roles for this business type
        roles: SERVICE_ROLES,
        defaultRole: "employee",
    },

    // For retail businesses
    retail: {
        label: "Counter User",
        labelPlural: "Counter Users",
        addTitle: "ADD COUNTER USER",
        editTitle: "EDIT COUNTER USER",
        // Minimal fields for retail
        showFields: [
            "name",
            "employeeId",
            "password",
            "status"
        ],
        // Fields to show in list view
        listFields: ["name", "employeeId", "status"],
        // Colors
        headerColor: "#1f2937", // Gray
        buttonColor: "#0891b2",
        // No roles for retail (counter users)
        roles: [],
        defaultRole: "employee",
    },

    // For restaurant businesses
    restaurant: {
        label: "Staff",
        labelPlural: "Staff Members",
        addTitle: "ADD STAFF MEMBER",
        editTitle: "EDIT STAFF MEMBER",
        // Fields to show in forms
        showFields: [
            "name",
            "employeeId",
            "password",
            "phone",
            "role",
            "status"
        ],
        // Fields to show in list view
        listFields: ["name", "employeeId", "role", "status", "phone"],
        // Colors
        headerColor: "#f97316", // Orange
        buttonColor: "#f97316",
        // Roles for this business type
        roles: RESTAURANT_ROLES,
        defaultRole: "waiter",
    }
};

// Legacy export for backwards compatibility (uses service roles)
export const EMPLOYEE_ROLES = SERVICE_ROLES;

// Status options for employees
export const EMPLOYEE_STATUSES = [
    { label: "Active", value: "active" },
    { label: "Inactive", value: "inactive" },
    { label: "On Leave", value: "on_leave" },
];

// Helper function to get config based on business type code
export const getEmployeeConfig = (businessTypeCode) => {
    const code = businessTypeCode?.toLowerCase() || '';

    // Service-based business types
    const serviceTypes = ['salon', 'spa', 'clinic', 'service', 'ser', 'sal', 'cli'];
    if (serviceTypes.some(type => code.includes(type))) {
        return EMPLOYEE_CONFIG.service;
    }

    // Restaurant business types
    const restaurantTypes = ['restaurant', 'food', 'cafe', 'kitchen', 'res', 'caf'];
    if (restaurantTypes.some(type => code.includes(type))) {
        return EMPLOYEE_CONFIG.restaurant;
    }

    // Default to retail config
    return EMPLOYEE_CONFIG.retail;
};

export default EMPLOYEE_CONFIG;
