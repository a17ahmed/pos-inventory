import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TouchableOpacity,
    TextInput,
    FlatList,
    Alert,
    Modal,
    Switch,
    Dimensions,
    StatusBar,
    LayoutAnimation,
    Platform,
    UIManager,
    KeyboardAvoidingView,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useToast } from 'native-base';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../../constants/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const RetailDashboard = ({ navigation, employeeData, businessData }) => {
    const toast = useToast();
    const insets = useSafeAreaInsets();
    const [permission, requestPermission] = useCameraPermissions();
    const billScrollRef = useRef(null);
    const tabScrollRef = useRef(null);

    // Bills state - starts empty (idle mode)
    const [bills, setBills] = useState([]);
    const [billCounter, setBillCounter] = useState(0);
    const [activeBillId, setActiveBillId] = useState(null);

    // Camera
    const [cameraExpanded, setCameraExpanded] = useState(true);
    const [torchOn, setTorchOn] = useState(false);
    const [scanned, setScanned] = useState(false);

    // Search modal
    const [showSearchModal, setShowSearchModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Products cache
    const [productsCache, setProductsCache] = useState({});

    // Stats
    const [todayStats, setTodayStats] = useState({ totalSales: 0, transactions: 0 });

    // Pending modal (for Hold button)
    const [showPendingModal, setShowPendingModal] = useState(false);
    const [pendingCustomerName, setPendingCustomerName] = useState('');
    const [pendingCustomerPhone, setPendingCustomerPhone] = useState('');
    const [pendingAmountPaid, setPendingAmountPaid] = useState('');
    const [saveCustomer, setSaveCustomer] = useState(false);
    const [existingCustomer, setExistingCustomer] = useState(null); // matched customer from DB
    const customerLookupRef = useRef(null);
    const scanLockRef = useRef(false);

    const billingActive = bills.length > 0 && activeBillId !== null;
    const activeBill = bills.find(b => b.id === activeBillId) || null;
    const activeBillIndex = bills.findIndex(b => b.id === activeBillId);

    useEffect(() => {
        loadData();
        loadSavedBills();
    }, []);

    useFocusEffect(
        useCallback(() => {
            StatusBar.setBarStyle('dark-content');
            loadData();
            loadSavedBills();
        }, [])
    );

    const loadData = async () => {
        try {
            const productRes = await api.get('/product');
            const products = productRes.data || [];
            const cache = {};
            products.forEach(p => {
                if (p.barcode) cache[p.barcode] = p;
                if (p.sku) cache[p.sku] = p;
                cache[p._id] = p;
            });
            setProductsCache(cache);

            const receiptsRes = await api.get('/receipt?all=true');
            // Handle both old (array) and new (object with receipts) response formats
            const allReceipts = receiptsRes.data?.receipts || receiptsRes.data || [];
            const today = new Date().toLocaleDateString();
            const todayReceipts = allReceipts.filter(r => {
                const receiptDate = new Date(r.createdAt).toLocaleDateString();
                return receiptDate === today;
            });
            setTodayStats({
                totalSales: todayReceipts.reduce((sum, r) => sum + (r.totalBill || 0), 0),
                transactions: todayReceipts.length,
            });
        } catch (error) {
            console.error('Error loading data:', error);
        }
    };

    const saveBills = async (billsToSave, activeId) => {
        try {
            await AsyncStorage.setItem('retailBills', JSON.stringify(billsToSave));
            if (activeId !== undefined) {
                await AsyncStorage.setItem('retailActiveBillId', activeId || '');
            }
        } catch (error) {
            console.error('Error saving bills:', error);
        }
    };

    const loadSavedBills = async () => {
        try {
            const saved = await AsyncStorage.getItem('retailBills');
            const savedActiveId = await AsyncStorage.getItem('retailActiveBillId');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.length > 0) {
                    setBills(parsed);
                    const maxNum = Math.max(...parsed.map(b => parseInt(b.name.replace('Bill ', '')) || 0));
                    setBillCounter(maxNum);
                    const restoreId = savedActiveId && parsed.find(b => b.id === savedActiveId)
                        ? savedActiveId
                        : parsed[0].id;
                    setActiveBillId(restoreId);
                }
            }
        } catch (error) {
            console.error('Error loading bills:', error);
        }
    };

    const showToast = (message, type = 'info') => {
        toast.closeAll();
        toast.show({
            description: message,
            placement: "top",
            duration: 2000,
            style: {
                backgroundColor: type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6',
                borderRadius: 8,
            }
        });
    };

    // Start billing - creates first bill
    const startBilling = async () => {
        const newBill = {
            id: Date.now().toString(),
            name: 'Bill 1',
            items: [],
            createdAt: new Date().toISOString()
        };
        setBillCounter(1);
        setBills([newBill]);
        setActiveBillId(newBill.id);
        setCameraExpanded(true);
        saveBills([newBill], newBill.id);

        if (!permission?.granted) {
            const result = await requestPermission();
            if (!result.granted) {
                setCameraExpanded(false);
            }
        }
    };

    // Create new bill
    const createNewBill = () => {
        const newNum = billCounter + 1;
        const newBill = {
            id: Date.now().toString(),
            name: `Bill ${newNum}`,
            items: [],
            createdAt: new Date().toISOString()
        };
        setBillCounter(newNum);
        setBills(prev => {
            const updated = [...prev, newBill];
            saveBills(updated, newBill.id);
            return updated;
        });
        setActiveBillId(newBill.id);
        showToast(`Bill ${newNum} created`, 'success');

        // Scroll to new bill tab and page
        setTimeout(() => {
            const newIndex = bills.length; // will be at end
            billScrollRef.current?.scrollTo({ x: newIndex * SCREEN_WIDTH, animated: true });
            tabScrollRef.current?.scrollToEnd({ animated: true });
        }, 100);
    };

    // Switch to a bill
    const switchBill = (billId) => {
        setActiveBillId(billId);
        saveBills(bills, billId);
        const index = bills.findIndex(b => b.id === billId);
        if (index >= 0) {
            billScrollRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
        }
    };

    // Handle swipe between bills
    const handleBillScroll = (event) => {
        const offsetX = event.nativeEvent.contentOffset.x;
        const index = Math.round(offsetX / SCREEN_WIDTH);
        if (bills[index] && bills[index].id !== activeBillId) {
            setActiveBillId(bills[index].id);
            saveBills(bills, bills[index].id);
        }
    };

    // Add product to a specific bill
    const addProductToBill = (product, billId) => {
        if (product.trackStock && product.stockQuantity <= 0) {
            showToast(`${product.name} is out of stock`, 'error');
            return;
        }

        setBills(prev => {
            const updated = prev.map(bill => {
                if (bill.id === billId) {
                    const existingIndex = bill.items.findIndex(item => item._id === product._id);
                    if (existingIndex >= 0) {
                        const currentQty = bill.items[existingIndex].qty;
                        if (product.trackStock && currentQty >= product.stockQuantity) {
                            showToast(`Only ${product.stockQuantity} in stock`, 'error');
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
                                gst: product.gst || 0,
                                qty: 1,
                                barcode: product.barcode,
                                trackStock: product.trackStock,
                                stockQuantity: product.stockQuantity
                            }]
                        };
                    }
                }
                return bill;
            });
            saveBills(updated, billId);
            return updated;
        });

        showToast(`${product.name} added`, 'success');
    };

    // Barcode scan handler
    const handleBarCodeScanned = async ({ type, data }) => {
        if (!activeBillId) return;
        if (scanLockRef.current) return;
        scanLockRef.current = true;
        setScanned(true);

        let product = productsCache[data];

        if (!product) {
            try {
                const response = await api.get(`/product/barcode/${data}`);
                product = response.data;
                setProductsCache(prev => ({ ...prev, [data]: product }));
            } catch (error) {
                showToast(`Product not found: ${data}`, 'error');
                setTimeout(() => {
                    scanLockRef.current = false;
                    setScanned(false);
                }, 1500);
                return;
            }
        }

        if (product && activeBillId) {
            addProductToBill(product, activeBillId);
        }

        setTimeout(() => {
            scanLockRef.current = false;
            setScanned(false);
        }, 1500);
    };

    // Update item quantity
    const updateQuantity = (billId, itemId, delta) => {
        setBills(prev => {
            const updated = prev.map(bill => {
                if (bill.id === billId) {
                    const newItems = bill.items.map(item => {
                        if (item._id === itemId) {
                            const newQty = item.qty + delta;
                            if (newQty <= 0) return null;
                            if (delta > 0 && item.trackStock && newQty > item.stockQuantity) {
                                showToast(`Only ${item.stockQuantity} in stock`, 'error');
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

    // Remove item from bill
    const removeItem = (billId, itemId) => {
        setBills(prev => {
            const updated = prev.map(bill => {
                if (bill.id === billId) {
                    return { ...bill, items: bill.items.filter(item => item._id !== itemId) };
                }
                return bill;
            });
            saveBills(updated, activeBillId);
            return updated;
        });
    };

    // Delete bill
    const deleteBill = (billId) => {
        Alert.alert('Delete Bill', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: () => {
                    if (bills.length === 1) {
                        // Last bill - go back to idle mode
                        setBills([]);
                        setActiveBillId(null);
                        saveBills([], null);
                    } else {
                        setBills(prev => {
                            const updated = prev.filter(b => b.id !== billId);
                            // If we deleted the active bill, switch to first remaining
                            let newActiveId = activeBillId;
                            if (billId === activeBillId) {
                                newActiveId = updated[0]?.id || null;
                                setActiveBillId(newActiveId);
                                // Scroll to the new active bill
                                setTimeout(() => {
                                    billScrollRef.current?.scrollTo({ x: 0, animated: true });
                                }, 100);
                            }
                            saveBills(updated, newActiveId);
                            return updated;
                        });
                    }
                }
            }
        ]);
    };

    // Calculate bill total
    const getBillTotal = (bill) => {
        const subtotal = bill.items.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const tax = bill.items.reduce((sum, item) => sum + ((item.price * (item.gst || 0) / 100) * item.qty), 0);
        return { subtotal, tax, total: subtotal + tax };
    };

    // Checkout
    const handleCheckout = (bill) => {
        if (!bill || bill.items.length === 0) {
            showToast('Add items first', 'error');
            return;
        }

        const { subtotal, tax, total } = getBillTotal(bill);

        navigation.navigate('Checkout', {
            cart: bill.items,
            subtotal,
            tax,
            total,
            employeeData,
            businessData,
            onComplete: () => {
                if (bills.length > 1) {
                    setBills(prev => {
                        const updated = prev.filter(b => b.id !== bill.id);
                        const newActiveId = updated[0]?.id || null;
                        setActiveBillId(newActiveId);
                        saveBills(updated, newActiveId);
                        setTimeout(() => {
                            billScrollRef.current?.scrollTo({ x: 0, animated: true });
                        }, 100);
                        return updated;
                    });
                } else {
                    // Last bill - go to idle
                    setBills([]);
                    setActiveBillId(null);
                    saveBills([], null);
                }
                loadData();
            }
        });
    };

    // Toggle camera expand/collapse
    const toggleCamera = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setCameraExpanded(prev => {
            if (prev) setTorchOn(false); // turn off flash when collapsing
            return !prev;
        });
    };

    // Search products from cache
    const getSearchResults = () => {
        if (!searchQuery.trim()) return [];
        const query = searchQuery.toLowerCase().trim();
        const seen = new Set();
        const results = [];
        Object.values(productsCache).forEach(product => {
            if (seen.has(product._id)) return;
            if (
                product.name?.toLowerCase().includes(query) ||
                product.barcode?.toLowerCase().includes(query) ||
                product.sku?.toLowerCase().includes(query)
            ) {
                seen.add(product._id);
                results.push(product);
            }
        });
        return results.slice(0, 20);
    };

    const searchResults = getSearchResults();

    // Lookup customer by phone (debounced)
    const lookupCustomerByPhone = (phone) => {
        setExistingCustomer(null);
        if (customerLookupRef.current) clearTimeout(customerLookupRef.current);
        const trimmed = phone.trim();
        if (trimmed.length < 4) return;
        customerLookupRef.current = setTimeout(async () => {
            try {
                const res = await api.get(`/customer/search?q=${trimmed}`);
                const matches = res.data || [];
                // Find exact phone match
                const exact = matches.find(c => c.phone === trimmed);
                if (exact) {
                    setExistingCustomer(exact);
                    setPendingCustomerName(exact.name);
                } else {
                    setExistingCustomer(null);
                }
            } catch (err) {
                // silent fail
            }
        }, 500);
    };

    const handlePhoneChange = (text) => {
        setPendingCustomerPhone(text);
        lookupCustomerByPhone(text);
    };

    // Hold/park the active bill
    const holdBill = async () => {
        if (!activeBill || activeBill.items.length === 0) return;

        const { subtotal, tax, total } = getBillTotal(activeBill);
        const amountPaid = parseFloat(pendingAmountPaid) || 0;

        if (amountPaid > total) {
            showToast('Amount paid cannot exceed total', 'error');
            return;
        }

        let customerId = existingCustomer?._id || null;

        // Save customer if toggle is on and name+phone provided (and not already existing)
        if (!customerId && saveCustomer && pendingCustomerName.trim() && pendingCustomerPhone.trim()) {
            try {
                const customerRes = await api.post('/customer', {
                    name: pendingCustomerName.trim(),
                    phone: pendingCustomerPhone.trim(),
                });
                customerId = customerRes.data._id;
            } catch (err) {
                console.warn('Customer save failed:', err);
            }
        }

        try {
            await api.post('/pending-bill', {
                billName: activeBill.name,
                items: activeBill.items,
                customerName: pendingCustomerName.trim(),
                customerPhone: pendingCustomerPhone.trim(),
                employeeName: employeeData?.name || 'Staff',
                employeeId: employeeData?._id,
                subtotal,
                tax,
                total,
                amountPaid,
                customerId,
            });

            // Remove bill from active bills (same as checkout completion)
            if (bills.length > 1) {
                setBills(prev => {
                    const updated = prev.filter(b => b.id !== activeBill.id);
                    const newActiveId = updated[0]?.id || null;
                    setActiveBillId(newActiveId);
                    saveBills(updated, newActiveId);
                    setTimeout(() => {
                        billScrollRef.current?.scrollTo({ x: 0, animated: true });
                    }, 100);
                    return updated;
                });
            } else {
                setBills([]);
                setActiveBillId(null);
                saveBills([], null);
            }

            setShowPendingModal(false);
            setPendingCustomerName('');
            setPendingCustomerPhone('');
            setPendingAmountPaid('');
            setSaveCustomer(false);
            setExistingCustomer(null);
            showToast('Bill saved as pending', 'success');
        } catch (error) {
            console.error('Error holding bill:', error);
            showToast('Failed to save pending bill', 'error');
        }
    };

    // ============ RENDER ============

    // Idle Mode - no bills
    if (!billingActive) {
        return (
            <View style={[styles.container, { paddingTop: insets.top }]}>
                <StatusBar barStyle="dark-content" backgroundColor="#fff" />

                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.headerTitle}>{businessData?.name || 'Retail POS'}</Text>
                        <Text style={styles.headerStats}>
                            Today: Rs. {todayStats.totalSales.toLocaleString()} {'\u2022'} {todayStats.transactions} sales
                        </Text>
                    </View>
                    <View style={styles.headerActions}>
                        <TouchableOpacity
                            style={styles.returnsBtn}
                            onPress={() => navigation.navigate('Returns')}
                        >
                            <MaterialIcons name="assignment-return" size={22} color="#64748b" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Start Billing CTA */}
                <View style={styles.idleContainer}>
                    <View style={styles.idleIconWrapper}>
                        <MaterialCommunityIcons name="barcode-scan" size={64} color="#c4b5fd" />
                    </View>
                    <Text style={styles.idleTitle}>Ready to sell</Text>
                    <Text style={styles.idleSubtitle}>Start a new bill to begin scanning products</Text>
                    <TouchableOpacity style={styles.startBillingBtn} onPress={startBilling}>
                        <MaterialCommunityIcons name="barcode-scan" size={22} color="#fff" />
                        <Text style={styles.startBillingBtnText}>Start Billing</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    // Billing Mode
    const activeTotal = activeBill ? getBillTotal(activeBill) : { subtotal: 0, tax: 0, total: 0 };
    const activeItemCount = activeBill ? activeBill.items.reduce((sum, item) => sum + item.qty, 0) : 0;

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <StatusBar barStyle="dark-content" backgroundColor="#fff" />

            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>{businessData?.name || 'Retail POS'}</Text>
                    <Text style={styles.headerStats}>
                        Today: Rs. {todayStats.totalSales.toLocaleString()} {'\u2022'} {todayStats.transactions} sales
                    </Text>
                </View>
                <View style={styles.headerActions}>
                    <TouchableOpacity
                        style={styles.headerIconBtn}
                        onPress={() => { setSearchQuery(''); setShowSearchModal(true); }}
                    >
                        <MaterialIcons name="search" size={22} color="#8b5cf6" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.headerIconBtn}
                        onPress={() => navigation.navigate('Returns')}
                    >
                        <MaterialIcons name="assignment-return" size={22} color="#64748b" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Bill Tabs */}
            <View style={styles.tabsWrapper}>
                <ScrollView
                    ref={tabScrollRef}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.tabsContainer}
                    style={styles.tabsScroll}
                >
                    {bills.map((bill) => {
                        const isActive = bill.id === activeBillId;
                        const itemCount = bill.items.reduce((sum, item) => sum + item.qty, 0);
                        return (
                            <TouchableOpacity
                                key={bill.id}
                                style={[styles.tabItem, isActive && styles.tabItemActive]}
                                onPress={() => switchBill(bill.id)}
                            >
                                <Text style={[styles.tabItemText, isActive && styles.tabItemTextActive]}>
                                    {bill.name}
                                </Text>
                                {itemCount > 0 && (
                                    <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
                                        <Text style={[styles.tabBadgeText, isActive && styles.tabBadgeTextActive]}>
                                            {itemCount}
                                        </Text>
                                    </View>
                                )}
                                {bills.length > 1 && (
                                    <TouchableOpacity
                                        style={styles.tabDeleteBtn}
                                        onPress={(e) => {
                                            e.stopPropagation();
                                            deleteBill(bill.id);
                                        }}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <MaterialIcons name="close" size={14} color={isActive ? '#ddd6fe' : '#94a3b8'} />
                                    </TouchableOpacity>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
                <TouchableOpacity style={styles.tabAddBtn} onPress={createNewBill}>
                    <MaterialIcons name="add" size={20} color="#8b5cf6" />
                </TouchableOpacity>
            </View>

            {/* Camera Section - Collapsible */}
            {cameraExpanded ? (
                <View style={styles.cameraContainer}>
                    {permission?.granted ? (
                        <CameraView
                            style={styles.cameraView}
                            facing="back"
                            enableTorch={torchOn}
                            barcodeScannerSettings={{
                                barcodeTypes: ['qr', 'ean13', 'ean8', 'upc_a', 'upc_e', 'code39', 'code128'],
                            }}
                            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                        >
                            {/* Scan frame overlay */}
                            <View style={styles.cameraOverlay}>
                                <View style={styles.scanFrame}>
                                    <View style={[styles.scanCorner, styles.topLeft]} />
                                    <View style={[styles.scanCorner, styles.topRight]} />
                                    <View style={[styles.scanCorner, styles.bottomLeft]} />
                                    <View style={[styles.scanCorner, styles.bottomRight]} />
                                </View>
                            </View>
                            {/* Top camera controls */}
                            <View style={styles.cameraTopControls}>
                                <TouchableOpacity style={styles.cameraCollapseOverlay} onPress={toggleCamera}>
                                    <MaterialIcons name="keyboard-arrow-up" size={20} color="#fff" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.cameraFlashBtn, torchOn && styles.cameraFlashBtnActive]}
                                    onPress={() => setTorchOn(prev => !prev)}
                                >
                                    <MaterialIcons name={torchOn ? 'flash-on' : 'flash-off'} size={18} color="#fff" />
                                </TouchableOpacity>
                            </View>
                            {/* Bill info badge on camera */}
                            <View style={styles.cameraBillBadge}>
                                <Text style={styles.cameraBillBadgeText}>
                                    {activeItemCount} items {'\u2022'} Rs. {activeTotal.total.toLocaleString()}
                                </Text>
                            </View>
                        </CameraView>
                    ) : (
                        <View style={styles.cameraPermissionBox}>
                            <MaterialIcons name="no-photography" size={32} color="#94a3b8" />
                            <Text style={styles.cameraPermissionText}>Camera permission required</Text>
                            <TouchableOpacity style={styles.grantPermBtn} onPress={requestPermission}>
                                <Text style={styles.grantPermBtnText}>Grant Permission</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            ) : (
                <TouchableOpacity style={styles.cameraCollapsedBar} onPress={toggleCamera} activeOpacity={0.7}>
                    <MaterialCommunityIcons name="barcode-scan" size={18} color="#8b5cf6" />
                    <Text style={styles.cameraCollapsedText}>Scan</Text>
                    <MaterialIcons name="keyboard-arrow-down" size={20} color="#8b5cf6" />
                </TouchableOpacity>
            )}

            {/* Swipeable Bills Content */}
            <ScrollView
                ref={billScrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={handleBillScroll}
                scrollEventThrottle={16}
                style={styles.billPager}
            >
                {bills.map((bill) => {
                    const { subtotal, tax, total } = getBillTotal(bill);
                    return (
                        <View key={bill.id} style={[styles.billPage, { width: SCREEN_WIDTH }]}>
                            {bill.items.length === 0 ? (
                                <View style={styles.emptyBillState}>
                                    <MaterialCommunityIcons name="package-variant" size={48} color="#e2e8f0" />
                                    <Text style={styles.emptyBillText}>No items yet</Text>
                                    <Text style={styles.emptyBillSubtext}>Scan a barcode or search to add products</Text>
                                </View>
                            ) : (
                                <FlatList
                                    data={bill.items}
                                    keyExtractor={(item) => item._id}
                                    contentContainerStyle={{ paddingBottom: 120 }}
                                    renderItem={({ item }) => (
                                        <View style={styles.itemRow}>
                                            <View style={styles.itemInfo}>
                                                <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                                                <Text style={styles.itemUnitPrice}>Rs. {item.price.toLocaleString()} each</Text>
                                            </View>
                                            <View style={styles.qtyControls}>
                                                <TouchableOpacity
                                                    style={styles.qtyBtn}
                                                    onPress={() => updateQuantity(bill.id, item._id, -1)}
                                                >
                                                    <MaterialIcons name="remove" size={18} color="#ef4444" />
                                                </TouchableOpacity>
                                                <Text style={styles.qtyText}>{item.qty}</Text>
                                                <TouchableOpacity
                                                    style={styles.qtyBtn}
                                                    onPress={() => updateQuantity(bill.id, item._id, 1)}
                                                >
                                                    <MaterialIcons name="add" size={18} color="#10b981" />
                                                </TouchableOpacity>
                                            </View>
                                            <Text style={styles.itemTotal}>Rs. {(item.price * item.qty).toLocaleString()}</Text>
                                            <TouchableOpacity
                                                style={styles.itemDeleteBtn}
                                                onPress={() => removeItem(bill.id, item._id)}
                                            >
                                                <MaterialIcons name="delete-outline" size={20} color="#94a3b8" />
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                    ListFooterComponent={
                                        bill.items.length > 0 ? (
                                            <View style={styles.billSummary}>
                                                <View style={styles.summaryRow}>
                                                    <Text style={styles.summaryLabel}>Subtotal</Text>
                                                    <Text style={styles.summaryValue}>Rs. {subtotal.toLocaleString()}</Text>
                                                </View>
                                                {tax > 0 && (
                                                    <View style={styles.summaryRow}>
                                                        <Text style={styles.summaryLabel}>Tax</Text>
                                                        <Text style={styles.summaryValue}>Rs. {tax.toLocaleString()}</Text>
                                                    </View>
                                                )}
                                                <View style={[styles.summaryRow, styles.summaryTotal]}>
                                                    <Text style={styles.summaryTotalLabel}>Total</Text>
                                                    <Text style={styles.summaryTotalValue}>Rs. {total.toLocaleString()}</Text>
                                                </View>
                                            </View>
                                        ) : null
                                    }
                                />
                            )}
                        </View>
                    );
                })}
            </ScrollView>

            {/* Floating Action Buttons: Hold + Checkout */}
            {activeBill && activeBill.items.length > 0 && (
                <View style={[styles.fabWrapper, { bottom: insets.bottom + 16 }]}>
                    <TouchableOpacity
                        style={styles.holdButton}
                        onPress={() => { setPendingCustomerName(''); setPendingCustomerPhone(''); setPendingAmountPaid(''); setSaveCustomer(false); setExistingCustomer(null); setShowPendingModal(true); }}
                        activeOpacity={0.85}
                    >
                        <MaterialIcons name="pause" size={20} color="#8b5cf6" />
                        <Text style={styles.holdText}>Hold</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.fabButton}
                        onPress={() => handleCheckout(activeBill)}
                        activeOpacity={0.85}
                    >
                        <MaterialIcons name="shopping-cart" size={20} color="#fff" />
                        <Text style={styles.fabText}>Checkout - Rs. {activeTotal.total.toLocaleString()}</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Hold / Pending Modal */}
            <Modal visible={showPendingModal} animationType="slide" transparent>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.searchModalOverlay}
                >
                    <View style={[styles.pendingModalContent, { paddingBottom: insets.bottom + 16 }]}>
                        <View style={styles.searchModalHeader}>
                            <TouchableOpacity onPress={() => setShowPendingModal(false)}>
                                <MaterialIcons name="close" size={24} color="#64748b" />
                            </TouchableOpacity>
                            <Text style={styles.searchModalTitle}>Hold Bill</Text>
                            <View style={{ width: 24 }} />
                        </View>

                        <View style={styles.pendingModalBody}>
                            {/* Employee info */}
                            <View style={styles.pendingEmployeeRow}>
                                <MaterialIcons name="person" size={18} color="#64748b" />
                                <Text style={styles.pendingEmployeeText}>
                                    By: {employeeData?.name || 'Staff'}
                                </Text>
                            </View>

                            {/* Customer Phone */}
                            <Text style={styles.pendingInputLabel}>Phone Number (optional)</Text>
                            <View style={[styles.pendingInputWrapper, existingCustomer && styles.pendingInputMatched]}>
                                <MaterialIcons name="phone" size={20} color={existingCustomer ? '#10b981' : '#94a3b8'} />
                                <TextInput
                                    style={styles.pendingInput}
                                    placeholder="Enter phone number"
                                    placeholderTextColor="#94a3b8"
                                    value={pendingCustomerPhone}
                                    onChangeText={handlePhoneChange}
                                    keyboardType="phone-pad"
                                />
                                {existingCustomer && (
                                    <MaterialIcons name="check-circle" size={20} color="#10b981" />
                                )}
                            </View>
                            {existingCustomer && (
                                <View style={styles.customerMatchBanner}>
                                    <MaterialIcons name="person" size={14} color="#10b981" />
                                    <Text style={styles.customerMatchText}>
                                        Existing customer: {existingCustomer.name}
                                    </Text>
                                </View>
                            )}

                            {/* Customer Name */}
                            <Text style={styles.pendingInputLabel}>Customer Name (optional)</Text>
                            <View style={styles.pendingInputWrapper}>
                                <MaterialIcons name="person-outline" size={20} color="#94a3b8" />
                                <TextInput
                                    style={styles.pendingInput}
                                    placeholder="Enter customer name"
                                    placeholderTextColor="#94a3b8"
                                    value={pendingCustomerName}
                                    onChangeText={setPendingCustomerName}
                                />
                            </View>

                            {/* Amount Paid */}
                            <Text style={styles.pendingInputLabel}>Amount Paid (optional)</Text>
                            <View style={styles.pendingInputWrapper}>
                                <MaterialIcons name="payments" size={20} color="#94a3b8" />
                                <TextInput
                                    style={styles.pendingInput}
                                    placeholder="0"
                                    placeholderTextColor="#94a3b8"
                                    value={pendingAmountPaid}
                                    onChangeText={setPendingAmountPaid}
                                    keyboardType="numeric"
                                />
                            </View>
                            {parseFloat(pendingAmountPaid) > 0 && (
                                <View style={styles.remainingRow}>
                                    <Text style={styles.remainingLabel}>Remaining:</Text>
                                    <Text style={styles.remainingValue}>
                                        Rs. {Math.max(0, activeTotal.total - (parseFloat(pendingAmountPaid) || 0)).toLocaleString()}
                                    </Text>
                                </View>
                            )}

                            {/* Save Customer Toggle - only show if customer is new */}
                            {!existingCustomer && pendingCustomerName.trim().length > 0 && pendingCustomerPhone.trim().length > 0 && (
                                <View style={styles.saveCustomerRow}>
                                    <View style={styles.saveCustomerInfo}>
                                        <MaterialIcons name="person-add" size={18} color="#8b5cf6" />
                                        <Text style={styles.saveCustomerText}>Save this customer</Text>
                                    </View>
                                    <Switch
                                        value={saveCustomer}
                                        onValueChange={setSaveCustomer}
                                        trackColor={{ false: '#e2e8f0', true: '#c4b5fd' }}
                                        thumbColor={saveCustomer ? '#8b5cf6' : '#f4f3f4'}
                                    />
                                </View>
                            )}

                            {/* Bill summary */}
                            <View style={styles.pendingBillSummary}>
                                <View>
                                    <Text style={styles.pendingBillSummaryLabel}>
                                        {activeBill?.name} {'\u2022'} {activeItemCount} items
                                    </Text>
                                    {parseFloat(pendingAmountPaid) > 0 && (
                                        <Text style={styles.pendingBillPaidNote}>
                                            Paid: Rs. {parseFloat(pendingAmountPaid).toLocaleString()}
                                        </Text>
                                    )}
                                </View>
                                <Text style={styles.pendingBillSummaryTotal}>
                                    Rs. {activeTotal.total.toLocaleString()}
                                </Text>
                            </View>

                            {/* Save button */}
                            <TouchableOpacity style={styles.pendingSaveBtn} onPress={holdBill}>
                                <MaterialIcons name="save" size={20} color="#fff" />
                                <Text style={styles.pendingSaveBtnText}>Save as Pending</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Search Modal */}
            <Modal visible={showSearchModal} animationType="slide" transparent>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.searchModalOverlay}
                >
                    <View style={[styles.searchModalContent, { paddingBottom: insets.bottom + 16 }]}>
                        {/* Modal Header */}
                        <View style={styles.searchModalHeader}>
                            <TouchableOpacity onPress={() => setShowSearchModal(false)}>
                                <MaterialIcons name="close" size={24} color="#64748b" />
                            </TouchableOpacity>
                            <Text style={styles.searchModalTitle}>Search Products</Text>
                            <View style={{ width: 24 }} />
                        </View>

                        {/* Search Input */}
                        <View style={styles.searchInputWrapper}>
                            <MaterialIcons name="search" size={20} color="#94a3b8" />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Type product name, barcode, or SKU..."
                                placeholderTextColor="#94a3b8"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                autoFocus
                                returnKeyType="search"
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery('')}>
                                    <MaterialIcons name="close" size={20} color="#94a3b8" />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Search Results */}
                        <FlatList
                            data={searchResults}
                            keyExtractor={(item) => item._id}
                            style={styles.searchResultsList}
                            keyboardShouldPersistTaps="handled"
                            renderItem={({ item: product }) => {
                                const outOfStock = product.trackStock && product.stockQuantity <= 0;
                                return (
                                    <View style={[styles.searchResultItem, outOfStock && styles.searchResultDisabled]}>
                                        <View style={styles.searchResultInfo}>
                                            <Text style={styles.searchResultName} numberOfLines={1}>{product.name}</Text>
                                            <Text style={styles.searchResultMeta}>
                                                Rs. {(product.sellingPrice || product.price || 0).toLocaleString()}
                                                {product.barcode ? ` | ${product.barcode}` : ''}
                                                {product.trackStock ? ` | Stock: ${product.stockQuantity}` : ''}
                                            </Text>
                                        </View>
                                        <TouchableOpacity
                                            style={[styles.searchAddBtn, outOfStock && styles.searchAddBtnDisabled]}
                                            onPress={() => {
                                                if (!outOfStock && activeBillId) {
                                                    addProductToBill(product, activeBillId);
                                                }
                                            }}
                                            disabled={outOfStock}
                                        >
                                            <MaterialIcons name="add" size={20} color={outOfStock ? '#d1d5db' : '#fff'} />
                                        </TouchableOpacity>
                                    </View>
                                );
                            }}
                            ListEmptyComponent={
                                searchQuery.length > 0 ? (
                                    <View style={styles.searchEmpty}>
                                        <Text style={styles.searchEmptyText}>No products found</Text>
                                    </View>
                                ) : (
                                    <View style={styles.searchEmpty}>
                                        <MaterialIcons name="search" size={40} color="#e2e8f0" />
                                        <Text style={styles.searchEmptyText}>Type to search products</Text>
                                    </View>
                                )
                            }
                        />
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
};

export default RetailDashboard;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    // Header
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
    },
    headerStats: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerIconBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#f5f3ff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    returnsBtn: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Idle Mode
    idleContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 40,
        paddingVertical: 60,
    },
    idleIconWrapper: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#f5f3ff',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    idleTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 8,
    },
    idleSubtitle: {
        fontSize: 15,
        color: '#64748b',
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 22,
    },
    startBillingBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#8b5cf6',
        paddingVertical: 16,
        paddingHorizontal: 40,
        borderRadius: 14,
        gap: 10,
        shadowColor: '#8b5cf6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    startBillingBtnText: {
        fontSize: 17,
        fontWeight: '700',
        color: '#fff',
    },

    // Bill Tabs
    tabsWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    tabsScroll: {
        flex: 1,
    },
    tabsContainer: {
        paddingLeft: 12,
        paddingRight: 4,
        paddingVertical: 10,
        gap: 8,
        alignItems: 'center',
    },
    tabItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 20,
        backgroundColor: '#f1f5f9',
        gap: 6,
    },
    tabItemActive: {
        backgroundColor: '#8b5cf6',
    },
    tabItemText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#475569',
    },
    tabItemTextActive: {
        color: '#fff',
    },
    tabBadge: {
        backgroundColor: '#e2e8f0',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 6,
    },
    tabBadgeActive: {
        backgroundColor: 'rgba(255,255,255,0.25)',
    },
    tabBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#475569',
    },
    tabBadgeTextActive: {
        color: '#fff',
    },
    tabDeleteBtn: {
        marginLeft: 2,
    },
    tabAddBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#f5f3ff',
        borderWidth: 1.5,
        borderColor: '#8b5cf6',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },

    // Camera Section
    cameraContainer: {
        overflow: 'hidden',
        backgroundColor: '#000',
    },
    cameraView: {
        height: 200,
    },
    cameraOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scanFrame: {
        width: 180,
        height: 120,
        position: 'relative',
    },
    scanCorner: {
        position: 'absolute',
        width: 24,
        height: 24,
        borderColor: '#8b5cf6',
    },
    topLeft: {
        top: 0,
        left: 0,
        borderTopWidth: 3,
        borderLeftWidth: 3,
        borderTopLeftRadius: 8,
    },
    topRight: {
        top: 0,
        right: 0,
        borderTopWidth: 3,
        borderRightWidth: 3,
        borderTopRightRadius: 8,
    },
    bottomLeft: {
        bottom: 0,
        left: 0,
        borderBottomWidth: 3,
        borderLeftWidth: 3,
        borderBottomLeftRadius: 8,
    },
    bottomRight: {
        bottom: 0,
        right: 0,
        borderBottomWidth: 3,
        borderRightWidth: 3,
        borderBottomRightRadius: 8,
    },
    cameraBillBadge: {
        position: 'absolute',
        bottom: 10,
        alignSelf: 'center',
        backgroundColor: 'rgba(139, 92, 246, 0.9)',
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 14,
    },
    cameraBillBadgeText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#fff',
    },
    cameraPermissionBox: {
        height: 200,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
        gap: 8,
    },
    cameraPermissionText: {
        fontSize: 14,
        color: '#94a3b8',
    },
    grantPermBtn: {
        marginTop: 4,
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: '#8b5cf6',
        borderRadius: 8,
    },
    grantPermBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#fff',
    },
    cameraTopControls: {
        position: 'absolute',
        top: 8,
        right: 8,
        flexDirection: 'row',
        gap: 8,
    },
    cameraCollapseOverlay: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cameraFlashBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cameraFlashBtnActive: {
        backgroundColor: '#f59e0b',
    },
    cameraCollapsedBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        gap: 6,
        backgroundColor: '#f5f3ff',
        borderBottomWidth: 1,
        borderBottomColor: '#e9e5ff',
    },
    cameraCollapsedText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#8b5cf6',
    },

    // Bill Pager (Swipeable)
    billPager: {
        flex: 1,
    },
    billPage: {
        flex: 1,
    },

    // Empty Bill State
    emptyBillState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 60,
    },
    emptyBillText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#94a3b8',
        marginTop: 12,
    },
    emptyBillSubtext: {
        fontSize: 13,
        color: '#cbd5e1',
        marginTop: 4,
    },

    // Item Row
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    itemInfo: {
        flex: 1,
    },
    itemName: {
        fontSize: 15,
        fontWeight: '500',
        color: '#1e293b',
    },
    itemUnitPrice: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    qtyControls: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        marginHorizontal: 10,
    },
    qtyBtn: {
        padding: 8,
    },
    qtyText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1e293b',
        minWidth: 28,
        textAlign: 'center',
    },
    itemTotal: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1e293b',
        minWidth: 65,
        textAlign: 'right',
        marginRight: 8,
    },
    itemDeleteBtn: {
        padding: 4,
    },

    // Bill Summary
    billSummary: {
        marginHorizontal: 16,
        marginTop: 8,
        padding: 16,
        backgroundColor: '#fff',
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    summaryLabel: {
        fontSize: 14,
        color: '#64748b',
    },
    summaryValue: {
        fontSize: 14,
        color: '#1e293b',
    },
    summaryTotal: {
        paddingTop: 10,
        marginTop: 6,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        marginBottom: 0,
    },
    summaryTotalLabel: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b',
    },
    summaryTotalValue: {
        fontSize: 18,
        fontWeight: '700',
        color: '#10b981',
    },

    // FAB
    fabWrapper: {
        position: 'absolute',
        left: 16,
        right: 16,
        flexDirection: 'row',
        gap: 10,
    },
    holdButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        paddingVertical: 16,
        paddingHorizontal: 18,
        borderRadius: 14,
        gap: 6,
        borderWidth: 2,
        borderColor: '#8b5cf6',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    holdText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#8b5cf6',
    },
    fabButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#8b5cf6',
        paddingVertical: 16,
        borderRadius: 14,
        gap: 8,
        shadowColor: '#8b5cf6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 8,
    },
    fabText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#fff',
    },

    // Pending Modal
    pendingModalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
    },
    pendingModalBody: {
        paddingHorizontal: 20,
        paddingTop: 8,
    },
    pendingEmployeeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 20,
        paddingVertical: 10,
        paddingHorizontal: 14,
        backgroundColor: '#f8fafc',
        borderRadius: 10,
    },
    pendingEmployeeText: {
        fontSize: 14,
        color: '#475569',
        fontWeight: '500',
    },
    pendingInputLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#475569',
        marginBottom: 6,
    },
    pendingInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: '#f8fafc',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        gap: 8,
        marginBottom: 16,
    },
    pendingInput: {
        flex: 1,
        fontSize: 15,
        color: '#1e293b',
        padding: 0,
    },
    pendingBillSummary: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 14,
        backgroundColor: '#f5f3ff',
        borderRadius: 10,
        marginBottom: 20,
    },
    pendingBillSummaryLabel: {
        fontSize: 14,
        color: '#64748b',
    },
    pendingBillSummaryTotal: {
        fontSize: 16,
        fontWeight: '700',
        color: '#8b5cf6',
    },
    pendingSaveBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f59e0b',
        paddingVertical: 16,
        borderRadius: 14,
        gap: 8,
        marginBottom: 8,
    },
    pendingSaveBtnText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
    remainingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: '#fefce8',
        borderRadius: 8,
        marginTop: -8,
        marginBottom: 16,
    },
    remainingLabel: {
        fontSize: 13,
        color: '#92400e',
        fontWeight: '500',
    },
    remainingValue: {
        fontSize: 15,
        fontWeight: '700',
        color: '#f59e0b',
    },
    pendingInputMatched: {
        borderColor: '#10b981',
        borderWidth: 1.5,
        backgroundColor: '#f0fdf4',
    },
    customerMatchBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#ecfdf5',
        borderRadius: 8,
        marginTop: -8,
        marginBottom: 16,
    },
    customerMatchText: {
        fontSize: 13,
        color: '#059669',
        fontWeight: '500',
    },
    saveCustomerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        paddingHorizontal: 14,
        backgroundColor: '#f5f3ff',
        borderRadius: 10,
        marginBottom: 16,
    },
    saveCustomerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    saveCustomerText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#475569',
    },
    pendingBillPaidNote: {
        fontSize: 12,
        color: '#10b981',
        marginTop: 2,
    },

    // Search Modal
    searchModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    searchModalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '80%',
    },
    searchModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    searchModalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
    },
    searchInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 20,
        marginVertical: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: '#f8fafc',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        gap: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: '#1e293b',
        padding: 0,
    },
    searchResultsList: {
        maxHeight: 400,
    },
    searchResultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    searchResultDisabled: {
        opacity: 0.5,
    },
    searchResultInfo: {
        flex: 1,
    },
    searchResultName: {
        fontSize: 15,
        fontWeight: '500',
        color: '#1e293b',
    },
    searchResultMeta: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 3,
    },
    searchAddBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#8b5cf6',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 12,
    },
    searchAddBtnDisabled: {
        backgroundColor: '#e2e8f0',
    },
    searchEmpty: {
        padding: 40,
        alignItems: 'center',
        gap: 8,
    },
    searchEmptyText: {
        fontSize: 15,
        color: '#94a3b8',
    },
});
