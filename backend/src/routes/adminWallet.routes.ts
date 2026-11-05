import { Router } from 'express';
import * as depositController from '../controllers/deposit.controller.js';
import * as withdrawalController from '../controllers/withdrawal.controller.js';
import * as settlementController from '../controllers/settlement.controller.js';
import * as paymentAdminController from '../controllers/paymentAdmin.controller.js';
import { authenticate, requirePermission, requireRole } from '../middlewares/auth.middleware.js';

/**
 * Admin wallet console — mounted at /api/v1/admin/wallet.
 * Guarded by canManageWallet (ADMIN passes unconditionally).
 *
 *  GET   /withdrawals                  -> payout queue (status filter)
 *  POST  /withdrawals/:id/approve      -> mark paid (UTR number)
 *  POST  /withdrawals/:id/reject       -> reject + auto-refund player
 *  GET   /payments                     -> online (Razorpay/mock) orders + money summary
 *  POST  /payments/:id/sync            -> reconcile one online order with the gateway
 *  GET   /deposits                     -> Add Cash verification queue
 *  POST  /deposits/:id/approve         -> verify UTR & credit deposit balance
 *  POST  /deposits/:id/reject          -> reject with a reason
 *
 *  (Phase 7) Owner-only financial reports:
 *  GET   /settlement?date=YYYY-MM-DD     -> daily money-in/out P&L summary
 *  GET   /settlement/export.csv          -> download the day's full ledger CSV
 */
export const adminWalletRouter: Router = Router();

adminWalletRouter.use(authenticate, requirePermission('canManageWallet'));

// Phase 7 — Daily Settlement & Profit report is owner-only (requireRole('ADMIN')).
adminWalletRouter.get('/settlement', requireRole('ADMIN'), settlementController.getDailySettlement);
adminWalletRouter.get('/settlement/export.csv', requireRole('ADMIN'), settlementController.exportSettlementCsv);

adminWalletRouter.get('/withdrawals', withdrawalController.listWithdrawals);
adminWalletRouter.post('/withdrawals/:id/approve', withdrawalController.approveWithdrawal);
adminWalletRouter.post('/withdrawals/:id/reject', withdrawalController.rejectWithdrawal);

adminWalletRouter.get('/payments', paymentAdminController.listPayments);
adminWalletRouter.post('/payments/:id/sync', paymentAdminController.syncPayment);

adminWalletRouter.get('/deposits', depositController.listDeposits);
adminWalletRouter.post('/deposits/:id/approve', depositController.approveDeposit);
adminWalletRouter.post('/deposits/:id/reject', depositController.rejectDeposit);
