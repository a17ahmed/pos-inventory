import Product from '../models/product.mjs';

// Create a new product
const createProduct = async (req, res) => {
    try {
        if (!req.user?.businessId) {
            return res.status(400).json({
                message: 'Business ID not found. Please log out and log in again.'
            });
        }

        const productData = new Product({
            ...req.body,
            business: req.user.businessId
        });

        const savedProduct = await productData.save();
        res.status(201).json(savedProduct);
    } catch (error) {
        console.error('Error creating product:', error);

        if (error.code === 11000) {
            const field = error.keyPattern?.barcode ? 'barcode' : 'SKU';
            return res.status(400).json({
                message: `A product with this ${field} already exists`
            });
        }

        res.status(500).json({
            message: error.message || 'Error creating product'
        });
    }
};

// Get all products for the business
const getAllProducts = async (req, res) => {
    try {
        const { category, search, lowStock, active } = req.query;

        const query = {
            business: req.user.businessId
        };

        // Filter by active status
        if (active !== undefined) {
            query.isActive = active === 'true';
        }

        // Filter by category
        if (category && category !== 'All') {
            query.category = category;
        }

        // Filter low stock items
        if (lowStock === 'true') {
            query.$expr = { $lte: ['$stockQuantity', '$lowStockAlert'] };
            query.trackStock = true;
        }

        let products = await Product.find(query).sort({ name: 1 });

        // Search filter (name, barcode, sku)
        if (search) {
            const searchLower = search.toLowerCase();
            products = products.filter(p =>
                p.name.toLowerCase().includes(searchLower) ||
                p.barcode?.toLowerCase().includes(searchLower) ||
                p.sku?.toLowerCase().includes(searchLower)
            );
        }

        res.json(products);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get product by barcode
const getProductByBarcode = async (req, res) => {
    try {
        const { barcode } = req.params;

        const product = await Product.findOne({
            barcode: barcode,
            business: req.user.businessId,
            isActive: true
        });

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.json(product);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get single product by ID
const getProduct = async (req, res) => {
    try {
        const product = await Product.findOne({
            _id: req.params.id,
            business: req.user.businessId
        });

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.json(product);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Update product
const updateProduct = async (req, res) => {
    try {
        // Only allow updating these fields
        const allowedFields = [
            'name', 'description', 'barcode', 'sku',
            'costPrice', 'sellingPrice', 'gst', 'category',
            'stockQuantity', 'lowStockAlert', 'unit', 'trackStock'
        ];

        const updates = {};
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ message: 'No valid fields to update' });
        }

        const product = await Product.findOneAndUpdate(
            { _id: req.params.id, business: req.user.businessId },
            updates,
            { new: true, runValidators: true }
        );

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.json(product);
    } catch (error) {
        if (error.code === 11000) {
            const field = error.keyPattern?.barcode ? 'barcode' : 'SKU';
            return res.status(400).json({
                message: `A product with this ${field} already exists`
            });
        }
        res.status(500).json({ message: error.message });
    }
};

// Delete product (soft delete)
const deleteProduct = async (req, res) => {
    try {
        const product = await Product.findOneAndUpdate(
            { _id: req.params.id, business: req.user.businessId },
            { isActive: false },
            { new: true }
        );

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.json({ message: 'Product deleted successfully', product });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Update stock quantity
const updateStock = async (req, res) => {
    try {
        const { quantity, operation } = req.body; // operation: 'add', 'subtract', 'set'

        const product = await Product.findOne({
            _id: req.params.id,
            business: req.user.businessId
        });

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        let newQuantity = product.stockQuantity;

        switch (operation) {
            case 'add':
                newQuantity += quantity;
                break;
            case 'subtract':
                newQuantity -= quantity;
                if (newQuantity < 0) newQuantity = 0;
                break;
            case 'set':
                newQuantity = quantity;
                break;
            default:
                return res.status(400).json({ message: 'Invalid operation' });
        }

        product.stockQuantity = newQuantity;
        await product.save();

        res.json(product);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Bulk update stock (for sales)
const bulkUpdateStock = async (req, res) => {
    try {
        const { items } = req.body; // Array of { productId, quantity }

        const updates = items.map(item =>
            Product.findOneAndUpdate(
                { _id: item.productId, business: req.user.businessId, trackStock: true },
                { $inc: { stockQuantity: -item.quantity } },
                { new: true }
            )
        );

        await Promise.all(updates);

        res.json({ message: 'Stock updated successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get categories
const getCategories = async (req, res) => {
    try {
        const categories = await Product.distinct('category', {
            business: req.user.businessId,
            isActive: true
        });

        res.json(categories.filter(Boolean).sort());
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get low stock products
const getLowStockProducts = async (req, res) => {
    try {
        const products = await Product.find({
            business: req.user.businessId,
            isActive: true,
            trackStock: true,
            $expr: { $lte: ['$stockQuantity', '$lowStockAlert'] }
        }).sort({ stockQuantity: 1 });

        res.json(products);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Generate unique barcode
const generateBarcode = async (req, res) => {
    try {
        const timestamp = Date.now().toString().slice(-10);
        const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
        const barcode = `${timestamp}${random}`;

        // Check if barcode exists
        const exists = await Product.findOne({
            barcode,
            business: req.user.businessId
        });

        if (exists) {
            // Regenerate
            return generateBarcode(req, res);
        }

        res.json({ barcode });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export {
    createProduct,
    getAllProducts,
    getProduct,
    getProductByBarcode,
    updateProduct,
    deleteProduct,
    updateStock,
    bulkUpdateStock,
    getCategories,
    getLowStockProducts,
    generateBarcode
};
