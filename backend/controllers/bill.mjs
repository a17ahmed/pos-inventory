import mongoose from "mongoose";
import Bill from "../models/bill.mjs";
import Counter from "../models/counter.mjs";
import Product from "../models/product.mjs";

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Batch-fetch costPrice for an array of items that have a product ObjectId.
 * Returns a Map<string, number> keyed by product id.
 */
const buildCostMap = async (items, businessId) => {
    const ids = items
        .map((i) => i.product)
        .filter((id) => id && mongoose.Types.ObjectId.isValid(id));

    if (ids.length === 0) return new Map();

    const products = await Product.find(
        { _id: { $in: ids }, business: businessId },
        { costPrice: 1 }
    ).lean();

    const map = new Map();
    for (const p of products) map.set(p._id.toString(), p.costPrice || 0);
    return map;
};

/**
 * Enrich bill items with costPrice from the Product collection.
 * Mutates nothing -- returns a new array.
 */
const enrichItemsWithCost = async (items, businessId) => {
    const costMap = await buildCostMap(items, businessId);
    return items.map((item) => ({
        ...item,
        costPrice:
            item.costPrice ??
            (item.product ? costMap.get(item.product.toString()) || 0 : 0),
    }));
};

/**
 * Bulk-deduct stock for sold items (only products with trackStock:true).
 * Best-effort: logs errors but does not throw.
 */
const deductStock = async (items, businessId) => {
    const ops = items
        .filter((i) => i.product && mongoose.Types.ObjectId.isValid(i.product))
        .map((i) => ({
            updateOne: {
                filter: {
                    _id: i.product,
                    business: businessId,
                    trackStock: true,
                },
                update: { $inc: { stockQuantity: -(i.qty || 1) } },
            },
        }));

    if (ops.length === 0) return;

    try {
        await Product.bulkWrite(ops);
    } catch (err) {
        console.error("Stock deduction failed (bill already saved):", err.message);
    }
};

/**
 * Bulk-restore stock for returned items.
 */
const restoreStock = async (items, businessId) => {
    const ops = items
        .filter((i) => i.product && mongoose.Types.ObjectId.isValid(i.product))
        .map((i) => ({
            updateOne: {
                filter: {
                    _id: i.product,
                    business: businessId,
                    trackStock: true,
                },
                update: { $inc: { stockQuantity: i.quantity || i.qty || 1 } },
            },
        }));

    if (ops.length === 0) return;

    try {
        await Product.bulkWrite(ops);
    } catch (err) {
        console.error("Stock restoration failed:", err.message);
    }
};

/**
 * Generate a return number in the format RET-YYYYMMDD-####
 */
const generateReturnNumber = async (businessId) => {
    const seq = await Counter.getNextSequence("returnNumber", businessId);
    const d = new Date();
    const ymd =
        String(d.getFullYear()) +
        String(d.getMonth() + 1).padStart(2, "0") +
        String(d.getDate()).padStart(2, "0");
    return `RET-${ymd}-${String(seq).padStart(4, "0")}`;
};

// ═══════════════════════════════════════════════════════════════════════════
// SALES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /bills
 * Create a completed sale or a hold bill.
 * Body.status can be "completed" (default) or "hold".
 */
