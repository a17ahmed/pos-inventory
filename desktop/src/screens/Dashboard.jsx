import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBusiness } from '../context/BusinessContext';
import { useAuth } from '../context/AuthContext';
import { getProducts } from '../services/api/products';
import { getReceiptStats, getTopProducts } from '../services/api/receipts';
import { createBill } from '../services/api/bills';
import { searchCustomers } from '../services/api/customers';
import { getExpenses as getApprovedExpenses } from '../services/api/expenses';
import { getPendingBills, createPendingBill, resumePendingBill, cancelPendingBill as cancelPendingBillApi } from '../services/api/pendingBills';
import {
    FiTrendingUp,
    FiShoppingCart,
    FiDollarSign,
    FiArrowUp,
    FiArrowDown,
    FiCalendar,
    FiSearch,
    FiPlus,
    FiMinus,
    FiTrash2,
    FiX,
    FiPause,
    FiCornerUpLeft,
    FiCheck,
    FiCreditCard,
    FiSmartphone,
    FiList,
    FiPhone,
    FiUser,
    FiUserCheck,
    FiPercent,
    FiChevronUp,
    FiChevronDown,
} from 'react-icons/fi';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
} from 'recharts';

// ==================== EMPLOYEE DASHBOARD - PREMIUM REDESIGN ====================
const EmployeeDashboard = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    // Billing state
    const [billingActive, setBillingActive] = useState(true); // Always show billing view
    const [bills, setBills] = useState([{
        id: '1',
        name: 'Bill 1',
        items: [],
        createdAt: new Date().toISOString(),
        customer: null,
        customerName: '',
        customerPhone: '',
        billDiscountAmount: 0,
        billDiscountReason: '',
    }]);

    // Cart item inline expansion (for profit details + per-item discount)
    const [expandedItemId, setExpandedItemId] = useState(null);

    // Customer picker
    const [showCustomerPicker, setShowCustomerPicker] = useState(false);
    const [customerQuery, setCustomerQuery] = useState('');
    const [customerResults, setCustomerResults] = useState([]);
    const [searchingCustomers, setSearchingCustomers] = useState(false);
    const [showWalkInConfirm, setShowWalkInConfirm] = useState(false);
    const customerPickerRef = useRef(null);
    const [activeBillId, setActiveBillId] = useState('1');
    const [billCounter, setBillCounter] = useState(1);

    // Products
    const [products, setProducts] = useState([]);
    const [productsCache, setProductsCache] = useState({});
    const [topProducts, setTopProducts] = useState([]);
    const [categories, setCategories] = useState(['All']);
    const [selectedCategory, setSelectedCategory] = useState('All');

    // Search
    const [searchQuery, setSearchQuery] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef(null);

    // Stats
    const [todayStats, setTodayStats] = useState({ totalSales: 0, transactions: 0 });
    const [loading, setLoading] = useState(true);

    // Payment Modal State
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [cashGiven, setCashGiven] = useState('');
    const [creditPaidNow, setCreditPaidNow] = useState('');
    const [processing, setProcessing] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [successData, setSuccessData] = useState(null);
    const cashInputRef = useRef(null);

    // Hold Bill Modal State
    const [showHoldModal, setShowHoldModal] = useState(false);
    const [holdCustomerName, setHoldCustomerName] = useState('');
    const [holdCustomerPhone, setHoldCustomerPhone] = useState('');
    const [holdAmountPaid, setHoldAmountPaid] = useState('');
    const [holdingBill, setHoldingBill] = useState(false);

    // Pending Bills Modal State
    const [showPendingModal, setShowPendingModal] = useState(false);
    const [pendingBills, setPendingBills] = useState([]);
    const [loadingPending, setLoadingPending] = useState(false);
    const [pendingBillId, setPendingBillId] = useState(null);
    const [resumedBillInfo, setResumedBillInfo] = useState(null);

    // Toast
    const [toast, setToast] = useState({ show: false, message: '', icon: '' });

    useEffect(() => {
        loadData();
        loadSavedBills();
        checkForPendingBillToLoad();
    }, []);

    // Debounced customer search
    useEffect(() => {
        if (!showCustomerPicker) return;
        const q = customerQuery.trim();
        if (q.length === 0) {
            setCustomerResults([]);
            return;
        }
        setSearchingCustomers(true);
        const timer = setTimeout(async () => {
            try {
                const res = await searchCustomers(q);
                setCustomerResults(res.data || []);
            } catch (err) {
                console.error('Customer search error:', err);
                setCustomerResults([]);
                const msg = err?.response?.data?.message || 'Failed to search customers';
                showToast(msg);
            } finally {
                setSearchingCustomers(false);
            }
        }, 250);
        return () => clearTimeout(timer);
    }, [customerQuery, showCustomerPicker]);

    // Close customer picker on outside click
    useEffect(() => {
        if (!showCustomerPicker) return;
        const handler = (e) => {
            if (customerPickerRef.current && !customerPickerRef.current.contains(e.target)) {
                setShowCustomerPicker(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showCustomerPicker]);

    const showToast = (message, icon = '✦') => {
        setToast({ show: true, message, icon });
        setTimeout(() => setToast({ show: false, message: '', icon: '' }), 2400);
    };

    const checkForPendingBillToLoad = () => {
        try {
            const pendingBillData = localStorage.getItem('pendingBillToLoad');
            if (pendingBillData) {
                const bill = JSON.parse(pendingBillData);
                localStorage.removeItem('pendingBillToLoad');

                const savedBills = localStorage.getItem('retailBills');
                const existingBills = savedBills ? JSON.parse(savedBills) : [];
                const maxNum = existingBills.length > 0
                    ? Math.max(...existingBills.map(b => parseInt(b.name.replace('Bill ', '')) || 0))
                    : 0;

                const newBill = {
                    id: Date.now().toString(),
                    name: bill.billName || `Bill ${maxNum + 1}`,
                    items: bill.items.map((item) => ({
                        _id: item._id,
                        name: item.name,
                        price: item.price,
                        qty: item.qty,
                        gst: item.gst || 0,
                        emoji: item.emoji || '📦',
                    })),
                    createdAt: new Date().toISOString()
                };

                const updatedBills = [...existingBills, newBill];
                setBillCounter(maxNum + 1);
                setBills(updatedBills);
                setActiveBillId(newBill.id);
                setBillingActive(true);
                setResumedBillInfo({
                    amountPaid: bill.amountPaid || 0,
                    remainingAmount: bill.remainingAmount || bill.total,
                    originalTotal: bill.total,
                    customerName: bill.customerName,
                    customerPhone: bill.customerPhone,
                });
                saveBills(updatedBills, newBill.id);
            }
        } catch (error) {
            console.error('Error loading pending bill:', error);
            localStorage.removeItem('pendingBillToLoad');
        }
    };

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            const currentBill = bills.find(b => b.id === activeBillId);
            const hasItems = currentBill?.items?.length > 0;
            const anyModalOpen = showPaymentModal || showHoldModal || showPendingModal;

            // Ctrl+K or Cmd+K - Focus search
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                inputRef.current?.focus();
                return;
            }

            // Ctrl+2 - Hold Bill
            if ((e.ctrlKey || e.metaKey) && e.key === '2' && hasItems && !anyModalOpen) {
                e.preventDefault();
                setShowHoldModal(true);
                return;
            }

            // Ctrl+3 - Pending Bills
            if ((e.ctrlKey || e.metaKey) && e.key === '3' && !anyModalOpen) {
                e.preventDefault();
                fetchPendingBills();
                setShowPendingModal(true);
                return;
            }

            // Ctrl+0 - Pay
            if ((e.ctrlKey || e.metaKey) && e.key === '0' && hasItems && !anyModalOpen) {
                e.preventDefault();
                setShowPaymentModal(true);
                setPaymentMethod('cash');
                setCashGiven('');
                return;
            }

            // Escape - Close modals
            if (e.key === 'Escape') {
                if (showSuccess) { setShowSuccess(false); setSuccessData(null); return; }
                if (showPaymentModal) { setShowPaymentModal(false); return; }
                if (showHoldModal) { setShowHoldModal(false); return; }
                if (showPendingModal) { setShowPendingModal(false); return; }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [bills, activeBillId, showPaymentModal, showHoldModal, showPendingModal, showSuccess]);

    useEffect(() => {
        if (showPaymentModal && paymentMethod === 'cash') {
            setTimeout(() => cashInputRef.current?.focus(), 100);
        }
    }, [showPaymentModal, paymentMethod]);

    const loadData = async () => {
        try {
            // Load products
            const productRes = await getProducts();
            const productList = productRes.data || [];
            setProducts(productList);

            // Build cache
            const cache = {};
            productList.forEach(p => {
                if (p.barcode) cache[p.barcode] = p;
                if (p.sku) cache[p.sku] = p;
                cache[p._id] = p;
            });
            setProductsCache(cache);

            // Extract categories
            const cats = ['All', ...new Set(productList.map(p => p.category).filter(Boolean))];
            setCategories(cats);

            // Load top products
            try {
                const topRes = await getTopProducts(12);
                if (topRes.data && topRes.data.length > 0) {
                    setTopProducts(topRes.data);
                } else {
                    // Fallback to first 12 products if no sales data
                    setTopProducts(productList.slice(0, 12).map(p => ({
                        _id: p._id,
                        name: p.name,
                        price: p.sellingPrice || p.price,
                        category: p.category || 'General',
                        emoji: p.emoji || getProductEmoji(p.category),
                    })));
                }
            } catch (err) {
                // Fallback
                setTopProducts(productList.slice(0, 12).map(p => ({
                    _id: p._id,
                    name: p.name,
                    price: p.sellingPrice || p.price,
                    category: p.category || 'General',
                    emoji: p.emoji || getProductEmoji(p.category),
                })));
            }

            // Load today's stats for sidebar revenue bar
            const todayStatsRes = await getReceiptStats({ filter: 'today' });
            setTodayStats({
                totalSales: todayStatsRes.data?.grossRevenue || 0,
                transactions: todayStatsRes.data?.totalOrders || 0,
            });
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const getProductEmoji = (category) => {
        const emojiMap = {
            'Drinks': '🥤',
            'Beverages': '🥤',
            'Snacks': '🍿',
            'Food': '🍔',
            'Electronics': '📱',
            'Stationery': '📝',
            'Misc': '📦',
            'General': '📦',
        };
        return emojiMap[category] || '📦';
    };

    const loadSavedBills = () => {
        try {
            const saved = localStorage.getItem('retailBills');
            const savedActiveId = localStorage.getItem('retailActiveBillId');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.length > 0) {
                    setBills(parsed);
                    const maxNum = Math.max(...parsed.map(b => parseInt(b.name.replace('Bill ', '')) || 0));
                    setBillCounter(maxNum);
                    setActiveBillId(savedActiveId && parsed.find(b => b.id === savedActiveId) ? savedActiveId : parsed[0].id);
                    setBillingActive(true);
                }
            }
        } catch (error) {
            console.error('Error loading saved bills:', error);
        }
    };

    const saveBills = (billsToSave, activeId) => {
        try {
            localStorage.setItem('retailBills', JSON.stringify(billsToSave));
            if (activeId !== undefined) {
                localStorage.setItem('retailActiveBillId', activeId || '');
            }
        } catch (error) {
            console.error('Error saving bills:', error);
        }
    };

    const createNewBill = () => {
        const newNum = billCounter + 1;
        const newBill = {
            id: Date.now().toString(),
            name: `Bill ${newNum}`,
            items: [],
            createdAt: new Date().toISOString(),
            customer: null,
            customerName: '',
            customerPhone: '',
            billDiscountAmount: 0,
            billDiscountReason: '',
        };
        setBillCounter(newNum);
        const updated = [...bills, newBill];
        setBills(updated);
        setActiveBillId(newBill.id);
        saveBills(updated, newBill.id);
        showToast('New bill created ✦');
    };

    const switchBill = (billId) => {
        setActiveBillId(billId);
        saveBills(bills, billId);
        const bill = bills.find(b => b.id === billId);
        showToast(`Switched to ${bill?.name || 'Bill'}`);
    };

    const deleteBill = (billId) => {
        if (bills.length === 1) {
            // Reset to empty bill
            const newBill = {
                id: Date.now().toString(),
                name: 'Bill 1',
                items: [],
                createdAt: new Date().toISOString(),
                customer: null,
                customerName: '',
                customerPhone: '',
                billDiscountAmount: 0,
                billDiscountReason: '',
            };
            setBills([newBill]);
            setActiveBillId(newBill.id);
            setBillCounter(1);
            saveBills([newBill], newBill.id);
        } else {
            // Filter out the deleted bill and renumber remaining bills
            const filtered = bills.filter(b => b.id !== billId);
            const updated = filtered.map((bill, index) => ({
                ...bill,
                name: `Bill ${index + 1}`
            }));
            const newActiveId = billId === activeBillId ? updated[0]?.id : activeBillId;
            setBills(updated);
            setActiveBillId(newActiveId);
            setBillCounter(updated.length);
            saveBills(updated, newActiveId);
        }
    };

    const addProductToBill = (product) => {
        if (!activeBillId) return;

        if (product.trackStock && product.stockQuantity <= 0) {
            showToast(`${product.name} is out of stock`);
            return;
        }

        const emoji = product.emoji || getProductEmoji(product.category);

        setBills(prev => {
            const updated = prev.map(bill => {
                if (bill.id === activeBillId) {
                    const existingIndex = bill.items.findIndex(item => item._id === product._id);
                    if (existingIndex >= 0) {
                        const currentQty = bill.items[existingIndex].qty;
                        if (product.trackStock && currentQty >= product.stockQuantity) {
                            showToast(`Only ${product.stockQuantity} in stock`);
                            return bill;
                        }
                        const newItems = [...bill.items];
                        newItems[existingIndex] = { ...newItems[existingIndex], qty: currentQty + 1 };
                        return { ...bill, items: newItems };
                    } else {
                        return {
                            ...bill,
                            items: [...bill.items, {
                                _id: product._id,
                                name: product.name,
                                price: product.sellingPrice || product.price,
                                costPrice: product.costPrice || 0,
                                gst: product.gst || 0,
                                qty: 1,
                                discountAmount: 0,
                                emoji: emoji,
                                barcode: product.barcode,
                                trackStock: product.trackStock,
                                stockQuantity: product.stockQuantity,
                                category: product.category,
                            }]
                        };
                    }
                }
                return bill;
            });
            saveBills(updated, activeBillId);
            return updated;
        });

        showToast(`${emoji} ${product.name} added`);
    };

    const updateQuantity = (itemId, delta) => {
        setBills(prev => {
            const updated = prev.map(bill => {
                if (bill.id === activeBillId) {
                    const newItems = bill.items.map(item => {
                        if (item._id === itemId) {
                            const newQty = item.qty + delta;
                            if (newQty <= 0) return null;
                            if (delta > 0 && item.trackStock && newQty > item.stockQuantity) {
                                showToast(`Only ${item.stockQuantity} in stock`);
                                return item;
                            }
                            return { ...item, qty: newQty };
                        }
                        return item;
                    }).filter(Boolean);
                    return { ...bill, items: newItems };
                }
                return bill;
            });
            saveBills(updated, activeBillId);
            return updated;
        });
    };

    const removeItem = (itemId) => {
        setBills(prev => {
            const updated = prev.map(bill => {
                if (bill.id === activeBillId) {
                    return { ...bill, items: bill.items.filter(item => item._id !== itemId) };
                }
                return bill;
            });
            saveBills(updated, activeBillId);
            return updated;
        });
    };

    // Mirrors the backend pre-save math so the UI stays consistent with what the
    // server will compute. Returns subtotal (after item discounts), tax, bill
    // discount, total, totalCost, billProfit.
    const getBillTotal = (bill) => {
        const gross = bill.items.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const itemDiscounts = bill.items.reduce((sum, item) => sum + (Number(item.discountAmount) || 0), 0);
        const subtotal = bill.items.reduce(
            (sum, item) => sum + (item.price * item.qty - (Number(item.discountAmount) || 0)),
            0
        );
        const tax = bill.items.reduce(
            (sum, item) => sum + (item.price * (item.gst || 0) / 100) * item.qty,
            0
        );
        const beforeBillDiscount = subtotal + tax;
        const billDiscount = Math.min(Number(bill.billDiscountAmount) || 0, beforeBillDiscount);
        const total = Math.max(0, beforeBillDiscount - billDiscount);
        const totalCost = bill.items.reduce((sum, item) => sum + (Number(item.costPrice) || 0) * item.qty, 0);
        const billProfit = total - totalCost;
        return {
            gross,
            itemDiscounts,
            subtotal,
            tax,
            billDiscount,
            total,
            totalCost,
            billProfit,
        };
    };

    // Compute per-item profit mirroring the backend (distributes bill-level
    // discount proportionally so profit stays correct either way).
    const getItemProfit = (bill, item) => {
        const lineGross = item.price * item.qty;
        const itemDiscount = Number(item.discountAmount) || 0;
        const lineAfterItemDiscount = Math.max(0, lineGross - itemDiscount);
        const totals = getBillTotal(bill);
        let share = 0;
        if (totals.billDiscount > 0 && totals.subtotal > 0) {
            share = (lineAfterItemDiscount / totals.subtotal) * totals.billDiscount;
        }
        const effectivePrice = (lineAfterItemDiscount - share) / (item.qty || 1);
        const profit = (effectivePrice - (Number(item.costPrice) || 0)) * item.qty;
        const margin = effectivePrice > 0 ? ((effectivePrice - (item.costPrice || 0)) / effectivePrice) * 100 : 0;
        return { effectivePrice, profit, margin, lineAfterItemDiscount };
    };

    // ── Mutators for new POS features ────────────────────────────
    const updateActiveBill = (updater) => {
        setBills((prev) => {
            const updated = prev.map((b) => (b.id === activeBillId ? updater(b) : b));
            saveBills(updated, activeBillId);
            return updated;
        });
    };

    const setItemDiscount = (itemId, amount) => {
        const amt = Math.max(0, Number(amount) || 0);
        updateActiveBill((bill) => {
            // Enforce: clearing bill-level discount when any item has a discount.
            const newItems = bill.items.map((i) => (i._id === itemId ? { ...i, discountAmount: amt } : i));
            const anyItemHasDiscount = newItems.some((i) => (Number(i.discountAmount) || 0) > 0);
            return {
                ...bill,
                items: newItems,
                billDiscountAmount: anyItemHasDiscount ? 0 : bill.billDiscountAmount,
                billDiscountReason: anyItemHasDiscount ? '' : bill.billDiscountReason,
            };
        });
    };

    const setBillDiscount = (amount, reason) => {
        const amt = Math.max(0, Number(amount) || 0);
        updateActiveBill((bill) => {
            // Enforce: clear all per-item discounts if setting a bill discount.
            const clearedItems =
                amt > 0
                    ? bill.items.map((i) => ({ ...i, discountAmount: 0 }))
                    : bill.items;
            return {
                ...bill,
                items: clearedItems,
                billDiscountAmount: amt,
                billDiscountReason: reason ?? bill.billDiscountReason,
            };
        });
    };

    const attachCustomer = (customer) => {
        updateActiveBill((bill) => ({
            ...bill,
            customer: customer?._id || null,
            customerName: customer?.name || '',
            customerPhone: customer?.phone || '',
        }));
        setShowCustomerPicker(false);
        setCustomerQuery('');
        setCustomerResults([]);
    };

    const detachCustomer = () => {
        updateActiveBill((bill) => ({
            ...bill,
            customer: null,
            customerName: '',
            customerPhone: '',
        }));
    };

    const fetchPendingBills = async () => {
        setLoadingPending(true);
        try {
            const res = await getPendingBills();
            setPendingBills((res.data || []).filter(b => b.status === 'pending'));
        } catch (error) {
            console.error('Error fetching pending bills:', error);
        } finally {
            setLoadingPending(false);
        }
    };

    const handleCheckout = async (confirmedWalkIn = false) => {
        const bill = bills.find(b => b.id === activeBillId);
        if (!bill || bill.items.length === 0) return;

        // Credit requires a real customer
        if (paymentMethod === 'credit' && !bill.customer) {
            showToast('Attach a customer to use credit');
            return;
        }

        // Walk-in guard: if no customer attached, confirm before proceeding
        // (credit mode already requires a customer, so it never trips this)
        if (!confirmedWalkIn && !bill.customer) {
            setShowWalkInConfirm(true);
            return;
        }

        const totals = getBillTotal(bill);
        const currentEffectiveTotal = resumedBillInfo ? resumedBillInfo.remainingAmount : totals.total;
        const currentChangeAmount = Math.max(0, parseFloat(cashGiven || 0) - currentEffectiveTotal);

        if (paymentMethod === 'cash' && parseFloat(cashGiven || 0) < currentEffectiveTotal) {
            showToast('Cash amount is less than total');
            return;
        }

        const idempotencyKey = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
        let amountPaid;
        if (paymentMethod === 'cash') {
            amountPaid = Math.min(parseFloat(cashGiven || 0), currentEffectiveTotal);
        } else if (paymentMethod === 'credit') {
            amountPaid = Math.max(0, Math.min(parseFloat(creditPaidNow || 0), currentEffectiveTotal));
        } else {
            amountPaid = currentEffectiveTotal;
        }

        // Backend only accepts: cash | card | online | store_credit
        // Map UI-only methods to backend-valid ones
        const backendPaymentMethod =
            paymentMethod === 'upi' ? 'online' :
            paymentMethod === 'credit' ? 'cash' :
            paymentMethod;

        setProcessing(true);
        try {
            const response = await createBill({
                items: bill.items.map((item) => ({
                    product: item._id,
                    name: item.name,
                    barcode: item.barcode || '',
                    category: item.category || 'General',
                    qty: item.qty,
                    price: item.price,
                    costPrice: Number(item.costPrice) || 0,
                    gst: item.gst || 0,
                    discountAmount: Number(item.discountAmount) || 0,
                })),
                status: 'completed',
                customer: bill.customer || null,
                customerName: bill.customerName || resumedBillInfo?.customerName || 'Walk-in',
                customerPhone: bill.customerPhone || resumedBillInfo?.customerPhone || '',
                billDiscountAmount: Number(bill.billDiscountAmount) || 0,
                billDiscountReason: bill.billDiscountReason || '',
                paymentMethod: backendPaymentMethod,
                amountPaid,
                cashGiven: paymentMethod === 'cash' ? parseFloat(cashGiven || 0) : 0,
                idempotencyKey,
            });

            if (pendingBillId) {
                try {
                    await resumePendingBill(pendingBillId);
                } catch (err) {
                    console.warn('Failed to mark pending bill:', err);
                }
                setPendingBillId(null);
                setResumedBillInfo(null);
            }

            // Reset bill
            if (bills.length > 1) {
                const updated = bills.filter(b => b.id !== bill.id);
                setBills(updated);
                setActiveBillId(updated[0]?.id);
                saveBills(updated, updated[0]?.id);
            } else {
                const newBill = {
                    id: Date.now().toString(),
                    name: 'Bill 1',
                    items: [],
                    createdAt: new Date().toISOString(),
                    customer: null,
                    customerName: '',
                    customerPhone: '',
                    billDiscountAmount: 0,
                    billDiscountReason: '',
                };
                setBills([newBill]);
                setActiveBillId(newBill.id);
                setBillCounter(1);
                saveBills([newBill], newBill.id);
            }

            setSuccessData({
                billNumber: response.data?.billNumber,
                total: currentEffectiveTotal,
                cashGiven: parseFloat(cashGiven || 0),
                change: currentChangeAmount,
                paymentMethod,
            });
            setShowPaymentModal(false);
            setCashGiven('');
            setCreditPaidNow('');
            setPaymentMethod('cash');
            setShowSuccess(true);

            loadData();

            setTimeout(() => {
                setShowSuccess(false);
                setSuccessData(null);
            }, 3000);
        } catch (error) {
            console.error('Checkout error:', error);
            if (error.response?.status === 409) {
                showToast('Bill already paid');
                deleteBill(bill.id);
            } else {
                showToast(error.response?.data?.message || 'Failed to complete sale');
            }
        } finally {
            setProcessing(false);
        }
    };

    const handleHoldBill = async () => {
        const bill = bills.find(b => b.id === activeBillId);
        if (!bill || bill.items.length === 0) return;

        const { subtotal, tax, total } = getBillTotal(bill);

        setHoldingBill(true);
        try {
            await createPendingBill({
                billName: bill.name,
                items: bill.items.map((item) => ({
                    _id: item._id,
                    name: item.name,
                    price: item.price,
                    qty: item.qty,
                    gst: item.gst || 0,
                })),
                customerName: holdCustomerName.trim() || 'Walk-in Customer',
                customerPhone: holdCustomerPhone.trim(),
                subtotal,
                tax,
                total,
                amountPaid: parseFloat(holdAmountPaid) || 0,
                employeeName: user?.name || 'Staff',
                employeeId: user?._id,
            });

            // Reset bill
            if (bills.length > 1) {
                const updated = bills.filter(b => b.id !== bill.id);
                setBills(updated);
                setActiveBillId(updated[0]?.id);
                saveBills(updated, updated[0]?.id);
            } else {
                const newBill = {
                    id: Date.now().toString(),
                    name: 'Bill 1',
                    items: [],
                    createdAt: new Date().toISOString(),
                    customer: null,
                    customerName: '',
                    customerPhone: '',
                    billDiscountAmount: 0,
                    billDiscountReason: '',
                };
                setBills([newBill]);
                setActiveBillId(newBill.id);
                saveBills([newBill], newBill.id);
            }

            setShowHoldModal(false);
            setHoldCustomerName('');
            setHoldCustomerPhone('');
            setHoldAmountPaid('');
            showToast('🔖 Bill held');
        } catch (error) {
            showToast('Failed to save pending bill');
        } finally {
            setHoldingBill(false);
        }
    };

    const loadPendingBill = async (bill) => {
        try {
            await resumePendingBill(bill._id);
        } catch (err) {
            console.warn('Failed to mark pending bill:', err);
        }

        const newBill = {
            id: Date.now().toString(),
            name: bill.billName || `Bill ${billCounter + 1}`,
            items: bill.items.map((item) => ({
                _id: item._id,
                name: item.name,
                price: item.price,
                qty: item.qty,
                gst: item.gst || 0,
                emoji: item.emoji || '📦',
            })),
            createdAt: new Date().toISOString()
        };

        setBillCounter(prev => prev + 1);
        setBills(prev => [...prev, newBill]);
        setActiveBillId(newBill.id);
        setPendingBillId(null);
        setResumedBillInfo({
            amountPaid: bill.amountPaid || 0,
            remainingAmount: bill.remainingAmount || bill.total,
            originalTotal: bill.total,
            customerName: bill.customerName,
            customerPhone: bill.customerPhone,
        });
        saveBills([...bills, newBill], newBill.id);
        setShowPendingModal(false);
        showToast('📋 Bill loaded');
    };

    const handleCancelPendingBill = async (billId) => {
        if (!window.confirm('Cancel this pending bill?')) return;
        try {
            await cancelPendingBillApi(billId);
            setPendingBills((prev) => prev.filter((b) => b._id !== billId));
            showToast('Bill cancelled');
        } catch (error) {
            showToast('Failed to cancel bill');
        }
    };

    const activeBill = bills.find(b => b.id === activeBillId);
    const activeTotal = activeBill ? getBillTotal(activeBill) : { subtotal: 0, tax: 0, total: 0 };
    const activeItemCount = activeBill ? activeBill.items.reduce((sum, item) => sum + item.qty, 0) : 0;
    const effectiveTotal = resumedBillInfo ? resumedBillInfo.remainingAmount : activeTotal.total;
    const changeAmount = Math.max(0, parseFloat(cashGiven || 0) - effectiveTotal);

    const formatCurrency = (amount) => `Rs. ${(amount || 0).toLocaleString()}`;

    // Search suggestions
    const suggestions = searchQuery.trim().length >= 2
        ? products.filter(p =>
            p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.barcode?.includes(searchQuery) ||
            p.sku?.includes(searchQuery)
        ).slice(0, 8)
        : [];

    const isBarcodeLike = (value) => /^\d{4,}$/.test(value.trim());

    const handleBarcodeInput = (e) => {
        const value = e.target.value;
        setSearchQuery(value);
        setSelectedIndex(0);

        if (value.trim()) {
            const product = productsCache[value.trim()];
            if (product) {
                addProductToBill(product);
                setSearchQuery('');
                setShowSuggestions(false);
                return;
            }
        }

        if (value.trim().length >= 2 && !isBarcodeLike(value)) {
            setShowSuggestions(true);
        } else {
            setShowSuggestions(false);
        }
    };

    const selectSuggestion = (product) => {
        addProductToBill(product);
        setSearchQuery('');
        setShowSuggestions(false);
        inputRef.current?.focus();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            setShowSuggestions(false);
            setSearchQuery('');
            return;
        }

        if (showSuggestions && suggestions.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % suggestions.length);
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                selectSuggestion(suggestions[selectedIndex]);
                return;
            }
        }

        if (e.key === 'Enter' && searchQuery.trim()) {
            let product = productsCache[searchQuery.trim()];
            if (!product) {
                product = products.find(p =>
                    p.barcode === searchQuery.trim() ||
                    p.sku === searchQuery.trim() ||
                    p.name?.toLowerCase() === searchQuery.toLowerCase().trim()
                );
            }
            if (product) {
                addProductToBill(product);
                setSearchQuery('');
                setShowSuggestions(false);
            } else if (suggestions.length > 0) {
                selectSuggestion(suggestions[0]);
            } else {
                showToast(`Product not found: ${searchQuery}`);
            }
        }
    };

    // Filter products for Quick Add
    // When "All" is selected, show top selling products
    // When a category is selected, show products from that category
    const filteredQuickAddProducts = selectedCategory === 'All'
        ? topProducts
        : products
            .filter(p => p.category?.toLowerCase() === selectedCategory.toLowerCase())
            .slice(0, 12)
            .map(p => ({
                _id: p._id,
                name: p.name,
                price: p.sellingPrice || p.price,
                category: p.category,
                emoji: p.emoji || '📦',
            }));

    // Target progress
    const target = 5000;
    const progressPercent = Math.min(100, (todayStats.totalSales / target) * 100);

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-d-bg animate-fade-slide-up">
            {/* Topbar */}
            <div className="relative z-40 flex items-center gap-4 px-6 py-3 border-b border-slate-200 dark:border-d-border bg-white/70 dark:bg-[rgba(11,14,26,0.7)] backdrop-blur-xl flex-shrink-0">
                {/* Live Badge */}
                <div className="flex items-center gap-2 bg-emerald-50 dark:bg-[rgba(52,232,161,0.08)] border border-emerald-200 dark:border-[rgba(52,232,161,0.2)] rounded-full px-3 py-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-d-green animate-live-pulse" />
                    <span className="text-[13px] font-medium text-emerald-600 dark:text-d-green">Live</span>
                </div>

                {/* Today's Stats */}
                <div className="flex items-center gap-2 text-[13px] text-slate-500 dark:text-d-muted">
                    <span className="font-display text-[17px] font-semibold text-amber-600 dark:text-d-accent tracking-wide">
                        {formatCurrency(todayStats.totalSales)}
                    </span>
                    <span className="text-slate-300 dark:text-d-faint">·</span>
                    <span>{todayStats.transactions} sales today</span>
                </div>

                {/* Customer Picker */}
                <div className="relative ml-auto" ref={customerPickerRef}>
                    {activeBill?.customer ? (
                        <button
                            onClick={() => setShowCustomerPicker((o) => !o)}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-d-border bg-white dark:bg-d-glass text-[13px] hover:border-amber-300 dark:hover:border-d-border-hover transition-all"
                        >
                            <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-[rgba(52,232,161,0.15)] flex items-center justify-center">
                                <FiUserCheck className="text-emerald-600 dark:text-d-green" size={12} />
                            </div>
                            <div className="leading-tight text-left">
                                <div className="font-medium text-slate-800 dark:text-d-text">{activeBill.customerName}</div>
                                {activeBill.customerPhone && (
                                    <div className="text-[10px] text-slate-400 dark:text-d-faint">{activeBill.customerPhone}</div>
                                )}
                            </div>
                            <span
                                role="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    detachCustomer();
                                }}
                                className="ml-1 w-5 h-5 rounded-full flex items-center justify-center text-slate-400 dark:text-d-faint hover:bg-red-50 dark:hover:bg-[rgba(255,107,107,0.12)] hover:text-red-500 cursor-pointer"
                                title="Remove customer"
                            >
                                <FiX size={12} />
                            </span>
                        </button>
                    ) : (
                        <button
                            onClick={() => setShowCustomerPicker((o) => !o)}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-400 dark:border-d-accent bg-amber-50/40 dark:bg-[rgba(255,185,50,0.05)] text-[13px] text-amber-700 dark:text-d-accent hover:bg-amber-50 dark:hover:bg-[rgba(255,185,50,0.1)] transition-all"
                        >
                            <FiUser size={13} />
                            <span className="font-semibold">Select Customer</span>
                            <FiChevronDown size={12} />
                        </button>
                    )}
                    {showCustomerPicker && (
                        <>
                            <div className="absolute right-0 top-full mt-2 w-[340px] bg-white dark:bg-d-elevated border border-slate-200 dark:border-d-border rounded-2xl shadow-2xl z-[100] overflow-hidden">
                                <div className="p-3 border-b border-slate-200 dark:border-d-border">
                                    <input
                                        type="text"
                                        autoFocus
                                        value={customerQuery}
                                        onChange={(e) => setCustomerQuery(e.target.value)}
                                        placeholder="Search by name or phone…"
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-lg text-sm text-slate-800 dark:text-d-text placeholder-slate-400 dark:placeholder-d-faint focus:outline-none focus:border-amber-300 dark:focus:border-d-border-hover"
                                    />
                                </div>
                                <div className="max-h-[260px] overflow-y-auto dark-scrollbar">
                                    {searchingCustomers && (
                                        <div className="px-4 py-3 text-xs text-slate-400 dark:text-d-faint">Searching…</div>
                                    )}
                                    {!searchingCustomers && customerQuery && customerResults.length === 0 && (
                                        <div className="px-4 py-3 text-xs text-slate-400 dark:text-d-faint">No customers found</div>
                                    )}
                                    {!searchingCustomers && !customerQuery && (
                                        <div className="px-4 py-3 text-xs text-slate-400 dark:text-d-faint">Type to search customers</div>
                                    )}
                                    {customerResults.map((c) => (
                                        <button
                                            key={c._id}
                                            onClick={() => attachCustomer(c)}
                                            className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-d-glass border-t border-slate-100 dark:border-[rgba(255,255,255,0.04)] flex items-center justify-between"
                                        >
                                            <div>
                                                <div className="text-sm font-medium text-slate-800 dark:text-d-text">{c.name}</div>
                                                <div className="text-[11px] text-slate-500 dark:text-d-muted">{c.phone}</div>
                                            </div>
                                            {c.balance > 0 && (
                                                <span className="text-[11px] font-medium text-red-500 dark:text-d-red">
                                                    Due {formatCurrency(c.balance)}
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                                <div className="p-2 border-t border-slate-200 dark:border-d-border bg-slate-50 dark:bg-d-bg">
                                    <button
                                        onClick={() => attachCustomer(null)}
                                        className="w-full px-3 py-2 text-xs text-slate-500 dark:text-d-muted hover:text-slate-700 dark:hover:text-d-text"
                                    >
                                        Use Walk-in customer
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Bill Tabs */}
                <div className="flex items-center gap-2">
                    {bills.map((bill) => {
                        const isActive = bill.id === activeBillId;
                        const itemCount = bill.items.reduce((sum, item) => sum + item.qty, 0);
                        return (
                            <div
                                key={bill.id}
                                className={`group flex items-center gap-1 pl-4 pr-2 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 cursor-pointer ${
                                    isActive
                                        ? 'bg-gradient-to-r from-amber-400 to-amber-500 dark:from-d-accent dark:to-d-accent-s text-white dark:text-d-card font-bold shadow-md dark:shadow-[0_4px_16px_rgba(255,185,50,0.35)]'
                                        : 'border border-slate-200 dark:border-d-border text-slate-600 dark:text-d-muted hover:bg-slate-100 dark:hover:bg-d-glass hover:text-slate-800 dark:hover:text-d-text'
                                }`}
                                onClick={() => switchBill(bill.id)}
                            >
                                <span>{bill.name}</span>
                                {itemCount > 0 && !isActive && (
                                    <span className="bg-amber-500 dark:bg-d-accent text-white dark:text-d-card text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                        {itemCount}
                                    </span>
                                )}
                                {bills.length > 1 && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (bill.items.length > 0) {
                                                if (window.confirm(`Cancel ${bill.name} with ${bill.items.length} items?`)) {
                                                    deleteBill(bill.id);
                                                }
                                            } else {
                                                deleteBill(bill.id);
                                            }
                                        }}
                                        className={`ml-1 w-5 h-5 rounded-full flex items-center justify-center text-xs transition-all ${
                                            isActive
                                                ? 'hover:bg-[rgba(0,0,0,0.15)] text-white/70 dark:text-d-muted hover:text-white dark:hover:text-d-heading'
                                                : 'opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-[rgba(255,107,107,0.15)] text-slate-400 dark:text-d-muted hover:text-red-500 dark:hover:text-d-red'
                                        }`}
                                        title={`Close ${bill.name}`}
                                    >
                                        ×
                                    </button>
                                )}
                            </div>
                        );
                    })}
                    <button
                        onClick={createNewBill}
                        className="w-[34px] h-[34px] rounded-lg border border-slate-200 dark:border-d-border bg-slate-50 dark:bg-d-glass text-slate-500 dark:text-d-muted flex items-center justify-center text-lg hover:border-amber-300 dark:hover:border-d-border-hover hover:text-amber-600 dark:hover:text-d-accent hover:bg-amber-50 dark:hover:bg-[rgba(255,210,100,0.12)] transition-all duration-200"
                    >
                        +
                    </button>
                </div>

                {/* Returns */}
                <button
                    onClick={() => navigate('/returns')}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-d-border bg-d-glass text-d-muted text-[13px] font-medium hover:bg-[rgba(255,255,255,0.06)] hover:text-d-text transition-all duration-200"
                >
                    <FiCornerUpLeft size={14} />
                    Returns
                </button>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Cart Panel (Left) */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Search Box */}
                    <div className="p-5 pb-4">
                        <div className="relative">
                            <FiSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-d-faint transition-colors" size={17} />
                            <input
                                ref={inputRef}
                                type="text"
                                value={searchQuery}
                                onChange={handleBarcodeInput}
                                onKeyDown={handleKeyDown}
                                onFocus={() => searchQuery.length >= 2 && !isBarcodeLike(searchQuery) && setShowSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                placeholder="Scan barcode or type product name..."
                                className="w-full py-4 px-5 pl-14 bg-white dark:bg-d-elevated border border-slate-200 dark:border-d-border rounded-2xl text-[14px] text-slate-800 dark:text-d-text placeholder-slate-400 dark:placeholder-d-faint outline-none focus:border-amber-300 dark:focus:border-d-border-hover focus:bg-amber-50/30 dark:focus:bg-[rgba(255,210,100,0.03)] focus:shadow-[0_0_0_4px_rgba(245,158,11,0.1)] dark:focus:shadow-[0_0_0_4px_rgba(255,185,50,0.07),0_8px_32px_rgba(0,0,0,0.35)] transition-all duration-300"
                                autoFocus
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                <span className="text-[10px] text-slate-400 dark:text-d-faint bg-slate-100 dark:bg-[rgba(255,255,255,0.05)] border border-slate-200 dark:border-d-border px-2 py-1 rounded">⌘K</span>
                            </div>

                            {/* Suggestions Dropdown */}
                            {showSuggestions && suggestions.length > 0 && (
                                <div className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-d-elevated border border-slate-200 dark:border-d-border rounded-2xl overflow-hidden z-50 max-h-80 overflow-y-auto shadow-xl">
                                    {suggestions.map((product, index) => {
                                        const outOfStock = product.trackStock && (product.stockQuantity || 0) <= 0;
                                        return (
                                            <div
                                                key={product._id}
                                                onClick={() => !outOfStock && selectSuggestion(product)}
                                                className={`flex items-center gap-4 px-5 py-4 cursor-pointer transition-all ${
                                                    index === selectedIndex ? 'bg-amber-50 dark:bg-[rgba(255,210,100,0.08)]' : 'hover:bg-slate-50 dark:hover:bg-d-glass'
                                                } ${outOfStock ? 'opacity-50 cursor-not-allowed' : ''} ${
                                                    index > 0 ? 'border-t border-slate-100 dark:border-[rgba(255,255,255,0.05)]' : ''
                                                }`}
                                            >
                                                <span className="text-2xl">{product.emoji || getProductEmoji(product.category)}</span>
                                                <div className="flex-1">
                                                    <h4 className="font-medium text-slate-800 dark:text-d-text">{product.name}</h4>
                                                    <p className="text-sm text-slate-500 dark:text-d-muted">{formatCurrency(product.sellingPrice || product.price)}</p>
                                                </div>
                                                {!outOfStock && (
                                                    <div className="w-6 h-6 rounded-full bg-amber-500 dark:bg-d-accent text-white dark:text-d-card flex items-center justify-center text-sm">+</div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Cart Items */}
                    <div className="flex-1 overflow-y-auto px-5 pb-4 dark-scrollbar">
                        {activeBill?.items.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center pb-10">
                                <div className="w-[100px] h-[100px] rounded-full border-2 border-amber-200 dark:border-[rgba(255,210,100,0.15)] flex items-center justify-center relative animate-spin-ring">
                                    <div className="absolute inset-[-2px] rounded-full border-2 border-transparent border-t-amber-500 dark:border-t-d-accent animate-spin-fast" />
                                    <div className="w-[70px] h-[70px] rounded-full bg-gradient-to-br from-amber-100 dark:from-[rgba(255,210,100,0.1)] to-amber-50 dark:to-[rgba(255,185,50,0.05)] border border-amber-200 dark:border-[rgba(255,210,100,0.12)] flex items-center justify-center text-3xl animate-spin-ring-reverse">
                                        🛒
                                    </div>
                                </div>
                                <h3 className="font-display text-xl font-semibold text-slate-700 dark:text-d-heading mt-6">Cart is empty</h3>
                                <p className="text-[13px] text-slate-500 dark:text-d-muted mt-2 text-center max-w-[210px] leading-relaxed">
                                    Scan a barcode, search by name, or pick from Quick Add →
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {activeBill?.items.map((item) => {
                                    const expanded = expandedItemId === item._id;
                                    const profitInfo = getItemProfit(activeBill, item);
                                    const hasItemDiscount = (Number(item.discountAmount) || 0) > 0;
                                    const hasBillDiscount = (Number(activeBill.billDiscountAmount) || 0) > 0;
                                    return (
                                        <div
                                            key={item._id}
                                            className="bg-white dark:bg-d-elevated border border-slate-200 dark:border-d-border rounded-2xl animate-pop-in hover:border-amber-400 dark:hover:border-d-border-hover hover:bg-amber-50 dark:hover:bg-[rgba(255,210,100,0.03)] transition-all duration-200 relative overflow-hidden shadow-sm"
                                            style={{ '--item-color': item.category === 'Drinks' ? '#5b9cf6' : '#f59e0b' }}
                                        >
                                            <div className="absolute top-0 left-0 bottom-0 w-[3px] rounded-l bg-[var(--item-color,#f59e0b)] dark:bg-[var(--item-color,#ffd264)]" />
                                            <div
                                                onClick={() => setExpandedItemId(expanded ? null : item._id)}
                                                className="flex items-center gap-4 p-4 cursor-pointer"
                                            >
                                                <span className="text-2xl flex-shrink-0">{item.emoji || '📦'}</span>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-medium text-[14px] text-slate-800 dark:text-d-text truncate">{item.name}</h4>
                                                    <p className="text-[11px] text-slate-500 dark:text-d-muted tracking-wide">
                                                        {item._id?.slice(-4)} · {formatCurrency(item.price)} each
                                                        {hasItemDiscount && (
                                                            <span className="ml-2 text-emerald-500 dark:text-d-green">
                                                                − {formatCurrency(item.discountAmount)} off
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                    <button
                                                        onClick={() => updateQuantity(item._id, -1)}
                                                        className="w-7 h-7 rounded-lg border border-slate-300 dark:border-d-border bg-slate-100 dark:bg-d-glass text-slate-700 dark:text-d-text flex items-center justify-center hover:border-amber-400 dark:hover:border-d-border-hover hover:text-amber-600 dark:hover:text-d-accent hover:bg-amber-100 dark:hover:bg-[rgba(255,210,100,0.12)] transition-all"
                                                    >
                                                        −
                                                    </button>
                                                    <span className="font-display font-semibold text-base min-w-[22px] text-center text-slate-800 dark:text-d-text">{item.qty}</span>
                                                    <button
                                                        onClick={() => updateQuantity(item._id, 1)}
                                                        className="w-7 h-7 rounded-lg border border-slate-300 dark:border-d-border bg-slate-100 dark:bg-d-glass text-slate-700 dark:text-d-text flex items-center justify-center hover:border-amber-400 dark:hover:border-d-border-hover hover:text-amber-600 dark:hover:text-d-accent hover:bg-amber-100 dark:hover:bg-[rgba(255,210,100,0.12)] transition-all"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                                <span className="font-display text-[15px] font-semibold text-amber-600 dark:text-d-accent min-w-[80px] text-right">
                                                    {formatCurrency(profitInfo.lineAfterItemDiscount)}
                                                </span>
                                                <div onClick={(e) => e.stopPropagation()}>
                                                    <button
                                                        onClick={() => removeItem(item._id)}
                                                        className="text-slate-400 dark:text-d-faint hover:text-red-500 dark:hover:text-d-red transition-colors text-lg p-1"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            </div>

                                            {expanded && (
                                                <div className="px-4 pb-4 pt-0 border-t border-slate-100 dark:border-[rgba(255,255,255,0.05)] animate-fade-slide-up">
                                                    <div className="grid grid-cols-4 gap-3 mt-3 mb-3">
                                                        <div>
                                                            <div className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-d-faint">Cost</div>
                                                            <div className="text-[13px] font-semibold text-slate-700 dark:text-d-text">{formatCurrency(item.costPrice || 0)}</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-d-faint">Sell</div>
                                                            <div className="text-[13px] font-semibold text-slate-700 dark:text-d-text">{formatCurrency(item.price)}</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-d-faint">Profit</div>
                                                            <div className={`text-[13px] font-semibold ${profitInfo.profit >= 0 ? 'text-emerald-500 dark:text-d-green' : 'text-red-500 dark:text-d-red'}`}>
                                                                {formatCurrency(profitInfo.profit)}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-d-faint">Margin</div>
                                                            <div className={`text-[13px] font-semibold ${profitInfo.margin >= 0 ? 'text-emerald-500 dark:text-d-green' : 'text-red-500 dark:text-d-red'}`}>
                                                                {profitInfo.margin.toFixed(1)}%
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <label className="text-[11px] text-slate-500 dark:text-d-muted flex-shrink-0">Discount (Rs)</label>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={item.discountAmount || ''}
                                                            onChange={(e) => setItemDiscount(item._id, e.target.value)}
                                                            disabled={hasBillDiscount}
                                                            placeholder="0"
                                                            className="flex-1 px-3 py-2 bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-lg text-sm text-slate-800 dark:text-d-text placeholder-slate-400 dark:placeholder-d-faint focus:outline-none focus:border-amber-300 dark:focus:border-d-border-hover disabled:opacity-50 disabled:cursor-not-allowed"
                                                        />
                                                        {hasBillDiscount && (
                                                            <span className="text-[10px] text-slate-400 dark:text-d-faint">
                                                                Bill-level discount active
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Quick Add Panel (Right) */}
                <div className="w-[270px] border-l border-slate-200 dark:border-d-border flex flex-col bg-slate-50/50 dark:bg-[rgba(10,11,18,0.4)] backdrop-blur-lg flex-shrink-0 animate-fade-slide-right">
                    {/* Header */}
                    <div className="p-5 pb-3 border-b border-slate-200 dark:border-d-border">
                        <h3 className="text-[11px] font-bold tracking-[0.12em] uppercase text-slate-400 dark:text-d-faint mb-3">Quick Add</h3>
                        <div className="flex flex-wrap gap-1">
                            {categories.slice(0, 4).map((cat) => (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`px-3 py-1 rounded-full text-[11px] font-medium border transition-all duration-200 ${
                                        selectedCategory === cat
                                            ? 'bg-amber-100 dark:bg-[rgba(255,210,100,0.12)] border-amber-300 dark:border-d-border-hover text-amber-600 dark:text-d-accent'
                                            : 'border-slate-200 dark:border-d-border text-slate-500 dark:text-d-muted hover:bg-slate-100 dark:hover:bg-d-glass hover:text-slate-700 dark:hover:text-d-text'
                                    }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Product Grid */}
                    <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-2 auto-rows-min dark-scrollbar">
                        {filteredQuickAddProducts.map((product) => (
                            <div
                                key={product._id || product.name}
                                onClick={() => {
                                    // Try to find by ID first, then by name as fallback
                                    const fullProduct = products.find(p => p._id === product._id)
                                        || products.find(p => p.name === product.name)
                                        || product;
                                    // Skip if no valid _id (can't track stock properly)
                                    if (!fullProduct._id || fullProduct._id === fullProduct.name) {
                                        showToast('Product not found in inventory');
                                        return;
                                    }
                                    addProductToBill(fullProduct);
                                }}
                                className="bg-white dark:bg-d-elevated border border-slate-200 dark:border-d-border rounded-2xl p-3 cursor-pointer flex flex-col gap-2 transition-all duration-200 hover:border-amber-300 dark:hover:border-d-border-hover hover:-translate-y-1 hover:shadow-lg dark:hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] relative overflow-hidden group"
                            >
                                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-amber-100/50 dark:from-[rgba(255,210,100,0.08)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                <span className="text-2xl">{product.emoji || getProductEmoji(product.category)}</span>
                                <span className="text-[12px] font-medium text-slate-700 dark:text-d-text leading-tight">{product.name}</span>
                                <span className="font-display text-[13px] font-semibold text-amber-600 dark:text-d-accent">{formatCurrency(product.price)}</span>
                                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-amber-500 dark:bg-d-accent text-white dark:text-d-card flex items-center justify-center text-xs opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200">
                                    +
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Stats Strip */}
                    <div className="p-4 border-t border-slate-200 dark:border-d-border bg-white/50 dark:bg-[rgba(11,14,26,0.5)]">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[11px] text-slate-500 dark:text-d-muted">Today's Revenue</span>
                            <span className="font-display text-[14px] font-semibold text-amber-600 dark:text-d-accent">{formatCurrency(todayStats.totalSales)}</span>
                        </div>
                        <div className="h-1 bg-slate-200 dark:bg-d-faint rounded-full overflow-hidden mb-2">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 dark:from-d-accent dark:to-d-accent-s transition-all duration-700"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[11px] text-slate-500 dark:text-d-muted">Target: {formatCurrency(target)}</span>
                            <span className="font-display text-[12px] font-semibold text-emerald-500 dark:text-d-green">{progressPercent.toFixed(0)}%</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Cart Footer */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-d-border bg-white/80 dark:bg-[rgba(11,14,26,0.6)] backdrop-blur-lg flex-shrink-0">
                {/* Resumed bill info */}
                {resumedBillInfo && (
                    <div className="mb-3 p-3 bg-blue-50 dark:bg-[rgba(91,156,246,0.1)] border border-blue-200 dark:border-[rgba(91,156,246,0.2)] rounded-xl">
                        <p className="text-blue-600 dark:text-d-blue font-medium text-sm">Resumed Bill · Paid: {formatCurrency(resumedBillInfo.amountPaid)} · Due: {formatCurrency(resumedBillInfo.remainingAmount)}</p>
                    </div>
                )}

                {/* Totals */}
                <div className="flex flex-col gap-2 mb-4">
                    <div className="flex justify-between text-[13px]">
                        <span className="text-slate-500 dark:text-d-muted">Subtotal ({activeItemCount} items)</span>
                        <span className="font-medium text-slate-700 dark:text-d-text">{formatCurrency(activeTotal.gross)}</span>
                    </div>

                    {activeTotal.itemDiscounts > 0 && (
                        <div className="flex justify-between text-[13px]">
                            <span className="text-slate-500 dark:text-d-muted">Item discounts</span>
                            <span className="text-emerald-500 dark:text-d-green">— {formatCurrency(activeTotal.itemDiscounts)}</span>
                        </div>
                    )}

                    {/* Bill-level discount input */}
                    <div className="flex justify-between items-center text-[13px]">
                        <div className="flex items-center gap-2 text-slate-500 dark:text-d-muted">
                            <FiPercent size={12} />
                            <span>Bill discount</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={activeBill?.billDiscountAmount || ''}
                                onChange={(e) => setBillDiscount(e.target.value, activeBill?.billDiscountReason || '')}
                                disabled={activeTotal.itemDiscounts > 0 || !activeBill || activeBill.items.length === 0}
                                placeholder="0"
                                className="w-20 px-2 py-1 text-right bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-lg text-slate-800 dark:text-d-text placeholder-slate-400 dark:placeholder-d-faint focus:outline-none focus:border-amber-300 dark:focus:border-d-border-hover disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            {activeTotal.billDiscount > 0 && (
                                <span className="text-emerald-500 dark:text-d-green text-[11px] min-w-[55px] text-right">
                                    — {formatCurrency(activeTotal.billDiscount)}
                                </span>
                            )}
                        </div>
                    </div>

                    {activeTotal.itemDiscounts > 0 && (
                        <div className="text-[10px] text-slate-400 dark:text-d-faint italic">
                            Bill discount disabled — clear item discounts to use it
                        </div>
                    )}

                    {activeTotal.billDiscount > 0 && (
                        <input
                            type="text"
                            value={activeBill?.billDiscountReason || ''}
                            onChange={(e) => setBillDiscount(activeBill?.billDiscountAmount || 0, e.target.value)}
                            placeholder="Discount reason (optional)"
                            className="px-2 py-1 bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-lg text-[11px] text-slate-800 dark:text-d-text placeholder-slate-400 dark:placeholder-d-faint focus:outline-none focus:border-amber-300 dark:focus:border-d-border-hover"
                        />
                    )}

                    {activeTotal.tax > 0 && (
                        <div className="flex justify-between text-[13px]">
                            <span className="text-slate-500 dark:text-d-muted">Tax</span>
                            <span className="text-slate-700 dark:text-d-text">{formatCurrency(activeTotal.tax)}</span>
                        </div>
                    )}

                    {activeBill && activeBill.items.length > 0 && (
                        <div className="flex justify-between text-[13px]">
                            <span className="text-slate-500 dark:text-d-muted">Bill profit</span>
                            <span className={`font-medium ${activeTotal.billProfit >= 0 ? 'text-emerald-500 dark:text-d-green' : 'text-red-500 dark:text-d-red'}`}>
                                {formatCurrency(activeTotal.billProfit)}
                            </span>
                        </div>
                    )}

                    <div className="flex justify-between items-end pt-3 mt-1 border-t border-slate-200 dark:border-d-border">
                        <span className="font-display text-[15px] font-semibold text-slate-800 dark:text-d-text">Total</span>
                        <span className="font-display text-[28px] font-bold text-amber-600 dark:text-d-accent leading-none tracking-tight">{formatCurrency(effectiveTotal)}</span>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                    <button
                        onClick={() => setShowHoldModal(true)}
                        disabled={!activeBill || activeBill.items.length === 0}
                        className="flex-1 py-3.5 px-4 rounded-xl bg-amber-50 dark:bg-[rgba(255,210,100,0.08)] border border-amber-200 dark:border-[rgba(255,210,100,0.2)] text-amber-600 dark:text-d-accent font-semibold text-[13px] flex items-center justify-center gap-2 hover:bg-amber-100 dark:hover:bg-[rgba(255,210,100,0.15)] hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(255,185,50,0.15)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <FiPause size={14} />
                        Hold
                        <span className="text-[10px] opacity-65 font-normal">Ctrl+2</span>
                    </button>
                    <button
                        onClick={() => { fetchPendingBills(); setShowPendingModal(true); }}
                        className="flex-1 py-3.5 px-4 rounded-xl bg-blue-50 dark:bg-[rgba(91,156,246,0.08)] border border-blue-200 dark:border-[rgba(91,156,246,0.2)] text-blue-600 dark:text-d-blue font-semibold text-[13px] flex items-center justify-center gap-2 hover:bg-blue-100 dark:hover:bg-[rgba(91,156,246,0.15)] hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(91,156,246,0.15)] transition-all"
                    >
                        <FiList size={14} />
                        Pending
                        <span className="text-[10px] opacity-65 font-normal">Ctrl+3</span>
                    </button>
                    <button
                        onClick={() => { setShowPaymentModal(true); setPaymentMethod('cash'); setCashGiven(''); setCreditPaidNow(''); }}
                        disabled={!activeBill || activeBill.items.length === 0}
                        className="flex-[2] py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 dark:from-d-accent dark:to-d-accent-s text-white dark:text-d-card font-bold text-[14px] flex items-center justify-center gap-2 shadow-md dark:shadow-[0_6px_24px_rgba(255,185,50,0.3)] hover:-translate-y-0.5 hover:shadow-lg dark:hover:shadow-[0_10px_36px_rgba(255,185,50,0.45)] active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group"
                    >
                        <div className="absolute top-[-50%] left-[-60%] w-[40%] h-[200%] bg-[rgba(255,255,255,0.15)] transform skew-x-[-20deg] group-hover:left-[160%] transition-all duration-500" />
                        <FiShoppingCart size={15} />
                        Pay · {formatCurrency(effectiveTotal)}
                        <span className="text-[10px] opacity-65 font-normal">Ctrl+0</span>
                    </button>
                </div>
            </div>

            {/* Payment Modal */}
            {showPaymentModal && (
                <div className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-d-elevated border border-slate-200 dark:border-[rgba(255,255,255,0.1)] rounded-2xl p-6 w-full max-w-md animate-pop-in shadow-2xl">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-d-text">Payment</h3>
                            <button onClick={() => setShowPaymentModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-[rgba(255,255,255,0.05)] rounded-lg text-slate-500 dark:text-d-muted hover:text-slate-700 dark:hover:text-d-text transition-colors">
                                <FiX size={20} />
                            </button>
                        </div>

                        <div className="text-center mb-6 p-4 bg-amber-50 dark:bg-[rgba(255,210,100,0.05)] border border-amber-200 dark:border-[rgba(255,210,100,0.1)] rounded-xl">
                            <p className="text-sm text-slate-500 dark:text-d-muted mb-1">{resumedBillInfo ? 'Amount Due' : 'Total Amount'}</p>
                            <p className="font-display text-3xl font-bold text-amber-600 dark:text-d-accent">{formatCurrency(effectiveTotal)}</p>
                        </div>

                        <div className="mb-6">
                            <p className="text-sm font-medium text-slate-500 dark:text-d-muted mb-2">Payment Method</p>
                            <div className="grid grid-cols-4 gap-2">
                                {[
                                    { id: 'cash', label: 'Cash', icon: FiDollarSign },
                                    { id: 'card', label: 'Card', icon: FiCreditCard },
                                    { id: 'upi', label: 'UPI', icon: FiSmartphone },
                                    { id: 'credit', label: 'Credit', icon: FiUser },
                                ].map((method) => {
                                    const creditDisabled = method.id === 'credit' && !activeBill?.customer;
                                    return (
                                        <button
                                            key={method.id}
                                            onClick={() => !creditDisabled && setPaymentMethod(method.id)}
                                            disabled={creditDisabled}
                                            title={creditDisabled ? 'Attach a customer to enable credit' : ''}
                                            className={`py-3 rounded-xl font-medium flex items-center justify-center gap-1.5 text-sm transition-all ${
                                                paymentMethod === method.id
                                                    ? 'bg-amber-500 dark:bg-d-accent text-white dark:text-d-card'
                                                    : creditDisabled
                                                        ? 'bg-slate-50 dark:bg-[rgba(255,255,255,0.02)] border border-slate-200 dark:border-d-border text-slate-300 dark:text-d-faint cursor-not-allowed'
                                                        : 'bg-slate-100 dark:bg-[rgba(255,255,255,0.05)] border border-slate-200 dark:border-d-border text-slate-600 dark:text-d-muted hover:bg-slate-200 dark:hover:bg-d-glass-hover'
                                            }`}
                                        >
                                            <method.icon size={16} />
                                            {method.label}
                                        </button>
                                    );
                                })}
                            </div>
                            {paymentMethod === 'credit' && !activeBill?.customer && (
                                <p className="text-xs text-red-500 dark:text-d-red mt-2">
                                    Attach a customer first to use credit.
                                </p>
                            )}
                        </div>

                        {paymentMethod === 'credit' && activeBill?.customer && (
                            <div className="mb-6">
                                <label className="text-sm font-medium text-slate-500 dark:text-d-muted mb-2 block">Amount Paid Now (optional)</label>
                                <input
                                    type="number"
                                    value={creditPaidNow}
                                    onChange={(e) => setCreditPaidNow(e.target.value)}
                                    placeholder="0 — leave empty for full credit"
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-[rgba(255,255,255,0.05)] border border-slate-200 dark:border-d-border rounded-xl text-lg text-slate-800 dark:text-d-text focus:border-amber-400 dark:focus:border-d-border-hover focus:bg-amber-50 dark:focus:bg-[rgba(255,210,100,0.03)] outline-none transition-all"
                                />
                                {(() => {
                                    const paid = Math.max(0, Math.min(parseFloat(creditPaidNow || 0), effectiveTotal));
                                    const due = effectiveTotal - paid;
                                    return (
                                        <div className="mt-3 p-4 bg-amber-50 dark:bg-[rgba(255,185,50,0.08)] border border-amber-200 dark:border-[rgba(255,185,50,0.2)] rounded-xl space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-500 dark:text-d-muted">Paid now</span>
                                                <span className="font-semibold text-slate-800 dark:text-d-text">{formatCurrency(paid)}</span>
                                            </div>
                                            <div className="flex justify-between items-center pt-2 border-t border-amber-200 dark:border-[rgba(255,185,50,0.15)]">
                                                <span className="text-sm text-amber-700 dark:text-d-accent font-medium">
                                                    Added to {activeBill.customerName}'s balance
                                                </span>
                                                <span className="font-display text-xl font-bold text-amber-600 dark:text-d-accent">{formatCurrency(due)}</span>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                        {paymentMethod === 'cash' && (
                            <div className="mb-6">
                                <label className="text-sm font-medium text-slate-500 dark:text-d-muted mb-2 block">Cash Received</label>
                                <input
                                    ref={cashInputRef}
                                    type="number"
                                    value={cashGiven}
                                    onChange={(e) => setCashGiven(e.target.value)}
                                    placeholder="Enter amount..."
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-[rgba(255,255,255,0.05)] border border-slate-200 dark:border-d-border rounded-xl text-lg text-slate-800 dark:text-d-text focus:border-amber-400 dark:focus:border-d-border-hover focus:bg-amber-50 dark:focus:bg-[rgba(255,210,100,0.03)] outline-none transition-all"
                                />

                                <div className="flex gap-2 mt-2">
                                    {[effectiveTotal, Math.ceil(effectiveTotal / 100) * 100, Math.ceil(effectiveTotal / 500) * 500, Math.ceil(effectiveTotal / 1000) * 1000].filter((v, i, a) => a.indexOf(v) === i).slice(0, 4).map((amount) => (
                                        <button
                                            key={amount}
                                            onClick={() => setCashGiven(amount.toString())}
                                            className="flex-1 py-2 bg-slate-100 dark:bg-[rgba(255,255,255,0.05)] text-slate-600 dark:text-d-muted rounded-lg text-sm hover:bg-slate-200 dark:hover:bg-d-glass-hover transition-colors"
                                        >
                                            {amount.toLocaleString()}
                                        </button>
                                    ))}
                                </div>

                                {parseFloat(cashGiven || 0) >= effectiveTotal && (
                                    <div className="mt-4 p-4 bg-emerald-50 dark:bg-[rgba(52,232,161,0.1)] border border-emerald-200 dark:border-[rgba(52,232,161,0.2)] rounded-xl">
                                        <div className="flex justify-between items-center">
                                            <span className="text-emerald-600 dark:text-d-green font-medium">Change to Return</span>
                                            <span className="font-display text-2xl font-bold text-emerald-600 dark:text-d-green">{formatCurrency(changeAmount)}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <button
                            onClick={() => handleCheckout()}
                            disabled={
                                processing ||
                                (paymentMethod === 'cash' && parseFloat(cashGiven || 0) < effectiveTotal) ||
                                (paymentMethod === 'credit' && !activeBill?.customer)
                            }
                            className="w-full py-4 bg-emerald-500 dark:bg-d-green text-white dark:text-d-card font-bold rounded-xl hover:shadow-[0_4px_20px_rgba(52,232,161,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {processing ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white dark:border-d-card border-t-transparent rounded-full animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <FiCheck size={20} />
                                    Complete Payment
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Walk-in Confirmation Modal */}
            {showWalkInConfirm && (
                <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-[200] backdrop-blur-sm">
                    <div className="bg-white dark:bg-d-elevated border border-slate-200 dark:border-[rgba(255,255,255,0.1)] rounded-2xl p-6 w-full max-w-md animate-pop-in shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-[rgba(255,185,50,0.15)] flex items-center justify-center">
                                <FiUser className="text-amber-600 dark:text-d-accent" size={22} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-d-text">Walk-in Customer</h3>
                                <p className="text-xs text-slate-500 dark:text-d-muted">No customer attached to this bill</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-d-muted leading-relaxed mb-5">
                            This bill will <span className="font-semibold text-slate-800 dark:text-d-text">not be added to any customer ledger</span>. You won't be able to track this sale against a specific customer later.
                            <br /><br />
                            Are you sure you want to continue?
                        </p>
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => {
                                    setShowWalkInConfirm(false);
                                    handleCheckout(true);
                                }}
                                className="w-full py-3 bg-emerald-500 dark:bg-d-green text-white dark:text-d-card font-semibold rounded-xl hover:shadow-[0_4px_20px_rgba(52,232,161,0.3)] transition-all"
                            >
                                Yes, continue as Walk-in
                            </button>
                            <button
                                onClick={() => {
                                    setShowWalkInConfirm(false);
                                    setShowCustomerPicker(true);
                                }}
                                className="w-full py-3 border-2 border-amber-400 dark:border-d-accent text-amber-700 dark:text-d-accent font-semibold rounded-xl hover:bg-amber-50 dark:hover:bg-[rgba(255,185,50,0.1)] transition-all"
                            >
                                Attach a Customer
                            </button>
                            <button
                                onClick={() => setShowWalkInConfirm(false)}
                                className="w-full py-2 text-sm text-slate-500 dark:text-d-muted hover:text-slate-700 dark:hover:text-d-text"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Hold Bill Modal */}
            {showHoldModal && (
                <div className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-d-elevated border border-slate-200 dark:border-[rgba(255,255,255,0.1)] rounded-2xl p-6 w-full max-w-md animate-pop-in shadow-2xl">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-d-text">Hold Bill</h3>
                            <button onClick={() => setShowHoldModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-[rgba(255,255,255,0.05)] rounded-lg text-slate-500 dark:text-d-muted">
                                <FiX size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-slate-500 dark:text-d-muted mb-1 block">Customer Name</label>
                                <div className="relative">
                                    <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-d-faint" />
                                    <input
                                        type="text"
                                        value={holdCustomerName}
                                        onChange={(e) => setHoldCustomerName(e.target.value)}
                                        placeholder="Enter customer name..."
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-[rgba(255,255,255,0.05)] border border-slate-200 dark:border-d-border rounded-xl text-slate-800 dark:text-d-text focus:border-amber-400 dark:focus:border-d-border-hover outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-sm font-medium text-slate-500 dark:text-d-muted mb-1 block">Phone</label>
                                <div className="relative">
                                    <FiPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-d-faint" />
                                    <input
                                        type="tel"
                                        value={holdCustomerPhone}
                                        onChange={(e) => setHoldCustomerPhone(e.target.value)}
                                        placeholder="Enter phone..."
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-[rgba(255,255,255,0.05)] border border-slate-200 dark:border-d-border rounded-xl text-slate-800 dark:text-d-text focus:border-amber-400 dark:focus:border-d-border-hover outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-sm font-medium text-slate-500 dark:text-d-muted mb-1 block">Amount Paid (Partial)</label>
                                <div className="relative">
                                    <FiDollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-d-faint" />
                                    <input
                                        type="number"
                                        value={holdAmountPaid}
                                        onChange={(e) => setHoldAmountPaid(e.target.value)}
                                        placeholder="0"
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-[rgba(255,255,255,0.05)] border border-slate-200 dark:border-d-border rounded-xl text-slate-800 dark:text-d-text focus:border-amber-400 dark:focus:border-d-border-hover outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div className="p-4 bg-slate-50 dark:bg-[rgba(255,255,255,0.03)] border border-slate-200 dark:border-[rgba(255,255,255,0.05)] rounded-xl">
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="text-slate-500 dark:text-d-muted">Bill Total</span>
                                    <span className="font-medium text-slate-800 dark:text-d-text">{formatCurrency(activeTotal.total)}</span>
                                </div>
                                {parseFloat(holdAmountPaid) > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500 dark:text-d-muted">Remaining</span>
                                        <span className="font-medium text-amber-600 dark:text-d-accent">{formatCurrency(activeTotal.total - parseFloat(holdAmountPaid || 0))}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <button
                            onClick={handleHoldBill}
                            disabled={holdingBill}
                            className="w-full mt-6 py-4 bg-amber-500 dark:bg-d-accent text-white dark:text-d-card font-bold rounded-xl hover:shadow-[0_4px_20px_rgba(255,210,100,0.3)] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {holdingBill ? (
                                <><div className="w-5 h-5 border-2 border-white dark:border-d-card border-t-transparent rounded-full animate-spin" /> Saving...</>
                            ) : (
                                <><FiPause size={20} /> Save as Pending</>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Pending Bills Modal */}
            {showPendingModal && (
                <div className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-d-elevated border border-slate-200 dark:border-[rgba(255,255,255,0.1)] rounded-2xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col animate-pop-in shadow-2xl">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-d-text">Pending Bills</h3>
                            <button onClick={() => setShowPendingModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-[rgba(255,255,255,0.05)] rounded-lg text-slate-500 dark:text-d-muted">
                                <FiX size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-auto dark-scrollbar">
                            {loadingPending ? (
                                <div className="flex items-center justify-center h-32">
                                    <div className="w-8 h-8 border-2 border-amber-500 dark:border-d-accent border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : pendingBills.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-32 text-slate-500 dark:text-d-muted">
                                    <FiList size={32} />
                                    <p className="mt-2">No pending bills</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {pendingBills.map((bill) => (
                                        <div key={bill._id} className="p-4 bg-slate-50 dark:bg-[rgba(255,255,255,0.03)] border border-slate-200 dark:border-d-glass-hover rounded-xl">
                                            <div className="flex items-start justify-between mb-2">
                                                <div>
                                                    <h4 className="font-medium text-slate-800 dark:text-d-text">{bill.customerName || 'Walk-in Customer'}</h4>
                                                    {bill.customerPhone && <p className="text-sm text-slate-500 dark:text-d-muted">{bill.customerPhone}</p>}
                                                </div>
                                                <p className="font-display text-lg font-bold text-amber-600 dark:text-d-accent">{formatCurrency(bill.total)}</p>
                                            </div>
                                            <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-d-muted mb-3">
                                                <span>{bill.items?.length || 0} items</span>
                                                {bill.amountPaid > 0 && (
                                                    <>
                                                        <span>Paid: {formatCurrency(bill.amountPaid)}</span>
                                                        <span className="text-amber-600 dark:text-d-accent font-medium">Due: {formatCurrency(bill.remainingAmount || bill.total - bill.amountPaid)}</span>
                                                    </>
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => loadPendingBill(bill)} className="flex-1 py-2 bg-emerald-500 dark:bg-d-green text-white dark:text-d-card rounded-lg hover:shadow-lg font-medium">Load Bill</button>
                                                <button onClick={() => handleCancelPendingBill(bill._id)} className="px-4 py-2 bg-red-50 dark:bg-[rgba(255,107,107,0.1)] text-red-500 dark:text-d-red rounded-lg hover:bg-red-100 dark:hover:bg-[rgba(255,107,107,0.2)]">
                                                    <FiTrash2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Success Modal */}
            {showSuccess && (
                <div className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-d-elevated border border-emerald-200 dark:border-[rgba(52,232,161,0.2)] rounded-2xl p-8 text-center animate-pop-in max-w-sm shadow-2xl">
                        <div className="w-20 h-20 bg-emerald-50 dark:bg-[rgba(52,232,161,0.1)] rounded-full flex items-center justify-center mx-auto mb-4">
                            <FiCheck size={40} className="text-emerald-500 dark:text-d-green" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-d-text mb-2">Sale Complete!</h3>
                        {successData && (
                            <div className="text-left bg-slate-50 dark:bg-[rgba(255,255,255,0.03)] rounded-xl p-4 mt-4 space-y-2">
                                {successData.billNumber && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500 dark:text-d-muted">Bill #</span>
                                        <span className="font-medium text-slate-800 dark:text-d-text">{successData.billNumber}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500 dark:text-d-muted">Total</span>
                                    <span className="font-medium text-slate-800 dark:text-d-text">{formatCurrency(successData.total)}</span>
                                </div>
                                {successData.paymentMethod === 'cash' && successData.change > 0 && (
                                    <div className="flex justify-between text-sm pt-2 border-t border-slate-200 dark:border-[rgba(255,255,255,0.05)] text-emerald-600 dark:text-d-green font-medium">
                                        <span>Change</span>
                                        <span>{formatCurrency(successData.change)}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Toast */}
            <div className={`fixed bottom-7 left-1/2 -translate-x-1/2 bg-white dark:bg-gradient-to-r dark:from-d-elevated dark:to-d-card border border-amber-300 dark:border-[rgba(255,210,100,0.3)] text-slate-800 dark:text-d-text text-[13px] font-medium px-6 py-3 rounded-full shadow-lg dark:shadow-[0_12px_40px_rgba(0,0,0,0.5)] flex items-center gap-2 transition-all duration-300 z-[999] ${toast.show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                <span className="text-base">{toast.icon}</span>
                <span>{toast.message}</span>
            </div>
        </div>
    );
};

// ==================== ADMIN DASHBOARD ====================
const AdminDashboard = () => {
    const navigate = useNavigate();
    const { business } = useBusiness();
    const [timeFilter, setTimeFilter] = useState('today');
    const [stats, setStats] = useState({ totalSales: 0, totalOrders: 0, avgOrderValue: 0, growth: 0 });
    const [profitLoss, setProfitLoss] = useState({ grossRevenue: 0, returns: 0, netRevenue: 0, cogs: 0, grossProfit: 0, expenses: 0, netProfit: 0, profitMargin: 0 });
    const [chartData, setChartData] = useState([]);
    const [peakData, setPeakData] = useState({ value: 0, time: '' });
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [showDetail, setShowDetail] = useState(null);

    // Live clock
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        fetchDashboardData();
    }, [timeFilter]);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const now = new Date();
            let startDate = new Date();
            switch (timeFilter) {
                case 'today': startDate.setHours(0, 0, 0, 0); break;
                case 'week': startDate.setDate(now.getDate() - 7); break;
                case 'month': startDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
            }

            // Fetch stats + chart data in ONE call
            const [statsRes, expensesRes] = await Promise.all([
                getReceiptStats({ filter: timeFilter, chart: 'true' }),
                getApprovedExpenses({ status: 'approved' }).catch(() => ({ data: [] }))
            ]);

            const backendStats = statsRes.data;

            // Calculate expenses for the period
            const allExpenses = Array.isArray(expensesRes.data) ? expensesRes.data : expensesRes.data?.expenses || [];
            const periodExpenses = allExpenses.filter(e => new Date(e.date || e.createdAt) >= startDate);
            const expenses = periodExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

            const netProfit = backendStats.grossProfit - expenses;
            const profitMargin = backendStats.netRevenue > 0 ? (netProfit / backendStats.netRevenue) * 100 : 0;

            setStats({
                totalSales: backendStats.grossRevenue,
                totalOrders: backendStats.totalOrders,
                avgOrderValue: backendStats.avgOrderValue,
                growth: backendStats.growth
            });

            setProfitLoss({
                grossRevenue: backendStats.grossRevenue,
                returns: backendStats.totalReturns,
                netRevenue: backendStats.netRevenue,
                cogs: backendStats.totalCOGS,
                grossProfit: backendStats.grossProfit,
                expenses: expenses,
                netProfit: netProfit,
                profitMargin: profitMargin
            });

            // Use chart data from stats response (no separate receipt fetch needed)
            generateChartDataFromStats(backendStats.chartData || [], startDate, now, timeFilter);
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    // New: works with pre-aggregated chart data from stats endpoint
    const generateChartDataFromStats = (chartItems, startDate, endDate, filter) => {
        const dataMap = {};
        chartItems.forEach(item => {
            dataMap[item._id] = { revenue: item.revenue, orders: item.orders };
        });

        const data = [];
        let maxSales = 0;
        let maxTime = '';

        if (filter === 'today') {
            for (let h = 0; h < 24; h++) {
                const sales = dataMap[h]?.revenue || 0;
                const orders = dataMap[h]?.orders || 0;
                data.push({ name: `${h}:00`, sales, orders });
                if (sales > maxSales) { maxSales = sales; maxTime = `${h}:00`; }
            }
        } else if (filter === 'week') {
            for (let i = 0; i < 7; i++) {
                const day = new Date(startDate);
                day.setDate(startDate.getDate() + i);
                const key = day.toISOString().split('T')[0];
                const dayName = day.toLocaleDateString('en', { weekday: 'short' });
                const sales = dataMap[key]?.revenue || 0;
                const orders = dataMap[key]?.orders || 0;
                data.push({ name: dayName, sales, orders });
                if (sales > maxSales) { maxSales = sales; maxTime = dayName; }
            }
        } else {
            for (let w = 0; w < 5; w++) {
                const ws = new Date(startDate);
                ws.setDate(startDate.getDate() + w * 7);
                const we = new Date(ws);
                we.setDate(ws.getDate() + 7);
                let weekSales = 0, weekOrders = 0;
                Object.entries(dataMap).forEach(([key, val]) => {
                    const d = new Date(key);
                    if (d >= ws && d < we) { weekSales += val.revenue; weekOrders += val.orders; }
                });
                data.push({ name: `W${w + 1}`, sales: weekSales, orders: weekOrders });
                if (weekSales > maxSales) { maxSales = weekSales; maxTime = `W${w + 1}`; }
            }
        }
        setChartData(data);
        setPeakData({ value: maxSales, time: maxTime });
    };

    // Legacy: works with raw receipt arrays (kept for compatibility)
    const generateChartData = (receipts, startDate, endDate, filter) => {
        const data = [];
        let maxSales = 0;
        let maxTime = '';

        if (filter === 'today') {
            for (let h = 0; h < 24; h++) {
                const hourReceipts = receipts.filter(r => new Date(r.createdAt).getHours() === h);
                const hourSales = hourReceipts.reduce((sum, r) => sum + (r.totalBill || 0), 0);
                const hourOrders = hourReceipts.length;
                data.push({ name: `${h}:00`, sales: hourSales, orders: hourOrders });
                if (hourSales > maxSales) {
                    maxSales = hourSales;
                    maxTime = `${h}:00`;
                }
            }
        } else if (filter === 'week') {
            for (let i = 0; i < 7; i++) {
                const day = new Date(startDate);
                day.setDate(startDate.getDate() + i);
                const dayReceipts = receipts.filter(r => new Date(r.createdAt).toDateString() === day.toDateString());
                const daySales = dayReceipts.reduce((sum, r) => sum + (r.totalBill || 0), 0);
                const dayName = day.toLocaleDateString('en', { weekday: 'short' });
                data.push({ name: dayName, sales: daySales, orders: dayReceipts.length });
                if (daySales > maxSales) {
                    maxSales = daySales;
                    maxTime = dayName;
                }
            }
        } else {
            for (let w = 0; w < 5; w++) {
                const weekStart = new Date(startDate);
                weekStart.setDate(startDate.getDate() + w * 7);
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekStart.getDate() + 7);
                const weekReceipts = receipts.filter(r => { const d = new Date(r.createdAt); return d >= weekStart && d < weekEnd; });
                const weekSales = weekReceipts.reduce((sum, r) => sum + (r.totalBill || 0), 0);
                data.push({ name: `W${w + 1}`, sales: weekSales, orders: weekReceipts.length });
                if (weekSales > maxSales) {
                    maxSales = weekSales;
                    maxTime = `W${w + 1}`;
                }
            }
        }
        setChartData(data);
        setPeakData({ value: maxSales, time: maxTime });
    };

    // Format currency - full amount, no abbreviation
    const formatCurrency = (amount) => {
        const num = amount || 0;
        return num.toLocaleString();
    };

    // Format currency with abbreviation for charts only
    const formatCurrencyShort = (amount) => {
        const num = amount || 0;
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toLocaleString();
    };

    // Detail Popup Component
    // Memoized detail popup data to prevent re-renders
    const detailPopupData = useMemo(() => ({
        grossRevenue: {
            title: 'Gross Revenue Calculation',
            items: [
                { label: 'Total Sales', value: stats.totalSales, color: '#34e8a1' },
                { label: 'Number of Orders', value: `${stats.totalOrders} orders`, isText: true },
                { label: 'Average Order', value: stats.avgOrderValue, color: '#5b9cf6' },
            ],
            formula: 'Sum of all receipt totals (excluding refunds)'
        },
        netProfit: {
            title: 'Net Profit Calculation',
            items: [
                { label: 'Gross Revenue', value: profitLoss.grossRevenue, color: '#34e8a1', sign: '' },
                { label: 'Returns/Refunds', value: profitLoss.returns, color: '#ff6b6b', sign: '−' },
                { label: 'Net Revenue', value: profitLoss.netRevenue, color: '#5b9cf6', sign: '=' },
                { label: 'Cost of Goods', value: profitLoss.cogs, color: '#ff6b6b', sign: '−' },
                { label: 'Gross Profit', value: profitLoss.grossProfit, color: '#ffd264', sign: '=' },
                { label: 'Expenses', value: profitLoss.expenses, color: '#ff6b6b', sign: '−' },
                { label: 'Net Profit', value: profitLoss.netProfit, color: profitLoss.netProfit >= 0 ? '#34e8a1' : '#ff6b6b', sign: '=', isBold: true },
            ],
            formula: 'Revenue − Returns − COGS − Expenses = Net Profit'
        },
        cogs: {
            title: 'Cost of Goods Sold',
            items: [
                { label: 'Total COGS', value: profitLoss.cogs, color: '#ff6b6b' },
                { label: 'As % of Revenue', value: `${profitLoss.grossRevenue > 0 ? ((profitLoss.cogs / profitLoss.grossRevenue) * 100).toFixed(1) : 0}%`, isText: true },
            ],
            formula: 'Sum of (costPrice × quantity) for all sold items'
        },
        avgOrder: {
            title: 'Average Order Value',
            items: [
                { label: 'Gross Revenue', value: stats.totalSales, color: '#34e8a1' },
                { label: 'Total Orders', value: `${stats.totalOrders} orders`, isText: true },
                { label: 'Avg Order Value', value: stats.avgOrderValue, color: '#ffd264', isBold: true },
            ],
            formula: 'Gross Revenue ÷ Number of Orders'
        },
    }), [stats, profitLoss]);

    // Render detail popup - separate from main component to prevent clock re-renders
    const renderDetailPopup = () => {
        if (!showDetail) return null;
        const detail = detailPopupData[showDetail];
        if (!detail) return null;

        return (
            <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
                onClick={() => setShowDetail(null)}
            >
                <div
                    className="bg-[#0d0f17] border border-[rgba(255,255,255,0.1)] rounded-2xl p-6 min-w-[320px] max-w-[400px] shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                    style={{ animation: 'popIn 0.2s ease-out forwards' }}
                >
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bebas text-xl tracking-wide text-d-heading">{detail.title}</h3>
                        <button
                            onClick={() => setShowDetail(null)}
                            className="w-8 h-8 rounded-lg bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] flex items-center justify-center text-d-muted hover:text-white transition-colors"
                        >
                            ×
                        </button>
                    </div>

                    <div className="space-y-3 mb-4">
                        {detail.items.map((item, idx) => (
                            <div key={idx} className={`flex items-center justify-between py-2 ${item.isBold ? 'border-t border-[rgba(255,255,255,0.1)] pt-3' : ''}`}>
                                <span className="text-sm text-d-muted flex items-center gap-2">
                                    {item.sign && <span className="text-d-muted font-mono">{item.sign}</span>}
                                    {item.label}
                                </span>
                                <span className={`font-bebas text-lg ${item.isBold ? 'text-xl' : ''}`} style={{ color: item.color || '#fef9ec' }}>
                                    {item.isText ? item.value : `${currency} ${formatCurrency(item.value)}`}
                                </span>
                            </div>
                        ))}
                    </div>

                    <div className="bg-[rgba(255,210,100,0.05)] border border-[rgba(255,210,100,0.15)] rounded-lg p-3">
                        <p className="text-[11px] text-d-muted font-mono-dm">
                            <span className="text-d-accent">Formula:</span> {detail.formula}
                        </p>
                    </div>
                </div>
            </div>
        );
    };

    const formatDate = (date) => {
        return date.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
    };

    const formatTime = (date) => {
        return date.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full bg-slate-50 dark:bg-d-bg">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-d-accent border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-500 dark:text-d-muted">Loading dashboard...</p>
                </div>
            </div>
        );
    }

    const currency = business?.currency || 'Rs.';

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-d-bg overflow-hidden grain-overlay">
            {/* Topbar */}
            <div className="flex items-center gap-4 px-7 py-4 border-b border-slate-200 dark:border-[rgba(255,255,255,0.06)] backdrop-blur-xl bg-white/80 dark:bg-[rgba(7,8,13,0.65)] flex-shrink-0">
                <div>
                    <h1 className="font-bebas text-[30px] tracking-[0.08em] text-slate-800 dark:text-d-heading leading-none">DASHBOARD</h1>
                    <p className="font-mono-dm text-[10px] text-slate-500 dark:text-d-faint tracking-[0.06em] mt-0.5">
                        {formatDate(currentTime)} · {formatTime(currentTime)}
                    </p>
                </div>

                {/* Live Chip */}
                <div className="flex items-center gap-2 bg-[rgba(52,232,161,0.07)] border border-[rgba(52,232,161,0.2)] rounded-full px-3 py-1.5 ml-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-d-green shadow-[0_0_8px_#34e8a1] animate-blink" />
                    <span className="font-mono-dm text-[10px] font-medium text-d-green tracking-[0.06em]">LIVE</span>
                </div>

                <div className="ml-auto flex items-center gap-3">
                    <span className="text-sm text-slate-500 dark:text-d-muted">
                        Welcome back, <span className="text-amber-600 dark:text-d-accent font-semibold">{business?.name || 'Histore'}</span>
                    </span>

                    {/* Period Tabs */}
                    <div className="flex bg-slate-100 dark:bg-[#0d0f17] border border-slate-200 dark:border-[rgba(255,255,255,0.06)] rounded-xl p-1 gap-0.5">
                        {['today', 'week', 'month'].map((filter) => (
                            <button
                                key={filter}
                                onClick={() => setTimeFilter(filter)}
                                className={`px-4 py-1.5 rounded-lg text-xs font-semibold tracking-[0.03em] transition-all duration-200 ${
                                    timeFilter === filter
                                        ? 'bg-gradient-to-r from-d-accent to-d-accent-s text-d-bg shadow-[0_4px_16px_rgba(255,185,50,0.3)]'
                                        : 'text-slate-500 dark:text-d-muted hover:text-slate-800 dark:hover:text-[#f0f2f8] hover:bg-slate-200/50 dark:hover:bg-d-glass'
                                }`}
                            >
                                {filter === 'today' ? 'Today' : filter === 'week' ? 'Week' : 'Month'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bento Grid */}
            <div className="flex-1 overflow-y-auto p-4 dark-scrollbar">
                <div className="grid grid-cols-12 grid-rows-[110px_110px_1fr] gap-2.5 min-h-[calc(100vh-130px)]">

                    {/* GROSS REVENUE - Tall Left Card */}
                    <div
                        className="col-span-3 row-span-2 bg-slate-100 dark:bg-[#0d0f17] dark:bg-gradient-to-br dark:from-[rgba(255,210,100,0.06)] dark:to-[#0d0f17] rounded-2xl p-4 border border-slate-200 dark:border-[rgba(255,255,255,0.06)] relative overflow-hidden flex flex-col justify-between animate-bento-in hover:translate-y-[-2px] hover:shadow-[0_12px_40px_rgba(0,0,0,0.4)] hover:border-[rgba(255,210,100,0.22)] transition-all duration-300 group cursor-pointer"
                        onClick={() => setShowDetail('grossRevenue')}
                    >
                        {/* Deco rings */}
                        <div className="absolute bottom-[-20px] right-[-20px] w-[100px] h-[100px] rounded-full border border-[rgba(255,210,100,0.07)] pointer-events-none">
                            <div className="absolute inset-[12px] rounded-full border border-[rgba(255,210,100,0.05)]" />
                        </div>

                        <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-d-accent shadow-[0_0_6px_#ffd264]" />
                            <span className="text-[9px] font-bold tracking-[0.1em] uppercase text-slate-500 dark:text-d-faint">Gross Revenue</span>
                        </div>

                        <div>
                            <div className="font-bebas text-[48px] leading-none tracking-[-0.01em] text-amber-600 dark:text-d-accent dark:drop-shadow-[0_0_40px_rgba(255,200,60,0.3)]">
                                {currency} {formatCurrency(stats.totalSales)}
                            </div>
                            <div className="font-mono-dm text-[9px] text-slate-500 dark:text-d-muted tracking-[0.06em] mt-0.5">
                                Pakistani Rupee · PKR
                            </div>
                            <div className={`inline-flex items-center gap-1 font-mono-dm text-[9px] font-semibold tracking-[0.04em] px-2 py-0.5 rounded-full mt-2 ${
                                stats.growth >= 0
                                    ? 'bg-[rgba(52,232,161,0.1)] text-d-green border border-[rgba(52,232,161,0.2)]'
                                    : 'bg-[rgba(255,107,107,0.09)] text-d-red border border-[rgba(255,107,107,0.18)]'
                            }`}>
                                {stats.growth >= 0 ? '↑' : '↓'} {Math.abs(stats.growth).toFixed(1)}% vs last period
                            </div>
                        </div>
                    </div>

                    {/* TOTAL ORDERS */}
                    <div className="col-span-3 bg-slate-100 dark:bg-[#0d0f17] rounded-2xl p-4 border border-slate-200 dark:border-[rgba(255,255,255,0.06)] relative overflow-hidden animate-bento-in hover:translate-y-[-2px] hover:shadow-[0_12px_40px_rgba(0,0,0,0.4)] hover:border-[rgba(91,156,246,0.22)] transition-all duration-300" style={{ animationDelay: '0.1s' }}>
                        <div className="absolute top-3 right-3 w-7 h-7 rounded-lg bg-[rgba(91,156,246,0.1)] border border-[rgba(91,156,246,0.22)] flex items-center justify-center">
                            <FiShoppingCart size={13} className="text-d-blue" />
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-d-blue" />
                            <span className="text-[9px] font-bold tracking-[0.1em] uppercase text-slate-500 dark:text-d-faint">Total Orders</span>
                        </div>
                        <div className="font-bebas text-[34px] leading-tight tracking-[0.02em] text-d-blue mt-1">
                            {stats.totalOrders}
                        </div>
                        <div className="inline-flex items-center gap-1 font-mono-dm text-[9px] font-semibold tracking-[0.04em] px-2 py-0.5 rounded-full mt-1 bg-d-glass text-slate-500 dark:text-d-muted border border-slate-200 dark:border-[rgba(255,255,255,0.06)]">
                            placed {timeFilter}
                        </div>
                    </div>

                    {/* AVG ORDER VALUE */}
                    <div
                        className="col-span-3 bg-slate-100 dark:bg-[#0d0f17] rounded-2xl p-4 border border-slate-200 dark:border-[rgba(255,255,255,0.06)] relative overflow-hidden animate-bento-in hover:translate-y-[-2px] hover:shadow-[0_12px_40px_rgba(0,0,0,0.4)] hover:border-[rgba(52,232,161,0.22)] transition-all duration-300 cursor-pointer group"
                        style={{ animationDelay: '0.14s' }}
                        onClick={() => setShowDetail('avgOrder')}
                    >
                        <div className="absolute top-3 right-3 w-7 h-7 rounded-lg bg-[rgba(52,232,161,0.1)] border border-[rgba(52,232,161,0.22)] flex items-center justify-center">
                            <FiTrendingUp size={13} className="text-d-green" />
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-d-green" />
                            <span className="text-[9px] font-bold tracking-[0.1em] uppercase text-slate-500 dark:text-d-faint">Avg Order Value</span>
                        </div>
                        <div className="font-bebas text-[34px] leading-tight tracking-[0.02em] text-d-green mt-1">
                            {currency} {formatCurrency(stats.avgOrderValue)}
                        </div>
                        <div className="inline-flex items-center gap-1 font-mono-dm text-[9px] font-semibold tracking-[0.04em] px-2 py-0.5 rounded-full mt-1 bg-[rgba(52,232,161,0.1)] text-d-green border border-[rgba(52,232,161,0.2)]">
                            ↑ per transaction
                        </div>
                    </div>

                    {/* TIME PERIOD */}
                    <div className="col-span-3 bg-slate-100 dark:bg-[#0d0f17] rounded-2xl p-4 border border-slate-200 dark:border-[rgba(255,255,255,0.06)] relative overflow-hidden animate-bento-in hover:translate-y-[-2px] hover:shadow-[0_12px_40px_rgba(0,0,0,0.4)] hover:border-[rgba(192,132,252,0.3)] transition-all duration-300" style={{ animationDelay: '0.17s' }}>
                        <div className="absolute top-3 right-3 w-7 h-7 rounded-lg bg-[rgba(192,132,252,0.1)] border border-[rgba(192,132,252,0.22)] flex items-center justify-center">
                            <FiCalendar size={13} className="text-[#c084fc]" />
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#c084fc]" />
                            <span className="text-[9px] font-bold tracking-[0.1em] uppercase text-slate-500 dark:text-d-faint">Period</span>
                        </div>
                        <div className="font-bebas text-[28px] leading-tight tracking-[0.02em] text-[#c084fc] mt-1">
                            {timeFilter === 'today' ? 'TODAY' : timeFilter === 'week' ? 'WEEK' : 'MONTH'}
                        </div>
                    </div>

                    {/* NET PROFIT */}
                    <div
                        className="col-span-3 bg-[rgba(52,232,161,0.04)] dark:bg-[rgba(52,232,161,0.04)] rounded-2xl p-3 border border-[rgba(52,232,161,0.12)] relative overflow-hidden animate-bento-in hover:translate-y-[-2px] hover:shadow-[0_12px_40px_rgba(0,0,0,0.4)] hover:border-[rgba(52,232,161,0.22)] transition-all duration-300 cursor-pointer group"
                        style={{ animationDelay: '0.12s' }}
                        onClick={() => setShowDetail('netProfit')}
                    >
                        <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-d-green shadow-[0_0_6px_#34e8a1]" />
                            <span className="text-[9px] font-bold tracking-[0.1em] uppercase text-slate-500 dark:text-d-faint">Net Profit</span>
                        </div>
                        <div className={`font-bebas text-[28px] leading-tight tracking-[0.02em] mt-1 ${profitLoss.netProfit >= 0 ? 'text-d-green' : 'text-d-red'}`}>
                            {currency} {formatCurrency(Math.abs(profitLoss.netProfit))}
                        </div>
                        <div className={`inline-flex items-center gap-1 font-mono-dm text-[9px] font-semibold tracking-[0.04em] px-2 py-0.5 rounded-full mt-1 ${
                            profitLoss.netProfit >= 0
                                ? 'bg-[rgba(52,232,161,0.1)] text-d-green border border-[rgba(52,232,161,0.2)]'
                                : 'bg-[rgba(255,107,107,0.09)] text-d-red border border-[rgba(255,107,107,0.18)]'
                        }`}>
                            {profitLoss.profitMargin.toFixed(0)}% margin
                        </div>
                    </div>

                    {/* COGS */}
                    <div
                        className="col-span-2 bg-slate-100 dark:bg-[#0d0f17] rounded-2xl p-3 border border-slate-200 dark:border-[rgba(255,255,255,0.06)] relative overflow-hidden animate-bento-in hover:translate-y-[-2px] hover:shadow-[0_12px_40px_rgba(0,0,0,0.4)] hover:border-[rgba(255,107,107,0.3)] transition-all duration-300 cursor-pointer"
                        style={{ animationDelay: '0.15s' }}
                        onClick={() => setShowDetail('cogs')}
                    >
                        <div className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-d-red" />
                            <span className="text-[8px] font-bold tracking-[0.08em] uppercase text-slate-500 dark:text-d-faint">COGS</span>
                        </div>
                        <div className="font-bebas text-[22px] leading-tight tracking-[0.02em] text-slate-400 dark:text-d-muted mt-1">
                            – {currency} {formatCurrency(profitLoss.cogs)}
                        </div>
                    </div>

                    {/* RETURNS */}
                    <div className="col-span-2 bg-slate-100 dark:bg-[#0d0f17] rounded-2xl p-3 border border-slate-200 dark:border-[rgba(255,255,255,0.06)] relative overflow-hidden animate-bento-in hover:translate-y-[-2px] hover:shadow-[0_12px_40px_rgba(0,0,0,0.4)] hover:border-[rgba(255,107,107,0.25)] transition-all duration-300" style={{ animationDelay: '0.18s' }}>
                        <div className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-d-red" />
                            <span className="text-[8px] font-bold tracking-[0.08em] uppercase text-slate-500 dark:text-d-faint">Returns</span>
                        </div>
                        <div className="font-bebas text-[22px] leading-tight tracking-[0.02em] text-slate-400 dark:text-d-muted mt-1">
                            – {currency} {formatCurrency(profitLoss.returns)}
                        </div>
                    </div>

                    {/* EXPENSES */}
                    <div className="col-span-2 bg-slate-100 dark:bg-[#0d0f17] rounded-2xl p-3 border border-slate-200 dark:border-[rgba(255,255,255,0.06)] relative overflow-hidden animate-bento-in hover:translate-y-[-2px] hover:shadow-[0_12px_40px_rgba(0,0,0,0.4)] hover:border-[rgba(255,107,107,0.25)] transition-all duration-300" style={{ animationDelay: '0.21s' }}>
                        <div className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-d-red" />
                            <span className="text-[8px] font-bold tracking-[0.08em] uppercase text-slate-500 dark:text-d-faint">Expenses</span>
                        </div>
                        <div className="font-bebas text-[22px] leading-tight tracking-[0.02em] text-slate-400 dark:text-d-muted mt-1">
                            – {currency} {formatCurrency(profitLoss.expenses)}
                        </div>
                    </div>

                    {/* SALES TREND CHART */}
                    <div className="col-span-6 bg-slate-100 dark:bg-[#0d0f17] rounded-2xl p-4 border border-slate-200 dark:border-[rgba(255,255,255,0.06)] relative overflow-hidden animate-bento-in flex flex-col gap-2 hover:translate-y-[-2px] hover:shadow-[0_12px_40px_rgba(0,0,0,0.4)] hover:border-[rgba(255,210,100,0.22)] transition-all duration-300" style={{ animationDelay: '0.22s' }}>
                        <div className="flex items-center justify-between">
                            <h3 className="font-bebas text-[18px] tracking-[0.07em] text-slate-800 dark:text-d-heading">SALES TREND</h3>
                            {peakData.value > 0 && (
                                <div className="font-mono-dm text-[9px] font-medium px-2 py-0.5 rounded-full bg-[rgba(255,210,100,0.1)] text-d-accent border border-[rgba(255,210,100,0.22)] tracking-[0.04em]">
                                    Peak {currency} {formatCurrency(peakData.value)} at {peakData.time}
                                </div>
                            )}
                        </div>
                        <div className="flex-1 min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.025)" />
                                    <XAxis dataKey="name" stroke="#2a2f45" fontSize={8} fontFamily="DM Mono" tickLine={false} axisLine={false} />
                                    <YAxis stroke="#2a2f45" fontSize={8} fontFamily="DM Mono" tickLine={false} axisLine={false} tickFormatter={(v) => formatCurrencyShort(v)} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0d0f17', border: '1px solid rgba(255,210,100,0.2)', borderRadius: '8px', padding: '8px' }}
                                        labelStyle={{ fontFamily: 'DM Mono', fontSize: '9px', color: '#4a5068' }}
                                        itemStyle={{ fontFamily: 'Bebas Neue', fontSize: '14px', color: '#ffd264' }}
                                        formatter={(value) => [`${currency} ${formatCurrency(value)}`, 'Sales']}
                                    />
                                    <defs>
                                        <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="rgba(255,210,100,0.3)" />
                                            <stop offset="100%" stopColor="rgba(255,210,100,0)" />
                                        </linearGradient>
                                    </defs>
                                    <Line
                                        type="monotone"
                                        dataKey="sales"
                                        stroke="#ffd264"
                                        strokeWidth={2}
                                        dot={{ fill: '#ffd264', strokeWidth: 3, stroke: 'rgba(255,210,100,0.3)', r: 4 }}
                                        activeDot={{ r: 6, fill: '#ffd264' }}
                                        fill="url(#salesGradient)"
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* ORDERS CHART */}
                    <div className="col-span-6 bg-slate-100 dark:bg-[#0d0f17] rounded-2xl p-4 border border-slate-200 dark:border-[rgba(255,255,255,0.06)] relative overflow-hidden animate-bento-in flex flex-col gap-2 hover:translate-y-[-2px] hover:shadow-[0_12px_40px_rgba(0,0,0,0.4)] hover:border-[rgba(91,156,246,0.22)] transition-all duration-300" style={{ animationDelay: '0.26s' }}>
                        <div className="flex items-center justify-between">
                            <h3 className="font-bebas text-[22px] tracking-[0.07em] text-slate-800 dark:text-d-heading">ORDERS / HOUR</h3>
                            <div className="font-mono-dm text-[10px] font-medium px-3 py-1 rounded-full bg-[rgba(91,156,246,0.1)] text-d-blue border border-[rgba(91,156,246,0.22)] tracking-[0.04em]">
                                {stats.totalOrders} total {timeFilter}
                            </div>
                        </div>
                        <div className="flex-1 min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} barCategoryGap="20%" barGap={2}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.025)" vertical={false} />
                                    <XAxis
                                        dataKey="name"
                                        stroke="#2a2f45"
                                        fontSize={9}
                                        fontFamily="DM Mono"
                                        tickLine={false}
                                        axisLine={false}
                                        interval={timeFilter === 'today' ? 2 : 0}
                                    />
                                    <YAxis
                                        stroke="#2a2f45"
                                        fontSize={9}
                                        fontFamily="DM Mono"
                                        tickLine={false}
                                        axisLine={false}
                                        allowDecimals={false}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0d0f17', border: '1px solid rgba(91,156,246,0.2)', borderRadius: '10px', padding: '12px' }}
                                        labelStyle={{ fontFamily: 'DM Mono', fontSize: '10px', color: '#4a5068' }}
                                        itemStyle={{ fontFamily: 'Bebas Neue', fontSize: '16px', color: '#5b9cf6' }}
                                        formatter={(value) => [`${value} orders`, '']}
                                        cursor={{ fill: 'rgba(91,156,246,0.1)' }}
                                    />
                                    <defs>
                                        <linearGradient id="ordersGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#5b9cf6" stopOpacity={0.9} />
                                            <stop offset="50%" stopColor="#5b9cf6" stopOpacity={0.6} />
                                            <stop offset="100%" stopColor="#5b9cf6" stopOpacity={0.2} />
                                        </linearGradient>
                                    </defs>
                                    <Bar
                                        dataKey="orders"
                                        fill="url(#ordersGradient)"
                                        radius={[8, 8, 0, 0]}
                                        maxBarSize={40}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                </div>
            </div>

            {/* Detail Popup */}
            {renderDetailPopup()}
        </div>
    );
};

// ==================== MAIN DASHBOARD WRAPPER ====================
const Dashboard = () => {
    const { isEmployee } = useAuth();
    return isEmployee ? <EmployeeDashboard /> : <AdminDashboard />;
};

export default Dashboard;
