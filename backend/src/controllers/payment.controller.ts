import crypto from 'node:crypto';
import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/ApiError.js';
import { sendResponse } from '../utils/ApiResponse.js';
import { prisma } from '../config/prisma.js';
import { paymentConfig } from '../config/payment.js';
import { paymentGateway } from '../services/paymentGateway.service.js';
import { settleCapturedPayment } from '../services/payment.settlement.js';

function requireUser(req: Request) {
  if (!req.user) throw new ApiError(401, 'Authentication required');
  return req.user;
}

function parseAmountPaise(body: Record<string, unknown> | undefined): number {
  const raw = body?.amountPaise ?? (body?.amount != null ? Number(body.amount) * 100 : Number.NaN);
  const amountPaise = Math.round(Number(raw));

  if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
    throw new ApiError(400, 'amountPaise must be a positive integer');
  }
  if (amountPaise < paymentConfig.minAmountPaise) {
    throw new ApiError(400, `Minimum amount is ₹${paymentConfig.minAmountPaise / 100}`);
  }
  if (amountPaise > paymentConfig.maxAmountPaise) {
    throw new ApiError(400, `Maximum amount is ₹${paymentConfig.maxAmountPaise / 100}`);
  }
  return amountPaise;
}

export async function createOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = requireUser(req);
    const amountPaise = parseAmountPaise(req.body);

    const receipt = `rcpt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const order = await prisma.paymentOrder.create({
      data: {
        tenantId: user.tenantId,
        userId: user.userId,
        provider: paymentConfig.provider,
        providerOrderId: `pending_${receipt}`,
        amountPaise,
        currency: paymentConfig.currency,
        receipt,
        status: 'CREATED',
        expiresAt: new Date(Date.now() + paymentConfig.orderTtlSeconds * 1000),
      },
    });

    let gatewayOrder;
    try {
      gatewayOrder = await paymentGateway.createOrder({
        amountPaise,
        receipt,
        notes: { orderId: order.id, userId: user.userId, tenantId: user.tenantId },
      });
    } catch (err) {
      await prisma.paymentOrder.update({
        where: { id: order.id },
        data: {
          status: 'FAILED',
          failureReason: err instanceof Error ? err.message : 'Gateway order creation failed',
        },
      });
      throw err;
    }

    const updated = await prisma.paymentOrder.update({
      where: { id: order.id },
      data: { providerOrderId: gatewayOrder.orderId },
    });

    sendResponse(res, 201, 'Payment order created', {
      orderId: updated.id,
      provider: gatewayOrder.provider,
      providerOrderId: gatewayOrder.orderId,
      amountPaise: gatewayOrder.amountPaise,
      currency: gatewayOrder.currency,
      keyId: gatewayOrder.keyId,
      checkoutUrl: gatewayOrder.checkoutUrl,
      expiresAt: gatewayOrder.expiresAt,
    });
  } catch (err) {
    next(err);
  }
}

export async function getOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = requireUser(req);
    const order = await prisma.paymentOrder.findUnique({ where: { id: String(req.params.id) } });

    if (!order) throw new ApiError(404, 'Payment order not found');
    if (order.userId !== user.userId) throw new ApiError(403, 'Order belongs to another user');

    sendResponse(res, 200, 'Payment order', {
      orderId: order.id,
      status: order.status,
      amountPaise: order.amountPaise,
      currency: order.currency,
      provider: order.provider,
      createdAt: order.createdAt,
      capturedAt: order.capturedAt,
      failureReason: order.failureReason,
    });
  } catch (err) {
    next(err);
  }
}

export async function verifyPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = requireUser(req);

    const orderId = String(req.body?.orderId ?? '');
    const paymentId = String(req.body?.paymentId ?? req.body?.razorpay_payment_id ?? '');
    const signature = String(req.body?.signature ?? req.body?.razorpay_signature ?? '');

    if (!orderId || !paymentId || !signature) {
      throw new ApiError(400, 'orderId, paymentId and signature are required');
    }

    const order = await prisma.paymentOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new ApiError(404, 'Payment order not found');
    if (order.userId !== user.userId) throw new ApiError(403, 'Order belongs to another user');

    if (order.status === 'CAPTURED') {
      sendResponse(res, 200, 'Payment already captured', {
        orderId: order.id,
        status: order.status,
        alreadySettled: true,
      });
      return;
    }

    if (order.expiresAt.getTime() < Date.now()) {
      await prisma.paymentOrder.update({ where: { id: order.id }, data: { status: 'EXPIRED' } });
      throw new ApiError(410, 'Payment order expired');
    }

    const valid = paymentGateway.verifyCheckoutSignature({
      orderId: order.providerOrderId,
      paymentId,
      signature,
    });

    if (!valid) {
      await prisma.paymentOrder.update({
        where: { id: order.id },
        data: { status: 'FAILED', failureReason: 'Signature mismatch' },
      });
      throw new ApiError(400, 'Invalid payment signature');
    }

    const result = await settleCapturedPayment({
      orderId: order.id,
      providerPaymentId: paymentId,
      signature,
    });

    sendResponse(res, 200, 'Payment verified', {
      orderId: order.id,
      status: 'CAPTURED',
      alreadySettled: result.alreadySettled,
      balanceAfter: result.balanceAfter,
    });
  } catch (err) {
    next(err);
  }
}

export async function handleWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const signature = String(req.header('x-razorpay-signature') ?? '');
    const raw = (req as Request & { rawBody?: Buffer }).rawBody;

    if (!raw) throw new ApiError(400, 'Missing raw request body');
    if (!signature || !paymentGateway.verifyWebhookSignature(raw, signature)) {
      throw new ApiError(400, 'Invalid webhook signature');
    }

    const event = JSON.parse(raw.toString()) as {
      event: string;
      payload?: {
        payment?: { entity?: { id: string; order_id: string; status: string; amount: number } };
      };
    };

    const entity = event.payload?.payment?.entity;
    if (!entity) {
      sendResponse(res, 200, 'Event ignored');
      return;
    }

    const order = await prisma.paymentOrder.findFirst({
      where: { providerOrderId: entity.order_id },
    });

    if (!order) {
      sendResponse(res, 200, 'Unknown order');
      return;
    }

    if (event.event === 'payment.captured' || event.event === 'order.paid') {
      await settleCapturedPayment({ orderId: order.id, providerPaymentId: entity.id });
    } else if (event.event === 'payment.failed') {
      await prisma.paymentOrder.updateMany({
        where: { id: order.id, status: { in: ['CREATED', 'PENDING'] } },
        data: { status: 'FAILED', failureReason: 'Gateway reported failure' },
      });
    }

    sendResponse(res, 200, 'Webhook processed');
  } catch (err) {
    next(err);
  }
}

export async function syncOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = requireUser(req);
    const order = await prisma.paymentOrder.findUnique({ where: { id: String(req.params.id) } });

    if (!order) throw new ApiError(404, 'Payment order not found');
    if (order.userId !== user.userId) throw new ApiError(403, 'Order belongs to another user');

    if (order.status === 'CAPTURED') {
      sendResponse(res, 200, 'Payment already captured', {
        orderId: order.id,
        status: order.status,
        alreadySettled: true,
      });
      return;
    }

    const paymentId = String(req.body?.paymentId ?? order.providerPaymentId ?? '');
    if (!paymentId) throw new ApiError(409, 'No gateway payment recorded for this order yet');

    const remote = await paymentGateway.fetchPayment(paymentId);

    if (!remote) {
      sendResponse(res, 200, 'Order status', {
        orderId: order.id,
        status: order.status,
        alreadySettled: false,
      });
      return;
    }

    if (remote.orderId !== order.providerOrderId) {
      throw new ApiError(409, 'Payment does not belong to this order');
    }
    if (remote.status !== 'captured') {
      sendResponse(res, 200, 'Payment not captured yet', {
        orderId: order.id,
        status: order.status,
        gatewayStatus: remote.status,
        alreadySettled: false,
      });
      return;
    }
    if (remote.amountPaise !== order.amountPaise) {
      throw new ApiError(409, 'Paid amount does not match the order amount');
    }

    const settled = await settleCapturedPayment({
      orderId: order.id,
      providerPaymentId: remote.id,
    });

    sendResponse(res, 200, 'Payment reconciled', {
      orderId: order.id,
      status: 'CAPTURED',
      alreadySettled: settled.alreadySettled,
      balanceAfter: settled.balanceAfter,
    });
  } catch (err) {
    next(err);
  }
}

export async function getGatewayInfo(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendResponse(res, 200, 'Payment gateway config', {
      provider: paymentConfig.provider,
      currency: paymentConfig.currency,
      minAmountPaise: paymentConfig.minAmountPaise,
      maxAmountPaise: paymentConfig.maxAmountPaise,
      demoMode: paymentConfig.provider === 'mock',
    });
  } catch (err) {
    next(err);
  }
}

export async function demoCheckoutPage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (paymentConfig.provider !== 'mock') {
      throw new ApiError(400, 'Demo checkout is only available in mock mode');
    }
    res.sendFile(path.resolve('public/demo-checkout.html'));
  } catch (err) {
    next(err);
  }
}

export async function demoCheckoutScript(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (paymentConfig.provider !== 'mock') {
      throw new ApiError(400, 'Demo checkout is only available in mock mode');
    }
    res.type('application/javascript');
    res.sendFile(path.resolve('public/demo-checkout.js'));
  } catch (err) {
    next(err);
  }
}

export async function demoPay(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (paymentConfig.provider !== 'mock') {
      throw new ApiError(400, 'Demo pay is only available in mock mode');
    }

    const orderId = String(req.body?.orderId ?? '');
    const outcome = String(req.body?.outcome ?? 'success');

    const order = await prisma.paymentOrder.findFirst({ where: { providerOrderId: orderId } });
    if (!order) throw new ApiError(404, 'Payment order not found');

    if (outcome === 'failure') {
      await prisma.paymentOrder.update({
        where: { id: order.id },
        data: { status: 'FAILED', failureReason: 'Simulated failure' },
      });
      sendResponse(res, 200, 'Simulated failure', { orderId: order.id, status: 'FAILED' });
      return;
    }

    const paymentId = `pay_mock_${crypto.randomBytes(10).toString('hex')}`;
    const signature = paymentGateway.mockSignature(order.providerOrderId, paymentId);

    if (paymentConfig.mockAutoCapture) {
      await settleCapturedPayment({ orderId: order.id, providerPaymentId: paymentId, signature });
    } else {
      await prisma.paymentOrder.update({
        where: { id: order.id },
        data: { status: 'PENDING', providerPaymentId: paymentId },
      });
    }

    sendResponse(res, 200, 'Simulated payment', {
      orderId: order.id,
      paymentId,
      signature,
      status: paymentConfig.mockAutoCapture ? 'CAPTURED' : 'PENDING',
    });
  } catch (err) {
    next(err);
  }
}
