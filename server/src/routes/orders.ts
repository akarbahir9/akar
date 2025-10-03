import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

export const orderRouter = Router();

orderRouter.post('/checkout', requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const cart = await prisma.cart.findFirst({ where: { userId }, include: { items: true } });
  if (!cart || cart.items.length === 0) return res.status(400).json({ error: 'Cart is empty' });
  const totalCents = cart.items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);
  const order = await prisma.order.create({
    data: {
      userId,
      totalCents,
      items: { create: cart.items.map(i => ({ productId: i.productId, quantity: i.quantity, priceCents: i.priceCents })) }
    },
    include: { items: true }
  });
  // Placeholder for Stripe integration
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  res.status(201).json({ order, paymentUrl: null });
});

orderRouter.get('/', requireAuth, async (req, res) => {
  const orders = await prisma.order.findMany({ where: { userId: req.user!.id }, include: { items: true } });
  res.json(orders);
});

