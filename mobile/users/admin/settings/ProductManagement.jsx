import React, { useState, useEffect, useCallback } from 'react';
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Modal,
    Alert,
    ActivityIndicator,
    FlatList,
    RefreshControl,
    Platform,
    KeyboardAvoidingView,
    Keyboard,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useToast } from 'native-base';
import api from '../../../constants/api';

const ProductManagement = ({ navigation }) => {
    const toast = useToast();
    const [permission, requestPermission] = useCameraPermissions();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [showLowStock, setShowLowStock] = useState(false);

    // Modal states
    const [showAddModal, setShowAddModal] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    const [scanned, setScanned] = useState(false);
    const [torchOn, setTorchOn] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        barcode: '',
        sku: '',
        category: '',
        costPrice: '',
        sellingPrice: '',
        gst: '',
        stockQuantity: '',
        lowStockAlert: '10',
        unit: 'piece',
        trackStock: true,
        description: '',
    });

    const units = ['piece', 'kg', 'gram', 'liter', 'ml', 'box', 'pack', 'dozen'];

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const loadData = async () => {
        try {
            const [productsRes, categoriesRes] = await Promise.allSettled([
                api.get('/product'),
                api.get('/product/categories')
            ]);
            if (productsRes.status === 'fulfilled') {
                setProducts(productsRes.value.data || []);
            } else {
                showToast('Failed to load products', 'error');
            }
            if (categoriesRes.status === 'fulfilled') {
                setCategories(['All', ...(categoriesRes.value.data || [])]);
            }
        } catch (error) {
            console.error('Error loading products:', error);
            showToast('Failed to load products', 'error');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const showToast = (message, type = 'success') => {
        toast.closeAll();
        toast.show({
            render: () => (
                <View style={{
                    backgroundColor: type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#f97316',
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderRadius: 8,
                    marginHorizontal: 16,
                }}>
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '500' }}>{message}</Text>
                </View>
            ),
            placement: 'top',
            duration: 3000,
        });
    };

    // Filter products
    const filteredProducts = products.filter(p => {
        const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
        const matchesSearch = !searchQuery ||
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.barcode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.sku?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesLowStock = !showLowStock || (p.trackStock && p.stockQuantity <= p.lowStockAlert);
        return matchesCategory && matchesSearch && matchesLowStock && p.isActive;
    });

    // Open add/edit modal
    const openAddModal = (product = null) => {
        if (product) {
            setEditingProduct(product);
            setFormData({
                name: product.name,
                barcode: product.barcode || '',
                sku: product.sku || '',
                category: product.category || '',
                costPrice: product.costPrice?.toString() || '',
                sellingPrice: product.sellingPrice?.toString() || '',
                gst: product.gst?.toString() || '',
                stockQuantity: product.stockQuantity?.toString() || '',
                lowStockAlert: product.lowStockAlert?.toString() || '10',
                unit: product.unit || 'piece',
                trackStock: product.trackStock !== false,
                description: product.description || '',
            });
        } else {
            setEditingProduct(null);
            setFormData({
                name: '',
                barcode: '',
                sku: '',
                category: '',
                costPrice: '',
                sellingPrice: '',
                gst: '',
                stockQuantity: '',
                lowStockAlert: '10',
                unit: 'piece',
                trackStock: true,
                description: '',
            });
        }
        setShowAddModal(true);
    };

    // Generate barcode
    const generateBarcode = async () => {
        try {
            const res = await api.get('/product/generate-barcode');
            setFormData({ ...formData, barcode: res.data.barcode });
            showToast('Barcode generated');
        } catch (error) {
            showToast('Failed to generate barcode', 'error');
        }
    };

    // Scan barcode — if product exists, load it for editing; otherwise just fill barcode
    const handleBarCodeScanned = async ({ data }) => {
        setScanned(true);
        setShowScanner(false);
        setTorchOn(false);

        try {
            const response = await api.get(`/product/barcode/${data}`);
            const product = response.data;

            if (product) {
                // Product exists — fill form in edit mode
                setEditingProduct(product);
                setFormData({
                    name: product.name,
                    barcode: product.barcode || data,
                    sku: product.sku || '',
                    category: product.category || '',
                    costPrice: product.costPrice?.toString() || '',
                    sellingPrice: product.sellingPrice?.toString() || '',
                    gst: product.gst?.toString() || '',
                    stockQuantity: product.stockQuantity?.toString() || '',
                    lowStockAlert: product.lowStockAlert?.toString() || '10',
                    unit: product.unit || 'piece',
                    trackStock: product.trackStock !== false,
                    description: product.description || '',
                });
                showToast(`Product found: ${product.name}`, 'success');
            }
        } catch (error) {
            // Product not found — just fill barcode for new product
            setFormData(prev => ({ ...prev, barcode: data }));
            showToast('New barcode scanned');
        }

        setTimeout(() => setScanned(false), 1500);
    };

    // Save product
    const handleSave = async () => {
        if (!formData.name.trim()) {
            Alert.alert('Error', 'Product name is required');
            return;
        }
        if (!formData.sellingPrice || parseFloat(formData.sellingPrice) <= 0) {
            Alert.alert('Error', 'Valid selling price is required');
            return;
        }

        Keyboard.dismiss();

        try {
            const data = {
                name: formData.name.trim(),
                barcode: formData.barcode.trim() || undefined,
                sku: formData.sku.trim() || undefined,
                category: formData.category.trim() || 'General',
                costPrice: parseFloat(formData.costPrice) || 0,
                sellingPrice: parseFloat(formData.sellingPrice),
                gst: parseFloat(formData.gst) || 0,
                stockQuantity: parseInt(formData.stockQuantity) || 0,
                lowStockAlert: parseInt(formData.lowStockAlert) || 10,
                unit: formData.unit,
                trackStock: formData.trackStock,
                description: formData.description.trim(),
            };

            if (editingProduct) {
                await api.patch(`/product/${editingProduct._id}`, data);
                showToast('Product updated');
            } else {
                await api.post('/product', data);
                showToast('Product added');
            }

            setShowAddModal(false);
            loadData();
        } catch (error) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to save product');
        }
    };

    // Delete product
    const handleDelete = (product) => {
        Alert.alert(
            'Delete Product',
            `Are you sure you want to delete "${product.name}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.delete(`/product/${product._id}`);
                            showToast('Product deleted');
                            loadData();
                        } catch (error) {
                            showToast('Failed to delete product', 'error');
                        }
                    }
                }
            ]
        );
    };

    // Product card component
    const ProductCard = ({ product }) => {
        const isLowStock = product.trackStock && product.stockQuantity <= product.lowStockAlert;

        return (
            <TouchableOpacity
                style={[styles.productCard, isLowStock && styles.productCardLowStock]}
                onPress={() => openAddModal(product)}
            >
                <View style={styles.productHeader}>
                    <View style={styles.productIcon}>
                        <MaterialCommunityIcons name="package-variant" size={24} color="#8b5cf6" />
                    </View>
                    {isLowStock && (
                        <View style={styles.lowStockBadge}>
                            <Text style={styles.lowStockText}>Low Stock</Text>
                        </View>
                    )}
                </View>
                <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
                {product.barcode && (
                    <View style={styles.barcodeRow}>
                        <MaterialCommunityIcons name="barcode" size={14} color="#94a3b8" />
                        <Text style={styles.barcodeText}>{product.barcode}</Text>
                    </View>
                )}
                <View style={styles.productFooter}>
                    <Text style={styles.productPrice}>Rs. {product.sellingPrice}</Text>
                    {product.trackStock && (
                        <Text style={[styles.stockText, isLowStock && styles.stockTextLow]}>
                            Stock: {product.stockQuantity}
                        </Text>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#8b5cf6" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <LinearGradient
                colors={['#8b5cf6', '#7c3aed']}
                style={styles.header}
            >
                <View style={styles.headerContent}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Products</Text>
                    <TouchableOpacity onPress={() => openAddModal()}>
                        <Ionicons name="add-circle" size={28} color="#fff" />
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            {/* Search & Filters */}
            <View style={styles.searchSection}>
                <View style={styles.searchBox}>
                    <Ionicons name="search" size={20} color="#94a3b8" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by name, barcode, SKU..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery ? (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={20} color="#94a3b8" />
                        </TouchableOpacity>
                    ) : null}
                </View>
                <TouchableOpacity
                    style={[styles.lowStockBtn, showLowStock && styles.lowStockBtnActive]}
                    onPress={() => setShowLowStock(!showLowStock)}
                >
                    <Ionicons
                        name="warning"
                        size={18}
                        color={showLowStock ? '#fff' : '#f97316'}
                    />
                </TouchableOpacity>
            </View>

            {/* Categories */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoriesScroll}
                contentContainerStyle={styles.categoriesContent}
            >
                {categories.map(cat => (
                    <TouchableOpacity
                        key={cat}
                        style={[styles.categoryChip, selectedCategory === cat && styles.categoryChipActive]}
                        onPress={() => setSelectedCategory(cat)}
                    >
                        <Text style={[
                            styles.categoryText,
                            selectedCategory === cat && styles.categoryTextActive
                        ]}>{cat}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Products Grid */}
            <FlatList
                data={filteredProducts}
                keyExtractor={(item) => item._id}
                numColumns={2}
                renderItem={({ item }) => <ProductCard product={item} />}
                contentContainerStyle={styles.productsGrid}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={() => {
                        setRefreshing(true);
                        loadData();
                    }} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <MaterialCommunityIcons name="package-variant" size={64} color="#cbd5e1" />
                        <Text style={styles.emptyTitle}>No products found</Text>
                        <Text style={styles.emptySubtitle}>
                            {showLowStock ? 'No low stock items' : 'Add your first product'}
                        </Text>
                    </View>
                }
            />

            {/* Add/Edit Modal */}
            <Modal visible={showAddModal} animationType="slide" transparent>
                <KeyboardAvoidingView
                    style={styles.modalOverlay}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {editingProduct ? 'Edit Product' : 'Add Product'}
                            </Text>
                            <TouchableOpacity onPress={() => setShowAddModal(false)}>
                                <Ionicons name="close" size={24} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                            {/* Name */}
                            <Text style={styles.inputLabel}>Product Name *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter product name"
                                value={formData.name}
                                onChangeText={(text) => setFormData({ ...formData, name: text })}
                            />

                            {/* Barcode */}
                            <Text style={styles.inputLabel}>Barcode</Text>
                            <View style={styles.barcodeInputRow}>
                                <TextInput
                                    style={[styles.input, styles.barcodeInput]}
                                    placeholder="Enter or scan barcode"
                                    value={formData.barcode}
                                    onChangeText={(text) => setFormData({ ...formData, barcode: text })}
                                />
                                <TouchableOpacity
                                    style={styles.scanBarcodeBtn}
                                    onPress={async () => {
                                        if (permission?.granted) {
                                            setShowScanner(true);
                                        } else {
                                            const result = await requestPermission();
                                            if (result.granted) setShowScanner(true);
                                        }
                                    }}
                                >
                                    <MaterialCommunityIcons name="barcode-scan" size={22} color="#fff" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.generateBtn}
                                    onPress={generateBarcode}
                                >
                                    <Ionicons name="refresh" size={20} color="#8b5cf6" />
                                </TouchableOpacity>
                            </View>

                            {/* SKU & Category */}
                            <View style={styles.rowInputs}>
                                <View style={styles.halfInput}>
                                    <Text style={styles.inputLabel}>SKU</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="SKU"
                                        value={formData.sku}
                                        onChangeText={(text) => setFormData({ ...formData, sku: text })}
                                    />
                                </View>
                                <View style={styles.halfInput}>
                                    <Text style={styles.inputLabel}>Category</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Category"
                                        value={formData.category}
                                        onChangeText={(text) => setFormData({ ...formData, category: text })}
                                    />
                                </View>
                            </View>

                            {/* Pricing */}
                            <View style={styles.rowInputs}>
                                <View style={styles.halfInput}>
                                    <Text style={styles.inputLabel}>Cost Price</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="0"
                                        keyboardType="numeric"
                                        value={formData.costPrice}
                                        onChangeText={(text) => setFormData({ ...formData, costPrice: text })}
                                    />
                                </View>
                                <View style={styles.halfInput}>
                                    <Text style={styles.inputLabel}>Selling Price *</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="0"
                                        keyboardType="numeric"
                                        value={formData.sellingPrice}
                                        onChangeText={(text) => setFormData({ ...formData, sellingPrice: text })}
                                    />
                                </View>
                            </View>

                            {/* GST */}
                            <Text style={styles.inputLabel}>GST Amount</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="0"
                                keyboardType="numeric"
                                value={formData.gst}
                                onChangeText={(text) => setFormData({ ...formData, gst: text })}
                            />

                            {/* Stock */}
                            <View style={styles.stockSection}>
                                <View style={styles.trackStockRow}>
                                    <Text style={styles.inputLabel}>Track Stock</Text>
                                    <TouchableOpacity
                                        style={[styles.toggleBtn, formData.trackStock && styles.toggleBtnActive]}
                                        onPress={() => setFormData({ ...formData, trackStock: !formData.trackStock })}
                                    >
                                        <View style={[styles.toggleKnob, formData.trackStock && styles.toggleKnobActive]} />
                                    </TouchableOpacity>
                                </View>

                                {formData.trackStock && (
                                    <View style={styles.rowInputs}>
                                        <View style={styles.halfInput}>
                                            <Text style={styles.inputLabel}>Stock Qty</Text>
                                            <TextInput
                                                style={styles.input}
                                                placeholder="0"
                                                keyboardType="numeric"
                                                value={formData.stockQuantity}
                                                onChangeText={(text) => setFormData({ ...formData, stockQuantity: text })}
                                            />
                                        </View>
                                        <View style={styles.halfInput}>
                                            <Text style={styles.inputLabel}>Low Stock Alert</Text>
                                            <TextInput
                                                style={styles.input}
                                                placeholder="10"
                                                keyboardType="numeric"
                                                value={formData.lowStockAlert}
                                                onChangeText={(text) => setFormData({ ...formData, lowStockAlert: text })}
                                            />
                                        </View>
                                    </View>
                                )}
                            </View>

                            {/* Unit */}
                            <Text style={styles.inputLabel}>Unit</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                <View style={styles.unitRow}>
                                    {units.map(unit => (
                                        <TouchableOpacity
                                            key={unit}
                                            style={[styles.unitChip, formData.unit === unit && styles.unitChipActive]}
                                            onPress={() => setFormData({ ...formData, unit })}
                                        >
                                            <Text style={[
                                                styles.unitText,
                                                formData.unit === unit && styles.unitTextActive
                                            ]}>{unit}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </ScrollView>

                            {/* Description */}
                            <Text style={styles.inputLabel}>Description</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                placeholder="Product description (optional)"
                                multiline
                                numberOfLines={3}
                                value={formData.description}
                                onChangeText={(text) => setFormData({ ...formData, description: text })}
                            />

                            <View style={{ height: 20 }} />
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            {editingProduct && (
                                <TouchableOpacity
                                    style={styles.deleteBtn}
                                    onPress={() => {
                                        setShowAddModal(false);
                                        handleDelete(editingProduct);
                                    }}
                                >
                                    <Ionicons name="trash" size={20} color="#ef4444" />
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                style={styles.cancelBtn}
                                onPress={() => setShowAddModal(false)}
                            >
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                                <Text style={styles.saveBtnText}>
                                    {editingProduct ? 'Update' : 'Add Product'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                        {/* Inline Barcode Scanner (replaces stacked modal) */}
                        {showScanner && (
                            <View style={styles.inlineScannerOverlay}>
                                <CameraView
                                    style={StyleSheet.absoluteFillObject}
                                    facing="back"
                                    enableTorch={torchOn}
                                    barcodeScannerSettings={{
                                        barcodeTypes: ['qr', 'ean13', 'ean8', 'upc_a', 'upc_e', 'code39', 'code128'],
                                    }}
                                    onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                                />
                                <View style={styles.scannerOverlay}>
                                    <View style={styles.scannerFrame} />
                                </View>
                                <View style={styles.scannerHeader}>
                                    <TouchableOpacity
                                        style={styles.closeScannerBtn}
                                        onPress={() => { setShowScanner(false); setTorchOn(false); }}
                                    >
                                        <Ionicons name="close" size={28} color="#fff" />
                                    </TouchableOpacity>
                                    <Text style={styles.scannerTitle}>Scan Barcode</Text>
                                    <TouchableOpacity
                                        style={styles.flashToggleBtn}
                                        onPress={() => setTorchOn(!torchOn)}
                                    >
                                        <Ionicons name={torchOn ? "flash" : "flash-off"} size={24} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                                <Text style={styles.scannerHint}>Position barcode within the frame</Text>
                            </View>
                        )}
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
};

export default ProductManagement;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        paddingTop: 50,
        paddingBottom: 16,
        paddingHorizontal: 16,
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#fff',
    },
    searchSection: {
        flexDirection: 'row',
        padding: 16,
        gap: 10,
    },
    searchBox: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 48,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 15,
    },
    lowStockBtn: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#f97316',
        alignItems: 'center',
        justifyContent: 'center',
    },
    lowStockBtnActive: {
        backgroundColor: '#f97316',
        borderColor: '#f97316',
    },
    categoriesScroll: {
        maxHeight: 44,
    },
    categoriesContent: {
        paddingHorizontal: 16,
        gap: 8,
    },
    categoryChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    categoryChipActive: {
        backgroundColor: '#8b5cf6',
        borderColor: '#8b5cf6',
    },
    categoryText: {
        fontSize: 14,
        color: '#64748b',
    },
    categoryTextActive: {
        color: '#fff',
        fontWeight: '500',
    },
    productsGrid: {
        padding: 12,
    },
    productCard: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 12,
        margin: 4,
        maxWidth: '48%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    productCardLowStock: {
        borderWidth: 1,
        borderColor: '#fbbf24',
    },
    productHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    productIcon: {
        width: 44,
        height: 44,
        borderRadius: 10,
        backgroundColor: '#f5f3ff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    lowStockBadge: {
        backgroundColor: '#fef3c7',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    lowStockText: {
        fontSize: 10,
        color: '#d97706',
        fontWeight: '500',
    },
    productName: {
        fontSize: 14,
        fontWeight: '500',
        color: '#1e293b',
        marginBottom: 4,
    },
    barcodeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 8,
    },
    barcodeText: {
        fontSize: 11,
        color: '#94a3b8',
    },
    productFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    productPrice: {
        fontSize: 16,
        fontWeight: '600',
        color: '#8b5cf6',
    },
    stockText: {
        fontSize: 12,
        color: '#64748b',
    },
    stockTextLow: {
        color: '#f97316',
        fontWeight: '500',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#64748b',
        marginTop: 16,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#94a3b8',
        marginTop: 4,
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '90%',
        position: 'relative',
        overflow: 'hidden',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1e293b',
    },
    modalBody: {
        padding: 16,
    },
    modalFooter: {
        flexDirection: 'row',
        gap: 12,
        padding: 16,
        paddingBottom: 32,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#64748b',
        marginBottom: 6,
        marginTop: 12,
    },
    input: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 10,
        padding: 12,
        fontSize: 16,
        backgroundColor: '#fff',
    },
    textArea: {
        height: 80,
        textAlignVertical: 'top',
    },
    barcodeInputRow: {
        flexDirection: 'row',
        gap: 8,
    },
    barcodeInput: {
        flex: 1,
    },
    scanBarcodeBtn: {
        width: 48,
        height: 48,
        borderRadius: 10,
        backgroundColor: '#8b5cf6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    generateBtn: {
        width: 48,
        height: 48,
        borderRadius: 10,
        backgroundColor: '#f5f3ff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    rowInputs: {
        flexDirection: 'row',
        gap: 12,
    },
    halfInput: {
        flex: 1,
    },
    stockSection: {
        marginTop: 8,
    },
    trackStockRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    toggleBtn: {
        width: 50,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#e2e8f0',
        padding: 2,
    },
    toggleBtnActive: {
        backgroundColor: '#8b5cf6',
    },
    toggleKnob: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#fff',
    },
    toggleKnobActive: {
        transform: [{ translateX: 22 }],
    },
    unitRow: {
        flexDirection: 'row',
        gap: 8,
        paddingVertical: 4,
    },
    unitChip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
    },
    unitChipActive: {
        backgroundColor: '#8b5cf6',
    },
    unitText: {
        fontSize: 13,
        color: '#64748b',
    },
    unitTextActive: {
        color: '#fff',
        fontWeight: '500',
    },
    deleteBtn: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#fef2f2',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
    },
    cancelBtnText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#64748b',
    },
    saveBtn: {
        flex: 2,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        backgroundColor: '#8b5cf6',
    },
    saveBtnText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    // Scanner styles
    inlineScannerOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#000',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
        zIndex: 100,
    },
    scannerContainer: {
        flex: 1,
        backgroundColor: '#000',
    },
    scannerOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scannerFrame: {
        width: 280,
        height: 150,
        borderWidth: 2,
        borderColor: '#fff',
        borderRadius: 12,
    },
    scannerHeader: {
        position: 'absolute',
        top: 60,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    closeScannerBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    flashToggleBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    scannerTitle: {
        flex: 1,
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        textAlign: 'center',
    },
    scannerHint: {
        position: 'absolute',
        bottom: 100,
        alignSelf: 'center',
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
    },
});
