import React, { useState, useEffect, useRef } from 'react';
import { useBusiness } from '../context/BusinessContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
    FiSearch,
    FiX,
    FiPlus,
    FiMinus,
    FiTrash2,
    FiCheck,
    FiAlertCircle,
    FiPackage,
    FiFileText,
    FiRefreshCw,
    FiRotateCcw,
} from 'react-icons/fi';

const RETURN_REASONS = [
    { value: 'defective', label: 'Defective' },
    { value: 'wrong_item', label: 'Wrong Item' },
    { value: 'customer_changed_mind', label: 'Changed Mind' },
    { value: 'expired', label: 'Expired' },
    { value: 'damaged', label: 'Damaged' },
    { value: 'other', label: 'Other' },
];

const REFUND_METHODS = [
    { value: 'cash', label: 'Cash', icon: '💵' },
    { value: 'card', label: 'Card', icon: '💳' },
    { value: 'store_credit', label: 'Store Credit', icon: '🎫' },
];

const Returns = () => {
    const { business } = useBusiness();
    const { user, isEmployee } = useAuth();

    // Return items state
    const [returnItems, setReturnItems] = useState([]);
    const [barcode, setBarcode] = useState('');
    const barcodeInputRef = useRef(null);

    // Bill lookup
    const [billNumber, setBillNumber] = useState('');
    const [linkedBill, setLinkedBill] = useState(null);
    const [loadingBill, setLoadingBill] = useState(false);

    // Refund details
    const [refundMethod, setRefundMethod] = useState('cash');
    const [customerName, setCustomerName] = useState('');
    const [notes, setNotes] = useState('');

    // Processing state
    const [processing, setProcessing] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [returnResult, setReturnResult] = useState(null);
    const [error, setError] = useState('');

    // Today's summary
    const [todaySummary, setTodaySummary] = useState({ totalReturns: 0, totalRefunded: 0 });

    useEffect(() => {
        loadTodaySummary();
        if (barcodeInputRef.current) {
            barcodeInputRef.current.focus();
        }
    }, []);

    const loadTodaySummary = async () => {
        try {
            const response = await api.get('/return/today-summary');
            setTodaySummary(response.data);
        } catch (error) {
            console.error('Error loading summary:', error);
        }
    };

    const formatCurrency = (amount) => {
        return `${business?.currency || 'Rs.'} ${(amount || 0).toLocaleString()}`;
    };

    // Lookup bill by number
    const lookupBill = async () => {
        if (!billNumber.trim()) {
            setError('Enter a bill number');
            return;
        }

        setLoadingBill(true);
        setError('');
        try {
            const response = await api.get(`/return/receipt/${billNumber.trim()}`);
            setLinkedBill(response.data);
        } catch (error) {
            if (error.response?.data?.isRefundReceipt) {
                setError('Cannot return items from a refund receipt');
            } else {
                setError(error.response?.data?.message || 'Bill not found');
            }
            setLinkedBill(null);
        } finally {
            setLoadingBill(false);
        }
    };

    // Add item from linked bill
    const addItemFromBill = (item) => {
        const remainingQty = item.remainingQty !== undefined ? item.remainingQty : item.qty;
        if (remainingQty <= 0) {
            setError('All items already returned');
            return;
        }

        const existingIndex = returnItems.findIndex(ri => ri.name === item.name);
        if (existingIndex >= 0) {
            const existing = returnItems[existingIndex];
            if (existing.quantity >= remainingQty) {
                setError(`Max ${remainingQty} can be returned`);
                return;
            }
            const updated = [...returnItems];
            updated[existingIndex] = { ...existing, quantity: existing.quantity + 1 };
            setReturnItems(updated);
        } else {
            setReturnItems([...returnItems, {
                id: Date.now().toString(),
                name: item.name,
                productName: item.name,
                price: item.price,
                quantity: 1,
                maxQty: remainingQty,
                reason: 'customer_changed_mind',
                fromBill: true
            }]);
        }
        setError('');
    };

    // Handle barcode scan/input
    const handleBarcodeSubmit = async (e) => {
        e.preventDefault();
        if (!barcode.trim()) return;

        try {
            const response = await api.get(`/product/barcode/${barcode.trim()}`);
            const product = response.data;

            if (product) {
                const existingIndex = returnItems.findIndex(ri => ri.barcode === barcode.trim());
                if (existingIndex >= 0) {
                    const updated = [...returnItems];
                    updated[existingIndex] = {
                        ...updated[existingIndex],
                        quantity: updated[existingIndex].quantity + 1
                    };
                    setReturnItems(updated);
                } else {
                    setReturnItems([...returnItems, {
                        id: Date.now().toString(),
                        product: product._id,
                        productName: product.name,
                        name: product.name,
                        barcode: barcode.trim(),
                        price: product.sellingPrice || product.price,
                        quantity: 1,
                        reason: 'customer_changed_mind',
                        fromBill: false
                    }]);
                }
                setError('');
            }
        } catch (error) {
            setError('Product not found');
        }
        setBarcode('');
        if (barcodeInputRef.current) {
            barcodeInputRef.current.focus();
        }
    };

    // Update item quantity
    const updateQuantity = (itemId, delta) => {
        setReturnItems(prev => prev.map(item => {
            if (item.id === itemId) {
                const newQty = item.quantity + delta;
                if (newQty <= 0) return null;
                if (item.maxQty && newQty > item.maxQty) {
                    setError(`Max ${item.maxQty} can be returned`);
                    return item;
                }
                return { ...item, quantity: newQty };
            }
            return item;
        }).filter(Boolean));
    };

    // Update item reason
    const updateReason = (itemId, reason) => {
        setReturnItems(prev => prev.map(item =>
            item.id === itemId ? { ...item, reason } : item
        ));
    };

    // Remove item
    const removeItem = (itemId) => {
        setReturnItems(prev => prev.filter(item => item.id !== itemId));
    };

    // Calculate totals
    const totalRefund = returnItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalItems = returnItems.reduce((sum, item) => sum + item.quantity, 0);

    // Process return
    const processReturn = async () => {
        if (returnItems.length === 0) {
            setError('Add items to return');
            return;
        }

        setProcessing(true);
        setError('');
        try {
            const payload = {
                items: returnItems.map(item => ({
                    product: item.product,
                    productName: item.productName || item.name,
                    barcode: item.barcode,
                    quantity: item.quantity,
                    price: item.price,
                    reason: item.reason
                })),
                originalBillNumber: linkedBill?.billNumber?.toString() || billNumber || null,
                refundMethod,
                customerName: customerName || linkedBill?.customerName,
                processedBy: user?.name || (isEmployee ? 'Employee' : 'Admin'),
                notes
            };

            const response = await api.post('/return', payload);
            setReturnResult(response.data);
            setShowSuccess(true);
            loadTodaySummary();
        } catch (error) {
            console.error('Error processing return:', error);
            setError(error.response?.data?.message || 'Failed to process return');
        } finally {
            setProcessing(false);
        }
    };

    // Reset form
    const resetForm = () => {
        setReturnItems([]);
        setBillNumber('');
        setLinkedBill(null);
        setCustomerName('');
        setNotes('');
        setRefundMethod('cash');
        setShowSuccess(false);
        setReturnResult(null);
        setError('');
        if (barcodeInputRef.current) {
            barcodeInputRef.current.focus();
        }
    };

    return (
        <div className="h-full bg-slate-50 dark:bg-d-bg overflow-auto">
            <div className="p-6 animate-fade-slide-up">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-d-heading">Process Return</h1>
                        <p className="text-slate-500 dark:text-d-muted">Process product returns and refunds</p>
                    </div>
                    <div className="bg-white dark:bg-d-card border border-slate-200 dark:border-d-border px-5 py-3 rounded-2xl">
                        <p className="text-xs text-slate-500 dark:text-d-muted mb-1">Today's Returns</p>
                        <p className="text-lg font-bold text-d-red">
                            {todaySummary.totalReturns} <span className="text-slate-500 dark:text-d-muted font-normal text-sm">({formatCurrency(todaySummary.totalRefunded)})</span>
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column - Bill Lookup & Barcode */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Bill Lookup Section */}
                        <div className="bg-white dark:bg-d-card rounded-2xl border border-slate-200 dark:border-d-border p-6">
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-d-heading mb-4 flex items-center gap-2">
                                <FiFileText className="text-d-accent" />
                                Link to Original Bill (Optional)
                            </h3>
                            <div className="flex gap-3">
                                <div className="relative flex-1">
                                    <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-d-faint" />
                                    <input
                                        type="text"
                                        value={billNumber}
                                        onChange={(e) => setBillNumber(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && lookupBill()}
                                        placeholder="Enter bill/receipt number..."
                                        className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl text-slate-700 dark:text-d-text placeholder-d-faint focus:outline-none focus:border-d-border-hover"
                                    />
                                </div>
                                <button
                                    onClick={lookupBill}
                                    disabled={loadingBill}
                                    className="px-6 py-3 bg-gradient-to-r from-d-accent to-d-accent-s text-d-card rounded-xl font-semibold hover:shadow-[0_4px_20px_rgba(255,210,100,0.4)] transition-all disabled:opacity-50 flex items-center gap-2"
                                >
                                    {loadingBill ? <FiRefreshCw className="animate-spin" /> : 'Lookup'}
                                </button>
                            </div>

                            {/* Linked Bill Card */}
                            {linkedBill && (
                                <div className="mt-4 bg-[rgba(255,255,255,0.02)] rounded-xl p-4 border border-[rgba(255,255,255,0.05)]">
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="font-semibold text-slate-800 dark:text-d-heading">
                                            Bill #{linkedBill.billNumber}
                                        </h4>
                                        <span className="text-sm text-slate-500 dark:text-d-muted">
                                            {new Date(linkedBill.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-500 dark:text-d-muted mb-3">
                                        {linkedBill.customerName || 'Walk-in'} • {formatCurrency(linkedBill.totalBill)}
                                    </p>
                                    {linkedBill.hasReturns && (
                                        <p className="text-xs text-d-accent mb-3 flex items-center gap-1">
                                            <FiAlertCircle size={14} />
                                            Has previous returns
                                        </p>
                                    )}
                                    <p className="text-xs text-slate-500 dark:text-d-muted mb-2">Click items to add to return:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {linkedBill.items?.map((item, index) => {
                                            const remaining = item.remainingQty !== undefined ? item.remainingQty : item.qty;
                                            const isFullyReturned = remaining <= 0;
                                            return (
                                                <button
                                                    key={index}
                                                    onClick={() => addItemFromBill(item)}
                                                    disabled={isFullyReturned}
                                                    className={`px-3 py-2 rounded-xl text-sm transition-all ${
                                                        isFullyReturned
                                                            ? 'bg-[rgba(255,255,255,0.02)] text-d-faint cursor-not-allowed'
                                                            : 'bg-d-glass text-slate-700 dark:text-d-text hover:bg-[rgba(255,210,100,0.1)] hover:border-d-border-hover border border-slate-200 dark:border-d-border'
                                                    }`}
                                                >
                                                    <span className="font-medium">{item.name}</span>
                                                    <span className="text-xs ml-2 text-slate-500 dark:text-d-muted">
                                                        {isFullyReturned ? '(Returned)' : `(${remaining} avail)`}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Barcode Input Section */}
                        <div className="bg-white dark:bg-d-card rounded-2xl border border-slate-200 dark:border-d-border p-6">
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-d-heading mb-4 flex items-center gap-2">
                                <FiPackage className="text-d-accent" />
                                Scan/Enter Product Barcode
                            </h3>
                            <form onSubmit={handleBarcodeSubmit} className="flex gap-3">
                                <div className="relative flex-1">
                                    <input
                                        ref={barcodeInputRef}
                                        type="text"
                                        value={barcode}
                                        onChange={(e) => setBarcode(e.target.value)}
                                        placeholder="Scan or enter barcode..."
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl text-slate-700 dark:text-d-text placeholder-d-faint font-mono focus:outline-none focus:border-d-border-hover"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    className="px-6 py-3 bg-gradient-to-r from-d-accent to-d-accent-s text-d-card rounded-xl font-semibold hover:shadow-[0_4px_20px_rgba(255,210,100,0.4)] transition-all flex items-center gap-2"
                                >
                                    <FiPlus />
                                    Add
                                </button>
                            </form>
                        </div>

                        {/* Return Items List */}
                        {returnItems.length > 0 && (
                            <div className="bg-white dark:bg-d-card rounded-2xl border border-slate-200 dark:border-d-border p-6">
                                <h3 className="text-lg font-semibold text-slate-800 dark:text-d-heading mb-4">
                                    Return Items ({totalItems})
                                </h3>
                                <div className="space-y-4">
                                    {returnItems.map((item) => (
                                        <div
                                            key={item.id}
                                            className="bg-[rgba(255,255,255,0.02)] rounded-xl p-4 border border-[rgba(255,255,255,0.05)]"
                                        >
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-[rgba(255,107,107,0.1)] rounded-xl flex items-center justify-center">
                                                        <FiRotateCcw className="text-d-red" size={18} />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-slate-800 dark:text-d-heading">{item.name}</p>
                                                        <p className="text-sm text-slate-500 dark:text-d-muted">
                                                            {formatCurrency(item.price)} each
                                                            {item.fromBill && (
                                                                <span className="ml-2 text-d-accent text-xs">(From Bill)</span>
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {/* Quantity Controls */}
                                                    <div className="flex items-center bg-slate-50 dark:bg-d-bg rounded-xl border border-slate-200 dark:border-d-border">
                                                        <button
                                                            onClick={() => updateQuantity(item.id, -1)}
                                                            className="p-2 hover:bg-[rgba(255,107,107,0.1)] rounded-l-xl transition-colors text-d-red"
                                                        >
                                                            <FiMinus size={16} />
                                                        </button>
                                                        <span className="px-4 py-2 font-semibold text-slate-700 dark:text-d-text min-w-[40px] text-center">
                                                            {item.quantity}
                                                        </span>
                                                        <button
                                                            onClick={() => updateQuantity(item.id, 1)}
                                                            className="p-2 hover:bg-[rgba(52,232,161,0.1)] rounded-r-xl transition-colors text-d-green"
                                                        >
                                                            <FiPlus size={16} />
                                                        </button>
                                                    </div>
                                                    {/* Subtotal */}
                                                    <span className="font-semibold text-d-red min-w-[100px] text-right font-display">
                                                        {formatCurrency(item.price * item.quantity)}
                                                    </span>
                                                    {/* Remove */}
                                                    <button
                                                        onClick={() => removeItem(item.id)}
                                                        className="p-2 text-slate-500 dark:text-d-muted hover:text-d-red hover:bg-[rgba(255,107,107,0.1)] rounded-xl transition-colors"
                                                    >
                                                        <FiTrash2 size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                            {/* Reason Selector */}
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-sm text-slate-500 dark:text-d-muted">Reason:</span>
                                                {RETURN_REASONS.map((reason) => (
                                                    <button
                                                        key={reason.value}
                                                        onClick={() => updateReason(item.id, reason.value)}
                                                        className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                                                            item.reason === reason.value
                                                                ? 'bg-d-accent text-d-card font-medium'
                                                                : 'bg-d-glass text-slate-500 dark:text-d-muted hover:bg-d-glass-hover border border-slate-200 dark:border-d-border'
                                                        }`}
                                                    >
                                                        {reason.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column - Summary & Details */}
                    <div className="space-y-6">
                        {/* Customer Details */}
                        <div className="bg-white dark:bg-d-card rounded-2xl border border-slate-200 dark:border-d-border p-6">
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-d-heading mb-4">
                                Customer Details
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm text-slate-500 dark:text-d-muted mb-2">Customer Name (Optional)</label>
                                    <input
                                        type="text"
                                        value={customerName}
                                        onChange={(e) => setCustomerName(e.target.value)}
                                        placeholder="Enter customer name..."
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl text-slate-700 dark:text-d-text placeholder-d-faint focus:outline-none focus:border-d-border-hover"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-slate-500 dark:text-d-muted mb-2">Notes (Optional)</label>
                                    <textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Add notes..."
                                        rows={3}
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl text-slate-700 dark:text-d-text placeholder-d-faint resize-none focus:outline-none focus:border-d-border-hover"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Refund Method */}
                        <div className="bg-white dark:bg-d-card rounded-2xl border border-slate-200 dark:border-d-border p-6">
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-d-heading mb-4">
                                Refund Method
                            </h3>
                            <div className="space-y-3">
                                {REFUND_METHODS.map((method) => (
                                    <button
                                        key={method.value}
                                        onClick={() => setRefundMethod(method.value)}
                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                                            refundMethod === method.value
                                                ? 'bg-gradient-to-r from-d-accent to-d-accent-s text-d-card'
                                                : 'bg-d-glass text-slate-500 dark:text-d-muted hover:bg-d-glass-hover border border-slate-200 dark:border-d-border'
                                        }`}
                                    >
                                        <span className="text-xl">{method.icon}</span>
                                        <span className="font-medium">{method.label}</span>
                                        {refundMethod === method.value && (
                                            <FiCheck className="ml-auto" size={18} />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Summary & Process Button */}
                        <div className="bg-white dark:bg-d-card rounded-2xl border border-slate-200 dark:border-d-border p-6">
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-d-heading mb-4">
                                Return Summary
                            </h3>
                            <div className="space-y-3 mb-6">
                                <div className="flex justify-between text-slate-500 dark:text-d-muted">
                                    <span>Total Items</span>
                                    <span className="font-medium text-slate-700 dark:text-d-text">{totalItems}</span>
                                </div>
                                <div className="flex justify-between text-xl font-bold pt-3 border-t border-slate-200 dark:border-d-border">
                                    <span className="text-slate-800 dark:text-d-heading">Total Refund</span>
                                    <span className="text-d-red font-display">{formatCurrency(totalRefund)}</span>
                                </div>
                            </div>

                            {error && (
                                <div className="mb-4 p-3 bg-[rgba(255,107,107,0.1)] border border-[rgba(255,107,107,0.3)] rounded-xl text-d-red text-sm flex items-center gap-2">
                                    <FiAlertCircle />
                                    {error}
                                </div>
                            )}

                            <button
                                onClick={processReturn}
                                disabled={processing || returnItems.length === 0}
                                className="w-full py-4 bg-gradient-to-r from-d-red to-[#e85555] text-white rounded-xl font-semibold hover:shadow-[0_4px_20px_rgba(255,107,107,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {processing ? (
                                    <>
                                        <FiRefreshCw className="animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <FiRotateCcw />
                                        Process Return
                                    </>
                                )}
                            </button>

                            {returnItems.length > 0 && (
                                <button
                                    onClick={resetForm}
                                    className="w-full mt-3 py-3 border border-slate-200 dark:border-d-border text-slate-500 dark:text-d-muted rounded-xl font-medium hover:bg-d-glass transition-colors"
                                >
                                    Clear All
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Success Modal */}
            {showSuccess && returnResult && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-2xl w-full max-w-md animate-pop-in">
                        <div className="p-8 text-center">
                            <div className="w-16 h-16 bg-[rgba(52,232,161,0.1)] rounded-full flex items-center justify-center mx-auto mb-4">
                                <FiCheck className="text-d-green" size={32} />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-800 dark:text-d-heading mb-2">
                                Return Processed!
                            </h3>
                            <p className="text-slate-500 dark:text-d-muted mb-6">
                                Return #{returnResult.returnNumber}
                            </p>

                            <div className="bg-[rgba(255,255,255,0.02)] rounded-xl p-4 mb-6 text-left border border-[rgba(255,255,255,0.05)]">
                                <div className="flex justify-between py-2 border-b border-slate-200 dark:border-d-border">
                                    <span className="text-slate-500 dark:text-d-muted">Items Returned</span>
                                    <span className="font-semibold text-slate-700 dark:text-d-text">{returnResult.totalItems}</span>
                                </div>
                                <div className="flex justify-between py-2 border-b border-slate-200 dark:border-d-border">
                                    <span className="text-slate-500 dark:text-d-muted">Refund Amount</span>
                                    <span className="font-semibold text-d-red">{formatCurrency(returnResult.refundAmount)}</span>
                                </div>
                                <div className="flex justify-between py-2">
                                    <span className="text-slate-500 dark:text-d-muted">Refund Method</span>
                                    <span className="font-semibold text-slate-700 dark:text-d-text uppercase">{refundMethod.replace('_', ' ')}</span>
                                </div>
                            </div>

                            <button
                                onClick={resetForm}
                                className="w-full py-3 bg-gradient-to-r from-d-green to-[#2bc88a] text-d-card rounded-xl font-semibold hover:shadow-[0_4px_20px_rgba(52,232,161,0.4)] transition-all"
                            >
                                New Return
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Returns;
