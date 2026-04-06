import 'dotenv/config';

import Business from '../models/business.mjs';
import Admin from '../models/admin.mjs';
import BusinessType from '../models/businessType.mjs';

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const privateKey = fs.readFileSync(path.resolve(__dirname, '../private.key'), 'utf-8');

// Register new business with admin account
export const registerBusiness = async (req, res) => {
    try {
        const {
            // Business details
            businessName,
            businessTypeId,
            businessEmail,
            businessPhone,
            address,
            currency,
            taxRate,
            taxLabel,
            // Admin details
            adminName,
            adminEmail,
            adminPassword
        } = req.body;

        // Validate business type exists
        const businessType = await BusinessType.findById(businessTypeId);
        if (!businessType) {
            return res.status(400).json({ message: 'Invalid business type' });
        }

        // Check if business email already exists
        const existingBusiness = await Business.findOne({ email: businessEmail });
        if (existingBusiness) {
            return res.status(400).json({ message: 'Business with this email already exists' });
        }

        // Check if admin email already exists
        const existingAdmin = await Admin.findOne({ email: adminEmail });
        if (existingAdmin) {
            return res.status(400).json({ message: 'Admin with this email already exists' });
        }

        // Create business
        const business = new Business({
            name: businessName,
            businessType: businessTypeId,
            email: businessEmail,
            phone: businessPhone || '',
            address: address || {},
            currency: currency || 'PKR',
            taxRate: taxRate || 0,
            taxLabel: taxLabel || 'GST'
        });

        const savedBusiness = await business.save();

        // Create admin linked to business
        const saltRounds = 10;
        const hashedPassword = bcrypt.hashSync(adminPassword, saltRounds);
        const token = jwt.sign({ email: adminEmail, role: 'admin' }, privateKey, {
            algorithm: 'RS256',
            expiresIn: process.env.JWT_ACCESS_TOKEN_EXPIRY || '8h'
        });

        const admin = new Admin({
            name: adminName,
            email: adminEmail,
            password: hashedPassword,
            business: savedBusiness._id,
            role: 'owner',
            token: token
        });

        const savedAdmin = await admin.save();

        // Populate business type for response
        await savedBusiness.populate('businessType', 'name code icon');

        res.status(201).json({
            message: 'Business registered successfully',
            token: token,
            admin: {
                id: savedAdmin._id,
                name: savedAdmin.name,
                email: savedAdmin.email,
                role: savedAdmin.role
            },
            business: {
                id: savedBusiness._id,
                name: savedBusiness.name,
                email: savedBusiness.email,
                phone: savedBusiness.phone,
                currency: savedBusiness.currency,
                taxRate: savedBusiness.taxRate,
                taxLabel: savedBusiness.taxLabel,
                businessType: savedBusiness.businessType
            }
        });
    } catch (error) {
        console.error('Error registering business:', error);
        res.status(500).json({ message: 'Failed to register business', error: error.message });
    }
};

// Get business by ID
export const getBusinessById = async (req, res) => {
    try {
        const { id } = req.params;
        const business = await Business.findById(id).populate('businessType', 'name code icon features');

        if (!business) {
            return res.status(404).json({ message: 'Business not found' });
        }

        res.status(200).json(business);
    } catch (error) {
        console.error('Error fetching business:', error);
        res.status(500).json({ message: 'Failed to fetch business' });
    }
};

// Update business
export const updateBusiness = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const business = await Business.findByIdAndUpdate(id, updates, { new: true })
            .populate('businessType', 'name code icon');

        if (!business) {
            return res.status(404).json({ message: 'Business not found' });
        }

        res.status(200).json(business);
    } catch (error) {
        console.error('Error updating business:', error);
        res.status(500).json({ message: 'Failed to update business' });
    }
};
