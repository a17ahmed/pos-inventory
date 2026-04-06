import Supply from '../models/supply.mjs';
import Vendor from '../models/vendor.mjs';
import Product from '../models/product.mjs';
import Counter from '../models/counter.mjs';
import mongoose from 'mongoose';
import { cloudinary } from '../middleware/upload.mjs';

// Create supply
const createSupply = async (req, res) => {
    try {
        let { vendor, vendorName, billNumber, billDate, items, totalAmount, paidAmount, notes } = req.body;

        // Parse items if sent as string (multipart/form-data)
        if (typeof items === 'string') {
            items = JSON.parse(items);
        }

        if (!vendor) {
            return res.status(400).json({ message: 'Vendor is required' });
        }

        if (!items || items.length === 0) {
            return res.status(400).json({ message: 'At least one item is required' });
        }

        // Validate vendor belongs to this business
        const vendorDoc = await Vendor.findOne({
            _id: vendor,
            business: req.user.businessId,
            isActive: true
        });

        if (!vendorDoc) {
            return res.status(404).json({ message: 'Vendor not found' });
        }

        // Validate all product IDs belong to this business
        const productIds = items.map(item => item.product).filter(Boolean);
        if (productIds.length !== items.length) {
            return res.status(400).json({ message: 'Each item must have a product ID' });
        }

        const products = await Product.find({
            _id: { $in: productIds },
            business: req.user.businessId
        });

        if (products.length !== productIds.length) {
            return res.status(400).json({ message: 'One or more products not found in this business' });
        }

        const productMap = new Map(products.map(p => [p._id.toString(), p]));

        // Calculate item totals and overall total
        const processedItems = items.map(item => {
            const product = productMap.get(item.product.toString());
            return {
                product: product._id,
                name: product.name,
                quantity: Number(item.quantity),
                unitPrice: Number(item.unitPrice),
                total: Number(item.quantity) * Number(item.unitPrice)
            };
        });

        const calculatedTotal = processedItems.reduce((sum, item) => sum + item.total, 0);

        const supplyNumber = await Counter.getNextSequence('supplyNumber', req.user.businessId);

        const supply = new Supply({
            supplyNumber,
            vendor: vendorDoc._id,
            vendorName: vendorDoc.name,
            billNumber: billNumber || '',
            billDate: billDate || new Date(),
            items: processedItems,
            totalAmount: calculatedTotal,
            paidAmount: Number(paidAmount) || 0,
            notes: notes || '',
            receiptImage: req.file ? req.file.path : null,
            createdBy: req.user.adminId ? 'Admin' : req.user.employeeName || '',
            business: req.user.businessId
        });

        await supply.save();
        res.status(201).json(supply);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get all supplies
const getAllSupplies = async (req, res) => {
    try {
        const { vendor, paymentStatus, startDate, endDate, page = 1, limit = 50 } = req.query;
        const filter = { business: req.user.businessId };

        if (vendor) filter.vendor = vendor;
        if (paymentStatus) filter.paymentStatus = paymentStatus;
        if (startDate || endDate) {
            filter.billDate = {};
            if (startDate) filter.billDate.$gte = new Date(startDate);
            if (endDate) filter.billDate.$lte = new Date(endDate);
        }

        const skip = (Number(page) - 1) * Number(limit);
        const total = await Supply.countDocuments(filter);

        const supplies = await Supply.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .populate('vendor', 'name phone company');

        res.json({
            supplies,
            total,
            page: Number(page),
            totalPages: Math.ceil(total / Number(limit))
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get single supply
const getSupply = async (req, res) => {
    try {
        const supply = await Supply.findOne({
            _id: req.params.id,
            business: req.user.businessId
        }).populate('vendor', 'name phone company');

        if (!supply) {
            return res.status(404).json({ message: 'Supply not found' });
        }

        res.json(supply);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Update supply
const updateSupply = async (req, res) => {
    try {
        const supply = await Supply.findOne({
            _id: req.params.id,
            business: req.user.businessId
        });

        if (!supply) {
            return res.status(404).json({ message: 'Supply not found' });
        }

        let { billNumber, billDate, items, paidAmount, notes } = req.body;

        if (typeof items === 'string') {
            items = JSON.parse(items);
        }

        if (billNumber !== undefined) supply.billNumber = billNumber;
        if (billDate !== undefined) supply.billDate = billDate;
        if (notes !== undefined) supply.notes = notes;
        if (paidAmount !== undefined) supply.paidAmount = Number(paidAmount);

        if (items && items.length > 0) {
            const productIds = items.map(item => item.product).filter(Boolean);
            if (productIds.length !== items.length) {
                return res.status(400).json({ message: 'Each item must have a product ID' });
            }

            const products = await Product.find({
                _id: { $in: productIds },
                business: req.user.businessId
            });

            if (products.length !== productIds.length) {
                return res.status(400).json({ message: 'One or more products not found in this business' });
            }

            const productMap = new Map(products.map(p => [p._id.toString(), p]));

            supply.items = items.map(item => {
                const product = productMap.get(item.product.toString());
                return {
                    product: product._id,
                    name: product.name,
                    quantity: Number(item.quantity),
                    unitPrice: Number(item.unitPrice),
                    total: Number(item.quantity) * Number(item.unitPrice)
                };
            });
            supply.totalAmount = supply.items.reduce((sum, item) => sum + item.total, 0);
        }

        // Handle new receipt image
        if (req.file) {
            // Delete old image from Cloudinary if exists
            if (supply.receiptImage) {
                const publicId = supply.receiptImage.split('/').slice(-2).join('/').split('.')[0];
                await cloudinary.uploader.destroy(publicId).catch(() => {});
            }
            supply.receiptImage = req.file.path;
        }

        await supply.save(); // pre-save hook recalculates remaining + status
        res.json(supply);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Record payment on a supply
const recordPayment = async (req, res) => {
    try {
        const { amount } = req.body;

        if (!amount || Number(amount) <= 0) {
            return res.status(400).json({ message: 'Valid payment amount is required' });
        }

        const supply = await Supply.findOne({
            _id: req.params.id,
            business: req.user.businessId
        });

        if (!supply) {
            return res.status(404).json({ message: 'Supply not found' });
        }

        if (supply.paymentStatus === 'paid') {
            return res.status(400).json({ message: 'This supply is already fully paid' });
        }

        if (Number(amount) > supply.remainingAmount) {
            return res.status(400).json({
                message: `Payment amount cannot exceed remaining balance of Rs ${supply.remainingAmount}`
            });
        }

        supply.paidAmount += Number(amount);
        await supply.save(); // pre-save hook recalculates remaining + status

        res.json(supply);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Delete supply
const deleteSupply = async (req, res) => {
    try {
        const supply = await Supply.findOne({
            _id: req.params.id,
            business: req.user.businessId
        });

        if (!supply) {
            return res.status(404).json({ message: 'Supply not found' });
        }

        // Delete receipt image from Cloudinary if exists
        if (supply.receiptImage) {
            const publicId = supply.receiptImage.split('/').slice(-2).join('/').split('.')[0];
            await cloudinary.uploader.destroy(publicId).catch(() => {});
        }

        await Supply.deleteOne({ _id: supply._id });
        res.json({ message: 'Supply deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get supply stats
const getSupplyStats = async (req, res) => {
    try {
        const businessId = new mongoose.Types.ObjectId(req.user.businessId);
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        const [overall, thisMonth, thisWeek, byVendor, byStatus] = await Promise.all([
            // Overall totals
            Supply.aggregate([
                { $match: { business: businessId } },
                {
                    $group: {
                        _id: null,
                        totalAmount: { $sum: '$totalAmount' },
                        totalPaid: { $sum: '$paidAmount' },
                        totalRemaining: { $sum: '$remainingAmount' },
                        count: { $sum: 1 }
                    }
                }
            ]),
            // This month
            Supply.aggregate([
                { $match: { business: businessId, billDate: { $gte: startOfMonth } } },
                {
                    $group: {
                        _id: null,
                        totalAmount: { $sum: '$totalAmount' },
                        totalPaid: { $sum: '$paidAmount' },
                        totalRemaining: { $sum: '$remainingAmount' },
                        count: { $sum: 1 }
                    }
                }
            ]),
            // This week
            Supply.aggregate([
                { $match: { business: businessId, billDate: { $gte: startOfWeek } } },
                {
                    $group: {
                        _id: null,
                        totalAmount: { $sum: '$totalAmount' },
                        count: { $sum: 1 }
                    }
                }
            ]),
            // By vendor (top 10)
            Supply.aggregate([
                { $match: { business: businessId } },
                {
                    $group: {
                        _id: '$vendor',
                        vendorName: { $first: '$vendorName' },
                        totalAmount: { $sum: '$totalAmount' },
                        totalPaid: { $sum: '$paidAmount' },
                        totalRemaining: { $sum: '$remainingAmount' },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { totalAmount: -1 } },
                { $limit: 10 }
            ]),
            // By payment status
            Supply.aggregate([
                { $match: { business: businessId } },
                {
                    $group: {
                        _id: '$paymentStatus',
                        count: { $sum: 1 },
                        totalAmount: { $sum: '$totalAmount' }
                    }
                }
            ])
        ]);

        res.json({
            overall: overall[0] || { totalAmount: 0, totalPaid: 0, totalRemaining: 0, count: 0 },
            thisMonth: thisMonth[0] || { totalAmount: 0, totalPaid: 0, totalRemaining: 0, count: 0 },
            thisWeek: thisWeek[0] || { totalAmount: 0, count: 0 },
            byVendor,
            byStatus
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export {
    createSupply,
    getAllSupplies,
    getSupply,
    updateSupply,
    recordPayment,
    deleteSupply,
    getSupplyStats
};
