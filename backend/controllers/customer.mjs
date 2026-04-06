import Customer from '../models/customer.mjs';

// Create or get customer (upsert by phone + business)
export const createOrGetCustomer = async (req, res) => {
    try {
        const { name, phone } = req.body;

        if (!name || !phone) {
            return res.status(400).json({ message: 'Name and phone are required' });
        }

        const customer = await Customer.findOneAndUpdate(
            { phone: phone.trim(), business: req.user.businessId },
            { name: name.trim() },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        res.status(200).json(customer);
    } catch (error) {
        console.error('Error creating/getting customer:', error);
        res.status(500).json({ message: 'Failed to save customer' });
    }
};

// Get all customers for a business
export const getCustomers = async (req, res) => {
    try {
        const customers = await Customer.find({
            business: req.user.businessId
        }).sort({ name: 1 });

        res.json(customers);
    } catch (error) {
        console.error('Error fetching customers:', error);
        res.status(500).json({ message: 'Failed to fetch customers' });
    }
};

// Search customers by name or phone
export const searchCustomers = async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.trim().length === 0) {
            return res.json([]);
        }

        const query = q.trim();
        const customers = await Customer.find({
            business: req.user.businessId,
            $or: [
                { name: { $regex: query, $options: 'i' } },
                { phone: { $regex: query, $options: 'i' } }
            ]
        }).sort({ name: 1 }).limit(20);

        res.json(customers);
    } catch (error) {
        console.error('Error searching customers:', error);
        res.status(500).json({ message: 'Failed to search customers' });
    }
};
