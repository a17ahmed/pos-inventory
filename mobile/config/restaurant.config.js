/**
 * Restaurant Business Configuration
 * Orange theme - Menu, Orders, Tables
 */

export const restaurantConfig = {
    type: 'restaurant',
    name: 'Restaurant',

    // Theme Colors
    colors: {
        primary: '#f97316',
        secondary: '#fb923c',
        light: '#fff7ed',
        gradient: ['#f97316', '#ea580c'],
    },

    // Icons
    icon: 'restaurant',
    tabIcon: 'restaurant',

    // Labels
    labels: {
        items: 'Menu',
        addItem: 'Add Menu Item',
        itemsTab: 'Menu',
        staff: 'Staff',
        addStaff: 'Add Staff',
        orderUnit: 'Order',
        orderUnitPlural: 'Orders',
        salesTitle: 'Sales & Reports',
        dashboardTitle: 'Dashboard',
    },

    // Features enabled for this business type
    features: {
        hasTableManagement: true,
        hasKitchenDisplay: true,
        hasBarcode: false,
        hasInventory: false,
        hasCommission: false,
        hasDelivery: true,
        hasReservations: true,
        hasDeals: true,
    },

    // Employee roles available
    roles: [
        { label: 'Waiter', value: 'waiter' },
        { label: 'Chef', value: 'chef' },
        { label: 'Head Chef', value: 'head_chef' },
        { label: 'Manager', value: 'manager' },
    ],

    // API endpoints
    endpoints: {
        items: '/menu',
        transactions: '/order',
    },
};
