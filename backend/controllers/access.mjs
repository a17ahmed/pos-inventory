import Access from '../models/access.mjs';
import Employee from '../models/employee.mjs';
import { invalidateAccessCache } from '../middleware/accessControl.mjs';

/**
 * GET /access/:employeeId
 * Get permissions for a specific employee.
 */
export const getEmployeeAccess = async (req, res) => {
    try {
        const { employeeId } = req.params;

        const employee = await Employee.findOne({
            _id: employeeId,
            business: req.user.businessId
        }).select('name employeeId role').lean();

        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        let access = await Access.findOne({
            employee: employeeId,
            business: req.user.businessId
        }).lean();

        // If no access doc exists, create one with defaults
        if (!access) {
            access = await Access.create({
                employee: employeeId,
                business: req.user.businessId
            });
            access = access.toObject();
        }

        res.json({ employee, access });
    } catch (error) {
        console.error('Error fetching access:', error);
        res.status(500).json({ message: 'Failed to fetch employee access' });
    }
};

/**
 * PUT /access/:employeeId
 * Set/update permissions for a specific employee.
 * Body: { permissions: { pos: { view: true, create: true }, ... } }
 */
export const updateEmployeeAccess = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const { permissions } = req.body;

        if (!permissions || typeof permissions !== 'object') {
            return res.status(400).json({ message: 'Permissions object is required' });
        }

        // Verify employee exists in this business
        const employee = await Employee.findOne({
            _id: employeeId,
            business: req.user.businessId
        });

        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        // Upsert: create if not exists, update if exists
        const access = await Access.findOneAndUpdate(
            { employee: employeeId, business: req.user.businessId },
            { permissions },
            { new: true, upsert: true, runValidators: true }
        );

        // Clear cached permissions so changes take effect immediately
        invalidateAccessCache(employeeId, req.user.businessId);

        res.json({
            message: 'Permissions updated successfully',
            access
        });
    } catch (error) {
        console.error('Error updating access:', error);
        res.status(500).json({ message: 'Failed to update employee access' });
    }
};

/**
 * GET /access
 * Get all employees with their permissions for this business.
 */
export const getAllAccess = async (req, res) => {
    try {
        const employees = await Employee.find({
            business: req.user.businessId,
            status: 'active'
        }).select('name employeeId role').lean();

        const accessDocs = await Access.find({
            business: req.user.businessId
        }).lean();

        const accessMap = new Map();
        for (const doc of accessDocs) {
            accessMap.set(doc.employee.toString(), doc);
        }

        const result = employees.map(emp => ({
            ...emp,
            access: accessMap.get(emp._id.toString()) || null,
            hasAccess: accessMap.has(emp._id.toString())
        }));

        res.json(result);
    } catch (error) {
        console.error('Error fetching all access:', error);
        res.status(500).json({ message: 'Failed to fetch access list' });
    }
};

/**
 * DELETE /access/:employeeId
 * Remove access document (resets to no permissions).
 */
export const deleteEmployeeAccess = async (req, res) => {
    try {
        const { employeeId } = req.params;

        const result = await Access.findOneAndDelete({
            employee: employeeId,
            business: req.user.businessId
        });

        if (!result) {
            return res.status(404).json({ message: 'Access record not found' });
        }

        invalidateAccessCache(employeeId, req.user.businessId);

        res.json({ message: 'Access removed. Employee will have no permissions.' });
    } catch (error) {
        console.error('Error deleting access:', error);
        res.status(500).json({ message: 'Failed to delete access' });
    }
};
