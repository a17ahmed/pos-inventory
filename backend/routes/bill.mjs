import express from "express";
import { authorize } from "../middleware/rbac.mjs";
import {
    createBill,
    getAllBills,
    getBill,
    updateBill,
    deleteBill,
    holdBill,
    getHoldBills,
    resumeHoldBill,
    cancelHoldBill,
    processReturn,
    getReturns,
    getBillForReturn,
    getReturnsSummary,
    cancelReturn,
    getBillStats,
    getTopProducts,
    addPayment,
    refundBill,
    getCustomerLedger,
} from "../controllers/bill.mjs";

const billRouter = express.Router();

// ─── Stats (before /:id to avoid conflict) ──────────────────
billRouter.get("/stats", getBillStats);
billRouter.get("/top-products", getTopProducts);

// ─── Hold bills ──────────────────────────────────────────────
billRouter.post("/hold", holdBill);
billRouter.get("/hold", getHoldBills);
billRouter.patch("/:id/resume", resumeHoldBill);
billRouter.patch("/:id/cancel", cancelHoldBill);

// ─── Returns ─────────────────────────────────────────────────
billRouter.get("/returns", getReturns);
billRouter.get("/returns/today-summary", getReturnsSummary);
billRouter.get("/returns/receipt/:billNumber", getBillForReturn);
billRouter.post("/:id/return", processReturn);
billRouter.patch("/:id/return/:returnId/cancel", cancelReturn);

// ─── Payments ────────────────────────────────────────────────
billRouter.post("/:id/payment", addPayment);

// ─── Refund ──────────────────────────────────────────────────
billRouter.post("/:id/refund", refundBill);

// ─── Customer ledger ─────────────────────────────────────────
billRouter.get("/customer/:customerId/ledger", getCustomerLedger);

// ─── Core CRUD ───────────────────────────────────────────────
billRouter.post("/", createBill);
billRouter.get("/", getAllBills);
billRouter.get("/:id", getBill);
billRouter.patch("/:id", updateBill);
billRouter.delete("/:id", authorize("admin"), deleteBill);

export default billRouter;