export const createBill = async (req, res) => {
    try {
        if (!req.user?.businessId) {
            return res.status(400).json({ message: "Business ID not found. Please log out and log in again." });
        }

        const { items, idempotencyKey, status } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ message: "Bill must have at least one item" });
        }

        // ── Idempotency guard ──────────────────────────────────────
        if (idempotencyKey) {
            const existing = await Bill.findOne({
                idempotencyKey,
                business: req.user.businessId,
            });
            if (existing) {
                return res.status(409).json({
                    alreadyPaid: true,
                    bill: existing,
                    message: `Bill #${existing.billNumber} has already been paid`,
                });
            }
        }

        // ── Enrich items with costPrice ────────────────────────────
        const enrichedItems = await enrichItemsWithCost(items, req.user.businessId);

        // ── Atomic bill number ─────────────────────────────────────
        const billNumber = await Counter.getNextSequence("billNumber", req.user.businessId);

        const now = new Date();
        const billStatus = status === "hold" ? "hold" : "completed";

        // Build payments array from the request
        const payments = [];
        if (req.body.payments && Array.isArray(req.body.payments)) {
            payments.push(...req.body.payments);
        } else if (req.body.amountPaid && req.body.amountPaid > 0 && billStatus === "completed") {
            // Backwards-compat: single payment from amountPaid field
            payments.push({
                amount: req.body.amountPaid,
                method: req.body.paymentMethod || "cash",
                paidAt: now,
                receivedBy: req.user.id,
                receivedByName: req.user.name || "Staff",
            });
        }

        const bill = new Bill({
            billNumber,
            business: req.user.businessId,
            status: billStatus,
            type: "sale",
            items: enrichedItems,
            payments,
            cashGiven: req.body.cashGiven || 0,
            idempotencyKey: idempotencyKey || undefined,

            // People
            cashier: req.user.id,
            cashierName: req.user.name || "Staff",
            customer: req.body.customer || null,
            customerName: req.body.customerName || "Walk-in",
            customerPhone: req.body.customerPhone || "",

            // Hold info
            holdNote: billStatus === "hold" ? req.body.holdNote || "" : "",
            holdAt: billStatus === "hold" ? now : null,

            // Meta
            billName: req.body.billName || "",
            notes: req.body.notes || "",
            date: now.toLocaleDateString(),
            time: now.toLocaleTimeString(),
        });

        const saved = await bill.save();

        // ── Stock deduction (only for completed sales) ─────────────
        if (billStatus === "completed") {
            await deductStock(enrichedItems, req.user.businessId);
        }

        res.status(201).json(saved);
    } catch (error) {
        console.error("Error creating bill:", error);

        // Duplicate idempotency key (unique index violation)
        if (error.code === 11000 && error.keyPattern?.idempotencyKey) {
            const existing = await Bill.findOne({
                idempotencyKey: req.body.idempotencyKey,
                business: req.user.businessId,
            });
            return res.status(409).json({
                alreadyPaid: true,
                bill: existing,
                message: `Bill has already been processed`,
            });
        }

        res.status(500).json({ message: "Failed to create bill" });
    }
};

/**
 * GET /bills
 * Paginated list with optional status & type filters. Sorted by createdAt desc.
 */
export const getAllBills = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 30;
        const fetchAll = req.query.all === "true";

        const query = { business: req.user.businessId };

        if (req.query.status) query.status = req.query.status;
        if (req.query.type) query.type = req.query.type;
        if (req.query.paymentStatus) query.paymentStatus = req.query.paymentStatus;

        // Date range filter
        if (req.query.startDate || req.query.endDate) {
            query.createdAt = {};
            if (req.query.startDate) query.createdAt.$gte = new Date(req.query.startDate);
            if (req.query.endDate) query.createdAt.$lte = new Date(req.query.endDate);
        }

        const total = await Bill.countDocuments(query);

        let bills;
        if (fetchAll) {
            bills = await Bill.find(query).sort({ createdAt: -1 }).lean();
        } else {
            const skip = (page - 1) * limit;
            bills = await Bill.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean();
        }

        const totalPages = fetchAll ? 1 : Math.ceil(total / limit);

        res.json({
            bills,
            pagination: {
                page: fetchAll ? 1 : page,
                perPage: fetchAll ? total : limit,
                total,
                totalPages,
                hasMore: fetchAll ? false : page < totalPages,
            },
        });
    } catch (error) {
        console.error("Error fetching bills:", error);
        res.status(500).json({ message: "Failed to fetch bills" });
    }
};

/**
 * GET /bills/:id
 */
export const getBill = async (req, res) => {
    try {
        const bill = await Bill.findOne({
            _id: req.params.id,
            business: req.user.businessId,
        });

        if (!bill) return res.status(404).json({ message: "Bill not found" });

        res.json(bill);
    } catch (error) {
        console.error("Error fetching bill:", error);
        res.status(500).json({ message: "Failed to fetch bill" });
    }
};

/**
 * PATCH /bills/:id
 * Safe field updates only -- never allow changing billNumber, business, type, etc.
 */
export const updateBill = async (req, res) => {
    try {
        const bill = await Bill.findOne({
            _id: req.params.id,
            business: req.user.businessId,
        });

        if (!bill) return res.status(404).json({ message: "Bill not found" });

        // Whitelist of safe fields
        const safe = [
            "customerName",
            "customerPhone",
            "cashGiven",
            "notes",
            "billName",
            "holdNote",
        ];

        for (const key of safe) {
            if (req.body[key] !== undefined) bill[key] = req.body[key];
        }

        const updated = await bill.save(); // triggers pre-save recalculation
        res.json(updated);
    } catch (error) {
        console.error("Error updating bill:", error);
        res.status(500).json({ message: "Failed to update bill" });
    }
};

