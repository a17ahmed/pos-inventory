import mongoose, { Schema } from "mongoose";

// Return item schema (embedded in each return entry)
const returnItemSchema = new Schema({
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true },
    costPrice: { type: Number, default: 0 },
    refundAmount: { type: Number, default: 0 },
    profitLost: { type: Number, default: 0 },
    reason: {
        type: String,
        enum: ["defective", "wrong_item", "changed_mind", "expired", "damaged", "other"],
        default: "changed_mind"
    },
    reasonNote: { type: String, default: "" }
}, { _id: false });

// Return entry schema (each return event on a bill)
const returnEntrySchema = new Schema({
    returnNumber: { type: String, required: true },
    items: [returnItemSchema],
    refundMethod: {
        type: String,
        enum: ["cash", "card", "store_credit"],
        default: "cash"
    },
    refundAmount: { type: Number, default: 0 },
    profitLost: { type: Number, default: 0 },
    processedBy: { type: Schema.Types.ObjectId, ref: "Employee", default: null },
    processedByName: { type: String, default: "" },
    returnedAt: { type: Date, default: Date.now }
}, { _id: true });

// Bill item schema
const billItemSchema = new Schema({
    product: { type: Schema.Types.ObjectId, ref: "Product", default: null },
    name: { type: String, required: true },
    barcode: { type: String, default: "" },
    category: { type: String, default: "General" },
    qty: { type: Number, required: true },
    price: { type: Number, required: true },
    costPrice: { type: Number, default: 0 },
    gst: { type: Number, default: 0 },
    itemTotal: { type: Number, default: 0 },
    itemProfit: { type: Number, default: 0 },
    returnedQty: { type: Number, default: 0 },
    remainingQty: { type: Number, default: 0 },
    returnedProfit: { type: Number, default: 0 },
    netProfit: { type: Number, default: 0 }
}, { _id: true });

const billSchema = new Schema(
    {
        billNumber: { type: Number },
        business: {
            type: Schema.Types.ObjectId,
            ref: "Business",
            required: true
        },

        // Status
        status: {
            type: String,
            enum: ["hold", "completed", "cancelled"],
            default: "completed"
        },
        paymentStatus: {
            type: String,
            enum: ["unpaid", "partial", "paid"],
            default: "paid"
        },
        returnStatus: {
            type: String,
            enum: ["none", "partial", "full"],
            default: "none"
        },
        type: {
            type: String,
            enum: ["sale", "refund"],
            default: "sale"
        },

        // Items
        items: {
            type: [billItemSchema],
            required: true
        },

        // Totals
        subtotal: { type: Number, default: 0 },
        totalTax: { type: Number, default: 0 },
        total: { type: Number, default: 0 },
        totalQty: { type: Number, default: 0 },

        // Profit
        totalCost: { type: Number, default: 0 },
        billProfit: { type: Number, default: 0 },
        returnedProfit: { type: Number, default: 0 },
        netProfit: { type: Number, default: 0 },

        // Payments (tracks each payment event)
        payments: [{
            amount: { type: Number, required: true },
            method: {
                type: String,
                enum: ["cash", "card", "online", "store_credit"],
                default: "cash"
            },
            paidAt: { type: Date, default: Date.now },
            receivedBy: { type: Schema.Types.ObjectId, ref: "Employee", default: null },
            receivedByName: { type: String, default: "" },
            note: { type: String, default: "" }
        }],
        amountPaid: { type: Number, default: 0 },
        amountDue: { type: Number, default: 0 },
        cashGiven: { type: Number, default: 0 },
        change: { type: Number, default: 0 },
        idempotencyKey: { type: String },

        // People
        cashier: { type: Schema.Types.ObjectId, ref: "Employee", default: null },
        cashierName: { type: String, default: "" },
        customer: { type: Schema.Types.ObjectId, ref: "Customer", default: null },
        customerName: { type: String, default: "Walk-in" },
        customerPhone: { type: String, default: "" },

        // Returns
        returns: [returnEntrySchema],
        totalRefunded: { type: Number, default: 0 },
        netAmount: { type: Number, default: 0 },

        // Cancel info (only for cancelled hold bills)
        cancelReason: { type: String, default: "" },
        cancelledBy: { type: Schema.Types.ObjectId, ref: "Employee", default: null },
        cancelledAt: { type: Date, default: null },
        refundOnCancel: { type: Number, default: 0 },

        // Hold info
        holdNote: { type: String, default: "" },
        holdAt: { type: Date, default: null },

        // Refund receipt (self-reference when type = "refund")
        originalBill: { type: Schema.Types.ObjectId, ref: "Bill", default: null },

        // Meta
        billName: { type: String, default: "" },
        notes: { type: String, default: "" },
        date: { type: String },
        time: { type: String }
    },
    { timestamps: true }
);

