import React, { useState, useEffect, useCallback } from 'react';
import {
    StyleSheet,
    Text,
    View,
    FlatList,
    TouchableOpacity,
    TextInput,
    Dimensions,
    StatusBar,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useToast } from 'native-base';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../../constants/api';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

const ProductsScreen = ({ navigation, employeeData, businessData }) => {
    const toast = useToast();
    const insets = useSafeAreaInsets();

    const [products, setProducts] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [categories, setCategories] = useState(['All']);
    const [refreshing, setRefreshing] = useState(false);

    // Active bill info
    const [activeBillName, setActiveBillName] = useState('Bill 1');
    const [activeBillItemCount, setActiveBillItemCount] = useState(0);

    useEffect(() => {
        loadProducts();
    }, []);

    useFocusEffect(
        useCallback(() => {
            StatusBar.setBarStyle('dark-content');
            loadBillInfo();
        }, [])
    );

    const loadProducts = async () => {
        try {
            setLoading(true);
            const response = await api.get('/product');
            const data = response.data || [];
            setProducts(data);
            setFilteredProducts(data);

            // Extract categories
            const cats = ['All', ...new Set(data.map(p => p.category || 'Uncategorized').filter(Boolean))];
            setCategories(cats);
        } catch (error) {
            console.error('Error loading products:', error);
            showToast('Failed to load products', 'error');
        } finally {
            setLoading(false);
        }
    };

    const loadBillInfo = async () => {
        try {
            const saved = await AsyncStorage.getItem('retailBills');
            const savedActiveId = await AsyncStorage.getItem('retailActiveBillId');
            if (saved) {
                let bills;
                try { bills = JSON.parse(saved); } catch (e) { return; }
                if (bills.length > 0) {
                    // Find active bill by saved ID, fall back to first
                    const activeBill = (savedActiveId && bills.find(b => b.id === savedActiveId)) || bills[0];
                    setActiveBillName(activeBill.name);
                    const itemCount = activeBill.items.reduce((sum, item) => sum + item.qty, 0);
                    setActiveBillItemCount(itemCount);
                }
            }
        } catch (error) {
            console.error('Error loading bill info:', error);
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

    const onRefresh = async () => {
        setRefreshing(true);
        await loadProducts();
        await loadBillInfo();
        setRefreshing(false);
    };

    // Filter products based on search and category
    useEffect(() => {
        let filtered = products;

        if (selectedCategory !== 'All') {
            filtered = filtered.filter(p => (p.category || 'Uncategorized') === selectedCategory);
        }

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(p =>
                p.name.toLowerCase().includes(query) ||
                (p.barcode && p.barcode.toLowerCase().includes(query)) ||
                (p.sku && p.sku.toLowerCase().includes(query))
            );
        }

        setFilteredProducts(filtered);
    }, [searchQuery, selectedCategory, products]);

    // Add product to active bill
    const addProductToBill = async (product) => {
        if (product.trackStock && product.stockQuantity <= 0) {
            showToast(`${product.name} is out of stock`, 'error');
            return;
        }

        try {
            const saved = await AsyncStorage.getItem('retailBills');
            const savedActiveId = await AsyncStorage.getItem('retailActiveBillId');
            let bills = saved ? JSON.parse(saved) : [];
            if (bills.length === 0) {
                showToast('Start a bill first from the Home tab', 'error');
                return;
            }

            // Add to active bill (by saved ID, fall back to first)
            const activeBill = (savedActiveId && bills.find(b => b.id === savedActiveId)) || bills[0];
            const existingIndex = activeBill.items.findIndex(item => item._id === product._id);

            if (existingIndex >= 0) {
                const currentQty = activeBill.items[existingIndex].qty;
                if (product.trackStock && currentQty >= product.stockQuantity) {
                    showToast(`Only ${product.stockQuantity} in stock`, 'error');
                    return;
                }
                activeBill.items[existingIndex].qty = currentQty + 1;
            } else {
                activeBill.items.push({
                    _id: product._id,
                    name: product.name,
                    price: product.sellingPrice || product.price,
                    gst: product.gst || 0,
                    qty: 1,
                    barcode: product.barcode,
                    trackStock: product.trackStock,
                    stockQuantity: product.stockQuantity
                });
            }

            await AsyncStorage.setItem('retailBills', JSON.stringify(bills));

            // Update local state
            const newItemCount = activeBill.items.reduce((sum, item) => sum + item.qty, 0);
            setActiveBillItemCount(newItemCount);

            showToast(`${product.name} added to ${activeBill.name}`, 'success');
        } catch (error) {
            console.error('Error adding to bill:', error);
            showToast('Failed to add item', 'error');
        }
    };

    // Product Card
    const ProductCard = ({ product }) => {
        const isOutOfStock = product.trackStock && product.stockQuantity <= 0;
        const isLowStock = product.trackStock && product.stockQuantity > 0 && product.stockQuantity <= 5;

        return (
            <TouchableOpacity
                style={[styles.productCard, isOutOfStock && styles.productCardOutOfStock]}
                onPress={() => addProductToBill(product)}
                disabled={isOutOfStock}
                activeOpacity={0.7}
            >
                {/* Product Icon */}
                <View style={[styles.productIcon, isOutOfStock && styles.productIconOutOfStock]}>
                    <MaterialCommunityIcons
                        name="package-variant"
                        size={32}
                        color={isOutOfStock ? '#94a3b8' : '#8b5cf6'}
                    />
                </View>

                {/* Stock Badge */}
                {isOutOfStock && (
                    <View style={styles.outOfStockBadge}>
                        <Text style={styles.outOfStockText}>OUT OF STOCK</Text>
                    </View>
                )}
                {isLowStock && (
                    <View style={styles.lowStockBadge}>
                        <Text style={styles.lowStockText}>{product.stockQuantity} left</Text>
                    </View>
                )}

                {/* Product Info */}
                <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
                <Text style={styles.productBarcode} numberOfLines={1}>
                    {product.barcode || product.sku || '-'}
                </Text>

                {/* Price */}
                <View style={styles.productPriceRow}>
                    <Text style={styles.productPrice}>
                        Rs. {(product.sellingPrice || product.price || 0).toLocaleString()}
                    </Text>
                    {!isOutOfStock && (
                        <View style={styles.addBtnSmall}>
                            <MaterialIcons name="add" size={18} color="#fff" />
                        </View>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    // Category Chip
    const CategoryChip = ({ category, isSelected }) => (
        <TouchableOpacity
            style={[styles.categoryChip, isSelected && styles.categoryChipSelected]}
            onPress={() => setSelectedCategory(category)}
        >
            <Text style={[styles.categoryChipText, isSelected && styles.categoryChipTextSelected]}>
                {category}
            </Text>
        </TouchableOpacity>
    );

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <StatusBar barStyle="dark-content" backgroundColor="#fff" />

            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Products</Text>
                <TouchableOpacity
                    style={styles.billBadge}
                    onPress={() => navigation.navigate('Home')}
                >
                    <MaterialIcons name="receipt" size={18} color="#8b5cf6" />
                    <Text style={styles.billBadgeText}>{activeBillName}</Text>
                    {activeBillItemCount > 0 && (
                        <View style={styles.billBadgeCount}>
                            <Text style={styles.billBadgeCountText}>{activeBillItemCount}</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <View style={styles.searchBar}>
                    <MaterialIcons name="search" size={22} color="#94a3b8" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search products..."
                        placeholderTextColor="#94a3b8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <MaterialIcons name="close" size={20} color="#94a3b8" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Category Filter */}
            <View style={styles.categoriesContainer}>
                <FlatList
                    horizontal
                    data={categories}
                    keyExtractor={(item) => item}
                    renderItem={({ item }) => (
                        <CategoryChip category={item} isSelected={selectedCategory === item} />
                    )}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.categoriesList}
                />
            </View>

            {/* Products Grid */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#8b5cf6" />
                    <Text style={styles.loadingText}>Loading products...</Text>
                </View>
            ) : filteredProducts.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <MaterialCommunityIcons name="package-variant-closed" size={64} color="#e2e8f0" />
                    <Text style={styles.emptyText}>No products found</Text>
                    <Text style={styles.emptySubtext}>
                        {searchQuery ? 'Try a different search' : 'Add products from admin panel'}
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={filteredProducts}
                    keyExtractor={(item) => item._id}
                    renderItem={({ item }) => <ProductCard product={item} />}
                    numColumns={2}
                    columnWrapperStyle={styles.productRow}
                    contentContainerStyle={styles.productsGrid}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={['#8b5cf6']}
                            tintColor="#8b5cf6"
                        />
                    }
                />
            )}

            {/* Go to Bill Button */}
            {activeBillItemCount > 0 && (
                <View style={[styles.floatingButton, { bottom: insets.bottom + 16 }]}>
                    <TouchableOpacity
                        style={styles.goToBillBtn}
                        onPress={() => navigation.navigate('Home')}
                    >
                        <MaterialIcons name="receipt-long" size={22} color="#fff" />
                        <Text style={styles.goToBillText}>
                            View {activeBillName} ({activeBillItemCount} items)
                        </Text>
                        <MaterialIcons name="arrow-forward" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
};

export default ProductsScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#1e293b',
    },
    billBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f5f3ff',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 6,
    },
    billBadgeText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#8b5cf6',
    },
    billBadgeCount: {
        backgroundColor: '#8b5cf6',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 5,
    },
    billBadgeCountText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#fff',
    },
    searchContainer: {
        backgroundColor: '#fff',
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        paddingHorizontal: 14,
        height: 46,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        marginLeft: 10,
        color: '#1e293b',
    },
    categoriesContainer: {
        backgroundColor: '#fff',
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    categoriesList: {
        paddingHorizontal: 16,
        gap: 8,
    },
    categoryChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#f1f5f9',
        marginRight: 8,
    },
    categoryChipSelected: {
        backgroundColor: '#8b5cf6',
    },
    categoryChipText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748b',
    },
    categoryChipTextSelected: {
        color: '#fff',
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#64748b',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#94a3b8',
        marginTop: 16,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#cbd5e1',
        marginTop: 4,
        textAlign: 'center',
    },
    productsGrid: {
        padding: 16,
        paddingBottom: 100,
    },
    productRow: {
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    productCard: {
        width: CARD_WIDTH,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    productCardOutOfStock: {
        opacity: 0.7,
    },
    productIcon: {
        width: 56,
        height: 56,
        borderRadius: 14,
        backgroundColor: '#f5f3ff',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    productIconOutOfStock: {
        backgroundColor: '#f1f5f9',
    },
    outOfStockBadge: {
        position: 'absolute',
        top: 10,
        right: 10,
        backgroundColor: '#fee2e2',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 4,
    },
    outOfStockText: {
        fontSize: 8,
        fontWeight: '700',
        color: '#ef4444',
    },
    lowStockBadge: {
        position: 'absolute',
        top: 10,
        right: 10,
        backgroundColor: '#fef3c7',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 4,
    },
    lowStockText: {
        fontSize: 9,
        fontWeight: '600',
        color: '#f59e0b',
    },
    productName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1e293b',
        marginBottom: 4,
        minHeight: 36,
    },
    productBarcode: {
        fontSize: 11,
        color: '#94a3b8',
        marginBottom: 8,
    },
    productPriceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    productPrice: {
        fontSize: 15,
        fontWeight: '700',
        color: '#10b981',
    },
    addBtnSmall: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#8b5cf6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    floatingButton: {
        position: 'absolute',
        left: 16,
        right: 16,
    },
    goToBillBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#8b5cf6',
        paddingVertical: 16,
        borderRadius: 14,
        gap: 10,
        shadowColor: '#8b5cf6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    goToBillText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
});