/**
 * DELETE /bills/:id
 */
export const deleteBill = async (req, res) => {
    try {
        const bill = await Bill.findOneAndDelete({
            _id: req.params.id,
            business: req.user.businessId,
        });

        if (!bill) return res.status(404).json({ message: "Bill not found" });

        res.json({ message: "Bill deleted", bill });
    } catch (error) {
        console.error("Error deleting bill:", error);
        res.status(500).json({ message: "Failed to delete bill" });
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// HOLD BILLS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /bills/hold
 * Create a hold bill. Accepts optional partial payment.
 */
export const holdBill = async (req, res) => {
    try {
        if (!req.user?.businessId) {
            return res.status(400).json({ message: "Business ID not found. Please log out and log in again." });
        }

        const { items } = req.body;
        if (!items || items.length === 0) {
            return res.status(400).json({ message: "Bill must have at least one item" });
        }

        const enrichedItems = await enrichItemsWithCost(items, req.user.businessId);
        const billNumber = await Counter.getNextSequence("billNumber", req.user.businessId);
        const now = new Date();

        // Build payment if partial payment was made
        const payments = [];
        const amountPaid = parseFloat(req.body.amountPaid) || 0;
        if (amountPaid > 0) {
            payments.push({
                amount: amountPaid,
                method: req.body.paymentMethod || "cash",
                paidAt: now,
                receivedBy: req.user.id,
                receivedByName: req.user.name || "Staff",
                note: "Partial payment on hold",
            });
        }

        const bill = new Bill({
            billNumber,
            business: req.user.businessId,
            status: "hold",
            type: "sale",
            items: enrichedItems,
            payments,
            cashier: req.user.id,
            cashierName: req.user.name || "Staff",
            customer: req.body.customer || null,
            customerName: req.body.customerName || "Walk-in",
            customerPhone: req.body.customerPhone || "",
            holdNote: req.body.holdNote || req.body.billName || "",
            holdAt: now,
            billName: req.body.billName || "",
            notes: req.body.notes || "",
            date: now.toLocaleDateString(),
            time: now.toLocaleTimeString(),
        });

        const saved = await bill.save();
        res.status(201).json(saved);
    } catch (error) {
        console.error("Error creating hold bill:", error);
        res.status(500).json({ message: "Failed to create hold bill" });
    }
};

/**
 * GET /bills/hold
 * Get all hold bills with sorting options.
 */
export const getHoldBills = async (req, res) => {
    try {
        const { sortBy } = req.query;

        let sortOption = { createdAt: -1 };
        if (sortBy === "amount") sortOption = { amountDue: -1 };
        else if (sortBy === "customer") sortOption = { customerName: 1, createdAt: -1 };

        const bills = await Bill.find({
            business: req.user.businessId,
            status: "hold",
        })
            .populate("customer", "name phone")
            .sort(sortOption)
            .lean();

        res.json(bills);
    } catch (error) {
        console.error("Error fetching hold bills:", error);
        res.status(500).json({ message: "Failed to fetch hold bills" });
    }
};

/**
 * PATCH /bills/:id/resume
 * Mark a hold bill as resumed and return its data so the frontend can
 * load it back into the POS.
 */
export const resumeHoldBill = async (req, res) => {
    try {
        const bill = await Bill.findOne({
            _id: req.params.id,
            business: req.user.businessId,
            status: "hold",
        });

        if (!bill) return res.status(404).json({ message: "Hold bill not found" });

        bill.status = "completed";
        const saved = await bill.save();

        res.json(saved);
    } catch (error) {
        console.error("Error resuming hold bill:", error);
        res.status(500).json({ message: "Failed to resume hold bill" });
    }
};

/**
 * PATCH /bills/:id/cancel
 * Cancel a hold bill, track reason and optional refund for partial payment.
 */
export const cancelHoldBill = async (req, res) => {
    try {
        const bill = await Bill.findOne({
            _id: req.params.id,
            business: req.user.businessId,
            status: "hold",
        });

        if (!bill) return res.status(404).json({ message: "Hold bill not found" });

        bill.status = "cancelled";
        bill.cancelReason = req.body.cancelReason || "";
        bill.cancelledBy = req.user.id;
        bill.cancelledAt = new Date();
        bill.refundOnCancel = parseFloat(req.body.refundOnCancel) || 0;

        const saved = await bill.save();
        res.json(saved);
    } catch (error) {
        console.error("Error cancelling hold bill:", error);
        res.status(500).json({ message: "Failed to cancel hold bill" });
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// RETURNS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /bills/:id/returns
 * Process a return against an existing completed bill.
 * Adds an entry to bill.returns[], updates item returnedQty, restores stock.
 * The post-save hook handles customer ledger sync.
 */
export const processReturn = async (req, res) => {
    try {
        const bill = await Bill.findOne({
            _id: req.params.id,
            business: req.user.businessId,
            status: "completed",
            type: "sale",
        });

        if (!bill) {
            return res.status(404).json({ message: "Completed sale bill not found" });
        }

        const { items, refundMethod, notes } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ message: "No items to return" });
        }

        // Validate return quantities don't exceed remaining
        for (const returnItem of items) {
            const billItem = bill.items.id(returnItem.itemId);
            if (!billItem) {
                return res.status(400).json({
                    message: `Item not found in bill: ${returnItem.name || returnItem.itemId}`,
                });
            }
            const remaining = billItem.qty - billItem.returnedQty;
            if (returnItem.quantity > remaining) {
                return res.status(400).json({
                    message: `Cannot return ${returnItem.quantity} of "${billItem.name}" - only ${remaining} remaining`,
                });
            }
        }

        // Generate return number
        const returnNumber = await generateReturnNumber(req.user.businessId);

        // Build return entry
        let totalRefundAmount = 0;
        let totalProfitLost = 0;
        const returnItems = [];

        for (const returnItem of items) {
            const billItem = bill.items.id(returnItem.itemId);

            const refundAmount = billItem.price * returnItem.quantity;
            const profitLost = (billItem.price - billItem.costPrice) * returnItem.quantity;

            totalRefundAmount += refundAmount;
            totalProfitLost += profitLost;

            returnItems.push({
                name: billItem.name,
                quantity: returnItem.quantity,
                price: billItem.price,
                costPrice: billItem.costPrice,
                refundAmount,
                profitLost,
                reason: returnItem.reason || "changed_mind",
                reasonNote: returnItem.reasonNote || "",
            });

            // Update the bill item's returnedQty
            billItem.returnedQty += returnItem.quantity;
        }

        // Push return entry onto bill
        bill.returns.push({
            returnNumber,
            items: returnItems,
            refundMethod: refundMethod || "cash",
            refundAmount: totalRefundAmount,
            profitLost: totalProfitLost,
            processedBy: req.user.id,
            processedByName: req.user.name || "Staff",
            returnedAt: new Date(),
        });

        // Pre-save hook recalculates totals, returnStatus, netProfit etc.
        const saved = await bill.save();

        // Restore stock for returned items
        const stockItems = items
            .map((ri) => {
                const billItem = bill.items.id(ri.itemId);
                return billItem?.product
                    ? { product: billItem.product, quantity: ri.quantity }
                    : null;
            })
            .filter(Boolean);

        await restoreStock(stockItems, req.user.businessId);

        res.json({
            message: "Return processed successfully",
            returnNumber,
            refundAmount: totalRefundAmount,
            bill: saved,
        });
    } catch (error) {
        console.error("Error processing return:", error);
        res.status(500).json({ message: "Failed to process return" });
    }
};

/**
 * GET /bills/returns
 * Get all bills that have at least one return (returnStatus != "none").
 */
export const getReturns = async (req, res) => {
    try {
        const query = {
            business: req.user.businessId,
            returnStatus: { $ne: "none" },
        };

        if (req.query.startDate || req.query.endDate) {
            query.createdAt = {};
            if (req.query.startDate) query.createdAt.$gte = new Date(req.query.startDate);
            if (req.query.endDate) query.createdAt.$lte = new Date(req.query.endDate);
        }

        const bills = await Bill.find(query)
            .sort({ createdAt: -1 })
            .lean();

        res.json(bills);
    } catch (error) {
        console.error("Error fetching returns:", error);
        res.status(500).json({ message: "Failed to fetch returns" });
    }
};

/**
 * GET /bills/return-lookup/:billNumber
 * Lookup a bill by billNumber for the return screen.
 * Shows remaining quantities per item.
 */
export const getBillForReturn = async (req, res) => {
    try {
        const bill = await Bill.findOne({
            billNumber: parseInt(req.params.billNumber),
            business: req.user.businessId,
        });

        if (!bill) return res.status(404).json({ message: "Bill not found" });

        if (bill.type === "refund") {
            return res.status(400).json({
                message: "Cannot process return on a refund bill",
                isRefundBill: true,
            });
        }

        if (bill.status === "cancelled") {
            return res.status(400).json({ message: "Cannot process return on a cancelled bill" });
        }

        const itemsWithReturns = bill.items.map((item) => ({
            ...item.toObject(),
            originalQty: item.qty,
            returnedQty: item.returnedQty || 0,
            remainingQty: item.qty - (item.returnedQty || 0),
        }));

        res.json({
            ...bill.toObject(),
            items: itemsWithReturns,
            hasReturns: bill.returns && bill.returns.length > 0,
            returnHistory: bill.returns || [],
        });
    } catch (error) {
        console.error("Error looking up bill for return:", error);
        res.status(500).json({ message: "Failed to look up bill" });
    }
};

/**
 * GET /bills/returns/summary
 * Today's return stats.
 */
export const getReturnsSummary = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const result = await Bill.aggregate([
            {
                $match: {
                    business: new mongoose.Types.ObjectId(req.user.businessId),
                    returnStatus: { $ne: "none" },
                },
            },
            { $unwind: "$returns" },
            {
                $match: {
                    "returns.returnedAt": { $gte: today },
                },
            },
            {
                $group: {
                    _id: null,
                    totalReturns: { $sum: 1 },
                    totalRefunded: { $sum: "$returns.refundAmount" },
                    totalItems: {
                        $sum: {
                            $reduce: {
                                input: "$returns.items",
                                initialValue: 0,
                                in: { $add: ["$$value", "$$this.quantity"] },
                            },
                        },
                    },
                },
            },
        ]);

        const stats = result[0] || { totalReturns: 0, totalRefunded: 0, totalItems: 0 };

        res.json({
            totalReturns: stats.totalReturns,
            totalRefunded: stats.totalRefunded,
            totalItems: stats.totalItems,
        });
    } catch (error) {
        console.error("Error fetching returns summary:", error);
        res.status(500).json({ message: "Failed to fetch returns summary" });
    }
};