// ── Indexes ──────────────────────────────────────────────────
billSchema.index({ billNumber: 1, business: 1 }, { unique: true });
billSchema.index({ business: 1, status: 1 });
billSchema.index({ business: 1, status: 1, date: 1 });
billSchema.index({ cashier: 1, business: 1 });
billSchema.index({ customer: 1, business: 1 });
billSchema.index(
    { idempotencyKey: 1 },
    { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } }
);

// ── Pre-save: calculate all totals and profits ───────────────
billSchema.pre("save", function (next) {
    // Item-level calculations
    for (const item of this.items) {
        item.itemTotal = item.price * item.qty;
        item.itemProfit = (item.price - item.costPrice) * item.qty;
        item.remainingQty = item.qty - item.returnedQty;
        item.returnedProfit = (item.price - item.costPrice) * item.returnedQty;
        item.netProfit = item.itemProfit - item.returnedProfit;
    }

    // Bill-level totals
    this.subtotal = this.items.reduce((sum, i) => sum + i.itemTotal, 0);
    this.totalTax = this.items.reduce((sum, i) => sum + (i.gst * i.qty), 0);
    this.total = this.subtotal + this.totalTax;
    this.totalQty = this.items.reduce((sum, i) => sum + i.qty, 0);

    // Bill-level profit
    this.totalCost = this.items.reduce((sum, i) => sum + (i.costPrice * i.qty), 0);
    this.billProfit = this.total - this.totalCost;
    this.returnedProfit = this.items.reduce((sum, i) => sum + i.returnedProfit, 0);
    this.netProfit = this.billProfit - this.returnedProfit;

    // Return totals
    this.totalRefunded = this.returns.reduce((sum, r) => sum + r.refundAmount, 0);
    this.netAmount = this.total - this.totalRefunded;

    // Calculate amountPaid from payments[]
    this.amountPaid = this.payments.reduce((sum, p) => sum + p.amount, 0);

    // Payment status
    if (this.amountPaid <= 0) {
        this.paymentStatus = "unpaid";
    } else if (this.amountPaid < this.total) {
        this.paymentStatus = "partial";
    } else {
        this.paymentStatus = "paid";
    }

    // Payment calculations
    this.amountDue = this.total - this.amountPaid;
    if (this.amountDue < 0) this.amountDue = 0;
    this.change = this.cashGiven - this.total;
    if (this.change < 0) this.change = 0;

    // Return status
    const totalReturnedQty = this.items.reduce((sum, i) => sum + i.returnedQty, 0);
    if (totalReturnedQty <= 0) {
        this.returnStatus = "none";
    } else if (totalReturnedQty < this.totalQty) {
        this.returnStatus = "partial";
    } else {
        this.returnStatus = "full";
    }

    next();
});

// ── Post-save: sync customer ledger (skip for walk-in) ───────
billSchema.post("save", async function () {
    if (!this.customer) return;

    const Customer = mongoose.model("Customer");

    // Aggregate all bills for this customer in this business
    const result = await mongoose.model("Bill").aggregate([
        {
            $match: {
                customer: this.customer,
                business: this.business,
                status: { $ne: "cancelled" }
            }
        },
        {
            $group: {
                _id: null,
                totalBilled: { $sum: "$total" },
                totalPaid: { $sum: "$amountPaid" },
                totalReturns: {
                    $sum: {
                        $cond: [{ $ne: ["$returnStatus", "none"] }, 1, 0]
                    }
                },
                totalPurchases: { $sum: 1 },
                lastPurchase: { $max: "$createdAt" }
            }
        }
    ]);

    if (result.length > 0) {
        const stats = result[0];
        await Customer.findByIdAndUpdate(this.customer, {
            totalBilled: stats.totalBilled,
            totalPaid: stats.totalPaid,
            balance: stats.totalBilled - stats.totalPaid,
            totalPurchases: stats.totalPurchases,
            totalReturns: stats.totalReturns,
            lastPurchase: stats.lastPurchase
        });
    } else {
        // No active bills — reset ledger
        await Customer.findByIdAndUpdate(this.customer, {
            totalBilled: 0,
            totalPaid: 0,
            balance: 0,
            totalPurchases: 0,
            totalReturns: 0,
            lastPurchase: null
        });
    }
});

const Bill = mongoose.model("Bill", billSchema);

export default Bill;
