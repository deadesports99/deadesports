import { Router } from 'express';
import * as walletController from '../controllers/wallet.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

/**
 * Wallet routes — mounted at /api/v1/wallet
 *
 *  GET /         authenticated -> balances (deposit + winning) + ledger history
 */
export const walletRouter: Router = Router();

walletRouter.get('/', authenticate, walletController.getWalletSummary);