/**
 * PATCH /bills/:id/returns/:returnId/cancel
 * Reverse a specific return entry. Restores stock and item returnedQty.
 */
export const cancelReturn = async (req, res) => {
    try {
        const bill = await Bill.findOne({
            _id: req.params.id,
            business: req.user.businessId,
        });

        if (!bill) return res.status(404).json({ message: "Bill not found" });

        const returnEntry = bill.returns.id(req.params.returnId);
        if (!returnEntry) {
            return res.status(404).json({ message: "Return entry not found" });
        }

        // Restore item returnedQty on the bill
        for (const returnItem of returnEntry.items) {
            const billItem = bill.items.find(
                (i) => i.name.toLowerCase() === returnItem.name.toLowerCase()
            );
            if (billItem) {
                billItem.returnedQty = Math.max(0, billItem.returnedQty - returnItem.quantity);
            }
        }

        // Reverse stock restoration (deduct the stock that was restored during the return)
        const stockItems = [];
        for (const returnItem of returnEntry.items) {
            const billItem = bill.items.find(
                (i) => i.name.toLowerCase() === returnItem.name.toLowerCase()
            );
            if (billItem?.product) {
                stockItems.push({
                    product: billItem.product,
                    qty: returnItem.quantity, // deductStock uses .qty
                });
            }
        }
        await deductStock(stockItems, req.user.businessId);

        // Remove the return entry
        bill.returns.pull(req.params.returnId);

        // Pre-save recalculates totals, returnStatus, etc.
        const saved = await bill.save();

        res.json({ message: "Return cancelled successfully", bill: saved });
    } catch (error) {
        console.error("Error cancelling return:", error);
        res.status(500).json({ message: "Failed to cancel return" });
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// STATS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /bills/stats?filter=today|week|month&chart=true
 * Single $facet aggregation for today/week/month stats with profit tracking.
 */
export const getBillStats = async (req, res) => {
    try {
        const businessId = new mongoose.Types.ObjectId(req.user.businessId);
        const filter = req.query.filter || "today";
        const includeChart = req.query.chart === "true";

        const now = new Date();
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);

        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - 7);
        weekStart.setHours(0, 0, 0, 0);

        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        // Determine period boundaries
        let periodStart, prevPeriodStart, prevPeriodEnd;
        switch (filter) {
            case "week":
                periodStart = weekStart;
                prevPeriodStart = new Date(weekStart);
                prevPeriodStart.setDate(prevPeriodStart.getDate() - 7);
                prevPeriodEnd = weekStart;
                break;
            case "month":
                periodStart = monthStart;
                prevPeriodStart = new Date(monthStart);
                prevPeriodStart.setMonth(prevPeriodStart.getMonth() - 1);
                prevPeriodEnd = monthStart;
                break;
            default: // today
                periodStart = today;
                prevPeriodStart = new Date(today);
                prevPeriodStart.setDate(prevPeriodStart.getDate() - 1);
                prevPeriodEnd = today;
        }

        const saleMatch = { type: "sale", status: { $ne: "cancelled" } };

        const facets = {
            // Current period sales
            periodSales: [
                {
                    $match: {
                        business: businessId,
                        createdAt: { $gte: periodStart },
                        ...saleMatch,
                    },
                },
                {
                    $group: {
                        _id: null,
                        grossRevenue: { $sum: "$total" },
                        totalOrders: { $sum: 1 },
                        totalItems: { $sum: "$totalQty" },
                        totalCost: { $sum: "$totalCost" },
                        totalProfit: { $sum: "$billProfit" },
                        totalRefunded: { $sum: "$totalRefunded" },
                        netProfit: { $sum: "$netProfit" },
                    },
                },
            ],
            // Previous period (for growth calculation)
            prevPeriod: [
                {
                    $match: {
                        business: businessId,
                        createdAt: { $gte: prevPeriodStart, $lt: prevPeriodEnd },
                        ...saleMatch,
                    },
                },
                {
                    $group: {
                        _id: null,
                        grossRevenue: { $sum: "$total" },
                    },
                },
            ],
        };

        // Add today/month facets only if not the selected period
        if (filter !== "today") {
            facets.todaySales = [
                { $match: { business: businessId, createdAt: { $gte: today }, ...saleMatch } },
                {
                    $group: {
                        _id: null,
                        sales: { $sum: "$total" },
                        orders: { $sum: 1 },
                        refunded: { $sum: "$totalRefunded" },
                        profit: { $sum: "$netProfit" },
                    },
                },
            ];
        }
        if (filter !== "month") {
            facets.monthSales = [
                { $match: { business: businessId, createdAt: { $gte: monthStart }, ...saleMatch } },
                {
                    $group: {
                        _id: null,
                        sales: { $sum: "$total" },
                        orders: { $sum: 1 },
                        refunded: { $sum: "$totalRefunded" },
                        profit: { $sum: "$netProfit" },
                    },
                },
            ];
        }

        // Chart data
        if (includeChart) {
            const chartGroupBy =
                filter === "today"
                    ? { $hour: "$createdAt" }
                    : { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };

            facets.chartData = [
                { $match: { business: businessId, createdAt: { $gte: periodStart }, ...saleMatch } },
                {
                    $group: {
                        _id: chartGroupBy,
                        revenue: { $sum: "$total" },
                        profit: { $sum: "$netProfit" },
                        orders: { $sum: 1 },
                    },
                },
                { $sort: { _id: 1 } },
            ];
        }

        // Single DB round-trip
        const [facetResult] = await Bill.aggregate([{ $facet: facets }]);

        // ── Extract results ────────────────────────────────────────
        const period = facetResult.periodSales[0] || {
            grossRevenue: 0,
            totalOrders: 0,
            totalItems: 0,
            totalCost: 0,
            totalProfit: 0,
            totalRefunded: 0,
            netProfit: 0,
        };
        const prev = facetResult.prevPeriod[0] || { grossRevenue: 0 };

        const netRevenue = period.grossRevenue - period.totalRefunded;
        const avgOrderValue = period.totalOrders > 0 ? period.grossRevenue / period.totalOrders : 0;
        const profitMargin = netRevenue > 0 ? (period.netProfit / netRevenue) * 100 : 0;
        const growth =
            prev.grossRevenue > 0
                ? ((period.grossRevenue - prev.grossRevenue) / prev.grossRevenue) * 100
                : 0;

        // Today stats
        let todayData;
        if (filter === "today") {
            todayData = {
                sales: period.grossRevenue,
                orders: period.totalOrders,
                refunded: period.totalRefunded,
                profit: period.netProfit,
            };
        } else {
            todayData = facetResult.todaySales?.[0] || { sales: 0, orders: 0, refunded: 0, profit: 0 };
        }

        // Month stats
        let monthData;
        if (filter === "month") {
            monthData = {
                sales: period.grossRevenue,
                orders: period.totalOrders,
                refunded: period.totalRefunded,
                profit: period.netProfit,
            };
        } else {
            monthData = facetResult.monthSales?.[0] || { sales: 0, orders: 0, refunded: 0, profit: 0 };
        }

        const response = {
            // Core (filtered period)
            grossRevenue: period.grossRevenue,
            totalOrders: period.totalOrders,
            totalItems: period.totalItems,
            avgOrderValue,
            growth,

            // Returns & refunds
            totalRefunded: period.totalRefunded,

            // P&L
            netRevenue,
            totalCost: period.totalCost,
            grossProfit: period.totalProfit,
            netProfit: period.netProfit,
            profitMargin,

            // Today
            todaySales: todayData.sales,
            todayOrders: todayData.orders,
            todayRefunded: todayData.refunded,
            todayProfit: todayData.profit,
            netTodaySales: todayData.sales - todayData.refunded,

            // Month
            monthSales: monthData.sales,
            monthOrders: monthData.orders,
            monthRefunded: monthData.refunded,
            monthProfit: monthData.profit,
            netMonthSales: monthData.sales - monthData.refunded,

            // Meta
            filter,
            periodStart,
            periodEnd: now,
        };

        if (includeChart) {
            response.chartData = facetResult.chartData || [];
        }

        res.json(response);
    } catch (error) {
        console.error("Error fetching bill stats:", error);
        res.status(500).json({ message: "Failed to fetch bill stats" });
    }
};

