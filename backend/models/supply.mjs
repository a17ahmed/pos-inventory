import mongoose, { Schema } from 'mongoose';

const supplySchema = new Schema(
    {
        supplyNumber: {
            type: Number,
            required: true
        },
        vendor: {
            type: Schema.Types.ObjectId,
            ref: 'Vendor',
            required: true
        },
        vendorName: {
            type: String,
            default: ''
        },
        billNumber: {
            type: String,
            default: ''
        },
        billDate: {
            type: Date,
            required: true,
            default: Date.now
        },
        items: [
            {
                product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
                name: { type: String, required: true },
                quantity: { type: Number, required: true, min: 1 },
                unitPrice: { type: Number, required: true, min: 0 },
                total: { type: Number, required: true, min: 0 }
            }
        ],
        totalAmount: {
            type: Number,
            required: true,
            min: 0
        },
        paidAmount: {
            type: Number,
            default: 0,
            min: 0
        },
        remainingAmount: {
            type: Number,
            default: 0,
            min: 0
        },
        paymentStatus: {
            type: String,
            enum: ['unpaid', 'partial', 'paid'],
            default: 'unpaid'
        },
        receiptImage: {
            type: String,
            default: null
        },
        notes: {
            type: String,
            default: ''
        },
        createdBy: {
            type: String,
            default: ''
        },
        business: {
            type: Schema.Types.ObjectId,
            ref: 'Business',
            required: true
        }
    },
    { timestamps: true }
);

// Auto-calculate remaining and status before saving
supplySchema.pre('save', function (next) {
    this.remainingAmount = this.totalAmount - this.paidAmount;
    if (this.remainingAmount < 0) this.remainingAmount = 0;

    if (this.paidAmount <= 0) {
        this.paymentStatus = 'unpaid';
    } else if (this.paidAmount >= this.totalAmount) {
        this.paymentStatus = 'paid';
        this.remainingAmount = 0;
    } else {
        this.paymentStatus = 'partial';
    }
    next();
});

supplySchema.index({ supplyNumber: 1, business: 1 }, { unique: true });
supplySchema.index({ business: 1, vendor: 1 });
supplySchema.index({ business: 1, paymentStatus: 1 });
supplySchema.index({ business: 1, billDate: -1 });
supplySchema.index({ business: 1, createdAt: -1 });

const Supply = mongoose.model('Supply', supplySchema);

export default Supply;
