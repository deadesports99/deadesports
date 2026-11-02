import { Router } from 'express';
import * as depositController from '../controllers/deposit.controller.js';
import * as withdrawalController from '../controllers/withdrawal.controller.js';
import { authenticate, requirePermission } from '../middlewares/auth.middleware.js';

/**
 * Admin wallet console — mounted at /api/v1/admin/wallet.
 * Guarded by canManageWallet (ADMIN passes unconditionally).
 *
 *  GET   /withdrawals                  -> payout queue (status filter)
 *  POST  /withdrawals/:id/approve      -> mark paid (UTR number)
 *  POST  /withdrawals/:id/reject       -> reject + auto-refund player
 *  GET   /deposits                     -> Add Cash verification queue
 *  POST  /deposits/:id/approve         -> verify UTR & credit deposit balance
 *  POST  /deposits/:id/reject          -> reject with a reason
 */
export const adminWalletRouter: Router = Router();

adminWalletRouter.use(authenticate, requirePermission('canManageWallet'));

adminWalletRouter.get('/withdrawals', withdrawalController.listWithdrawals);
adminWalletRouter.post('/withdrawals/:id/approve', withdrawalController.approveWithdrawal);
adminWalletRouter.post('/withdrawals/:id/reject', withdrawalController.rejectWithdrawal);

adminWalletRouter.get('/deposits', depositController.listDeposits);
adminWalletRouter.post('/deposits/:id/approve', depositController.approveDeposit);
adminWalletRouter.post('/deposits/:id/reject', depositController.rejectDeposit);