/**
 * GET /bills/top-products?limit=12
 * Most sold products aggregation.
 */
export const getTopProducts = async (req, res) => {
    try {
        const businessId = new mongoose.Types.ObjectId(req.user.businessId);
        const limit = parseInt(req.query.limit) || 12;

        const topProducts = await Bill.aggregate([
            {
                $match: {
                    business: businessId,
                    type: "sale",
                    status: { $ne: "cancelled" },
                },
            },
            { $unwind: "$items" },
            {
                $group: {
                    _id: { $ifNull: ["$items.product", "$items.name"] },
                    name: { $first: "$items.name" },
                    product: { $first: "$items.product" },
                    totalQtySold: { $sum: "$items.qty" },
                    totalRevenue: { $sum: "$items.itemTotal" },
                    totalProfit: { $sum: "$items.netProfit" },
                    lastPrice: { $last: "$items.price" },
                    transactionCount: { $sum: 1 },
                },
            },
            { $sort: { totalQtySold: -1 } },
            { $limit: limit },
        ]);

        // Enrich with current product details
        const productIds = topProducts
            .filter((p) => p.product)
            .map((p) => p.product);

        let productDetails = {};
        if (productIds.length > 0) {
            const products = await Product.find(
                { _id: { $in: productIds }, business: businessId },
                { name: 1, sellingPrice: 1, category: 1 }
            ).lean();

            for (const p of products) {
                productDetails[p._id.toString()] = p;
            }
        }

        const result = topProducts.map((item) => {
            const details = item.product ? productDetails[item.product.toString()] : null;
            return {
                _id: item.product || item._id,
                name: details?.name || item.name,
                price: details?.sellingPrice || item.lastPrice,
                category: details?.category || "General",
                totalQtySold: item.totalQtySold,
                totalRevenue: item.totalRevenue,
                totalProfit: item.totalProfit,
                transactionCount: item.transactionCount,
            };
        });

        res.json(result);
    } catch (error) {
        console.error("Error fetching top products:", error);
        res.status(500).json({ message: "Failed to fetch top products" });
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// PAYMENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /bills/:id/payments
 * Add a payment entry to an existing bill's payments[].
 * If fully paid, the pre-save hook sets paymentStatus to "paid".
 * For hold bills that become fully paid, auto-complete the bill.
 */
export const addPayment = async (req, res) => {
    try {
        const bill = await Bill.findOne({
            _id: req.params.id,
            business: req.user.businessId,
        });

        if (!bill) return res.status(404).json({ message: "Bill not found" });

        if (bill.status === "cancelled") {
            return res.status(400).json({ message: "Cannot add payment to a cancelled bill" });
        }

        const { amount, method, note } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ message: "Payment amount must be greater than 0" });
        }

        bill.payments.push({
            amount: parseFloat(amount),
            method: method || "cash",
            paidAt: new Date(),
            receivedBy: req.user.id,
            receivedByName: req.user.name || "Staff",
            note: note || "",
        });

        // If this is a hold bill and total payments >= total, auto-complete
        const newTotal = bill.payments.reduce((sum, p) => sum + p.amount, 0);
        if (bill.status === "hold" && newTotal >= bill.total) {
            bill.status = "completed";
            // Deduct stock now that the hold bill is completed
            await deductStock(bill.items, req.user.businessId);
        }

        // Pre-save hook recalculates amountPaid, amountDue, paymentStatus
        const saved = await bill.save();

        res.json(saved);
    } catch (error) {
        console.error("Error adding payment:", error);
        res.status(500).json({ message: "Failed to add payment" });
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// REFUND
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /bills/:id/refund
 * Full refund of a completed bill. Creates a linked refund bill (type:"refund").
 */
export const refundBill = async (req, res) => {
    try {
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json({ message: "Refund reason is required" });
        }

        const original = await Bill.findOne({
            _id: req.params.id,
            business: req.user.businessId,
            status: "completed",
            type: "sale",
        });

        if (!original) {
            return res.status(404).json({ message: "Completed sale bill not found" });
        }

        // Check if already refunded (a refund bill already references this one)
        const existingRefund = await Bill.findOne({
            originalBill: original._id,
            type: "refund",
            business: req.user.businessId,
        });
        if (existingRefund) {
            return res.status(400).json({
                message: "This bill has already been refunded",
                refundBill: existingRefund,
            });
        }

        const now = new Date();
        const refundBillNumber = await Counter.getNextSequence("billNumber", req.user.businessId);

        // Create refund bill with negative amounts
        const refundItems = original.items.map((item) => ({
            product: item.product,
            name: item.name,
            barcode: item.barcode,
            category: item.category,
            qty: item.qty,
            price: -Math.abs(item.price),
            costPrice: item.costPrice,
            gst: item.gst,
        }));

        const refund = new Bill({
            billNumber: refundBillNumber,
            business: req.user.businessId,
            status: "completed",
            type: "refund",
            items: refundItems,
            originalBill: original._id,
            cashier: req.user.id,
            cashierName: req.user.name || "Staff",
            customer: original.customer,
            customerName: original.customerName,
            customerPhone: original.customerPhone,
            notes: reason,
            date: now.toLocaleDateString(),
            time: now.toLocaleTimeString(),
        });

        const savedRefund = await refund.save();

        // Restore stock for all items
        const stockItems = original.items
            .filter((i) => i.product)
            .map((i) => ({ product: i.product, quantity: i.qty }));
        await restoreStock(stockItems, req.user.businessId);

        res.json({
            message: "Refund processed successfully",
            originalBill: original,
            refundBill: savedRefund,
        });
    } catch (error) {
        console.error("Error processing refund:", error);
        res.status(500).json({ message: "Failed to process refund" });
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOMER LEDGER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /bills/customer/:customerId/ledger
 * Get all bills for a specific customer with balance summary.
 */
export const getCustomerLedger = async (req, res) => {
    try {
        const customerId = req.params.customerId;

        if (!mongoose.Types.ObjectId.isValid(customerId)) {
            return res.status(400).json({ message: "Invalid customer ID" });
        }

        const [bills, summary] = await Promise.all([
            Bill.find({
                customer: customerId,
                business: req.user.businessId,
                status: { $ne: "cancelled" },
            })
                .sort({ createdAt: -1 })
                .lean(),

            Bill.aggregate([
                {
                    $match: {
                        customer: new mongoose.Types.ObjectId(customerId),
                        business: new mongoose.Types.ObjectId(req.user.businessId),
                        status: { $ne: "cancelled" },
                    },
                },
                {
                    $group: {
                        _id: null,
                        totalBilled: { $sum: "$total" },
                        totalPaid: { $sum: "$amountPaid" },
                        totalRefunded: { $sum: "$totalRefunded" },
                        billCount: { $sum: 1 },
                        returnsCount: {
                            $sum: { $cond: [{ $ne: ["$returnStatus", "none"] }, 1, 0] },
                        },
                    },
                },
            ]),
        ]);

        const stats = summary[0] || {
            totalBilled: 0,
            totalPaid: 0,
            totalRefunded: 0,
            billCount: 0,
            returnsCount: 0,
        };

        res.json({
            bills,
            summary: {
                totalBilled: stats.totalBilled,
                totalPaid: stats.totalPaid,
                balance: stats.totalBilled - stats.totalPaid,
                totalRefunded: stats.totalRefunded,
                billCount: stats.billCount,
                returnsCount: stats.returnsCount,
            },
        });
    } catch (error) {
        console.error("Error fetching customer ledger:", error);
        res.status(500).json({ message: "Failed to fetch customer ledger" });
    }
};
