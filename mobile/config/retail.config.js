/**
 * Retail Business Configuration
 * Purple theme - Products, Receipts, Inventory
 */

export const retailConfig = {
    type: 'retail',
    name: 'Retail',

    // Theme Colors
    colors: {
        primary: '#8b5cf6',
        secondary: '#a78bfa',
        light: '#f5f3ff',
        gradient: ['#8b5cf6', '#7c3aed'],
    },

    // Icons
    icon: 'storefront',
    tabIcon: 'cube',

    // Labels
    labels: {
        items: 'Products',
        addItem: 'Add Product',
        itemsTab: 'Products',
        staff: 'Counter Users',
        addStaff: 'Add Counter User',
        orderUnit: 'Receipt',
        orderUnitPlural: 'Receipts',
        salesTitle: 'Sales & Reports',
        dashboardTitle: 'Dashboard',
    },

    // Features enabled for this business type
    features: {
        hasTableManagement: false,
        hasKitchenDisplay: false,
        hasBarcode: true,
        hasInventory: true,
        hasCommission: false,
        hasDelivery: false,
        hasReservations: false,
        hasDeals: false,
    },

    // Employee roles available
    roles: [
        { label: 'Cashier', value: 'cashier' },
        { label: 'Sales Associate', value: 'sales' },
        { label: 'Manager', value: 'manager' },
    ],

    // API endpoints (if different per type)
    endpoints: {
        items: '/product',
        transactions: '/receipt',
    },
};
