import Vendor from '../models/vendor.mjs';
import Supply from '../models/supply.mjs';
import mongoose from 'mongoose';

// Create vendor
const createVendor = async (req, res) => {
    try {
        const { name, phone, company, notes } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ message: 'Vendor name is required' });
        }

        const vendor = new Vendor({
            name: name.trim(),
            phone: phone || '',
            company: company || '',
            notes: notes || '',
            business: req.user.businessId
        });

        await vendor.save();
        res.status(201).json(vendor);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'A vendor with this name already exists' });
        }
        res.status(500).json({ message: error.message });
    }
};

// Get all vendors with aggregated supply totals
const getAllVendors = async (req, res) => {
    try {
        const { search, active } = req.query;
        const filter = { business: req.user.businessId };

        if (active !== undefined) {
            filter.isActive = active === 'true';
        } else {
            filter.isActive = true;
        }

        if (search) {
            filter.name = { $regex: search, $options: 'i' };
        }

        const vendors = await Vendor.find(filter).sort({ name: 1 }).lean();

        // Aggregate supply totals per vendor
        const vendorIds = vendors.map(v => v._id);
        const supplyStats = await Supply.aggregate([
            {
                $match: {
                    business: new mongoose.Types.ObjectId(req.user.businessId),
                    vendor: { $in: vendorIds }
                }
            },
            {
                $group: {
                    _id: '$vendor',
                    totalBusiness: { $sum: '$totalAmount' },
                    totalPaid: { $sum: '$paidAmount' },
                    totalRemaining: { $sum: '$remainingAmount' },
                    supplyCount: { $sum: 1 }
                }
            }
        ]);

        const statsMap = {};
        for (const stat of supplyStats) {
            statsMap[stat._id.toString()] = stat;
        }

        const result = vendors.map(v => ({
            ...v,
            totalBusiness: statsMap[v._id.toString()]?.totalBusiness || 0,
            totalPaid: statsMap[v._id.toString()]?.totalPaid || 0,
            totalRemaining: statsMap[v._id.toString()]?.totalRemaining || 0,
            supplyCount: statsMap[v._id.toString()]?.supplyCount || 0
        }));

        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get single vendor with their supplies
const getVendor = async (req, res) => {
    try {
        const vendor = await Vendor.findOne({
            _id: req.params.id,
            business: req.user.businessId
        }).lean();

        if (!vendor) {
            return res.status(404).json({ message: 'Vendor not found' });
        }

        const supplies = await Supply.find({
            vendor: vendor._id,
            business: req.user.businessId
        }).sort({ createdAt: -1 });

        const totals = await Supply.aggregate([
            {
                $match: {
                    vendor: new mongoose.Types.ObjectId(vendor._id),
                    business: new mongoose.Types.ObjectId(req.user.businessId)
                }
            },
            {
                $group: {
                    _id: null,
                    totalBusiness: { $sum: '$totalAmount' },
                    totalPaid: { $sum: '$paidAmount' },
                    totalRemaining: { $sum: '$remainingAmount' },
                    supplyCount: { $sum: 1 }
                }
            }
        ]);

        res.json({
            ...vendor,
            supplies,
            totalBusiness: totals[0]?.totalBusiness || 0,
            totalPaid: totals[0]?.totalPaid || 0,
            totalRemaining: totals[0]?.totalRemaining || 0,
            supplyCount: totals[0]?.supplyCount || 0
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Update vendor
const updateVendor = async (req, res) => {
    try {
        const allowedFields = ['name', 'phone', 'company', 'notes', 'isActive'];
        const updates = {};
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ message: 'No valid fields to update' });
        }

        const vendor = await Vendor.findOneAndUpdate(
            { _id: req.params.id, business: req.user.businessId },
            updates,
            { new: true, runValidators: true }
        );

        if (!vendor) {
            return res.status(404).json({ message: 'Vendor not found' });
        }

        res.json(vendor);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'A vendor with this name already exists' });
        }
        res.status(500).json({ message: error.message });
    }
};

// Delete vendor (soft delete)
const deleteVendor = async (req, res) => {
    try {
        const vendor = await Vendor.findOne({
            _id: req.params.id,
            business: req.user.businessId
        });

        if (!vendor) {
            return res.status(404).json({ message: 'Vendor not found' });
        }

        // Check for outstanding balance
        const outstanding = await Supply.aggregate([
            {
                $match: {
                    vendor: new mongoose.Types.ObjectId(vendor._id),
                    business: new mongoose.Types.ObjectId(req.user.businessId),
                    paymentStatus: { $ne: 'paid' }
                }
            },
            {
                $group: {
                    _id: null,
                    totalRemaining: { $sum: '$remainingAmount' }
                }
            }
        ]);

        if (outstanding[0]?.totalRemaining > 0) {
            return res.status(400).json({
                message: `Cannot delete vendor with outstanding balance of Rs ${outstanding[0].totalRemaining}`
            });
        }

        vendor.isActive = false;
        await vendor.save();

        res.json({ message: 'Vendor deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export { createVendor, getAllVendors, getVendor, updateVendor, deleteVendor };
