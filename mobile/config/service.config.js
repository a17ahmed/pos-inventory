/**
 * Service Business Configuration
 * Cyan theme - Services, Bills, Commission
 */

export const serviceConfig = {
    type: 'service',
    name: 'Service',

    // Theme Colors
    colors: {
        primary: '#06b6d4',
        secondary: '#22d3ee',
        light: '#ecfeff',
        gradient: ['#06b6d4', '#0891b2'],
    },

    // Icons
    icon: 'content-cut',
    tabIcon: 'cut',

    // Labels
    labels: {
        items: 'Services',
        addItem: 'Add Service',
        itemsTab: 'Services',
        staff: 'Staff',
        addStaff: 'Add Staff',
        orderUnit: 'Bill',
        orderUnitPlural: 'Bills',
        salesTitle: 'Sales & Reports',
        dashboardTitle: 'Dashboard',
    },

    // Features enabled for this business type
    features: {
        hasTableManagement: false,
        hasKitchenDisplay: false,
        hasBarcode: false,
        hasInventory: false,
        hasCommission: true,
        hasDelivery: false,
        hasReservations: false,
        hasDeals: false,
    },

    // Employee roles available
    roles: [
        { label: 'Employee', value: 'employee' },
        { label: 'Senior', value: 'senior' },
        { label: 'Manager', value: 'manager' },
    ],

    // API endpoints
    endpoints: {
        items: '/service',
        transactions: '/receipt',
    },
};
