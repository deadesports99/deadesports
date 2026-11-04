import { Router } from 'express';
import * as walletController from '../controllers/wallet.controller.js';
import * as depositController from '../controllers/deposit.controller.js';
import * as withdrawalController from '../controllers/withdrawal.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { depositRateLimiter, withdrawalRateLimiter } from '../middlewares/rateLimiter.js';

/**
 * Wallet routes — mounted at /api/v1/wallet
 *
 *  GET   /                     authenticated -> balances + ledger history
 *  POST  /deposit              authenticated -> Add Cash request (amount + UTR)
 *  GET   /deposits             authenticated -> own deposit request history
 *  POST  /withdraw             authenticated (USER) -> UPI withdrawal request
 */
export const walletRouter: Router = Router();

walletRouter.get('/', authenticate, walletController.getWalletSummary);

walletRouter.post('/deposit', authenticate, depositRateLimiter, depositController.submitDeposit);

walletRouter.get('/deposits', authenticate, depositController.listMyDeposits);

walletRouter.post('/withdraw', authenticate, withdrawalRateLimiter, withdrawalController.requestWithdrawal);
