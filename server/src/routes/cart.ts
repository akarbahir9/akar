import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

export const cartRouter = Router();

cartRouter.get('/', requireAuth, async (req, res) => {
  const cart = await prisma.cart.findFirst({
    where: { userId: req.user!.id },
    include: { items: { include: { product: true } } }
  });
  res.json(cart || { items: [] });
});

const upsertItemSchema = z.object({ productId: z.string(), quantity: z.number().int().positive() });

cartRouter.post('/items', requireAuth, async (req, res) => {
  const parse = upsertItemSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
  const { productId, quantity } = parse.data;
  const userId = req.user!.id;
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return res.status(404).json({ error: 'Product not found' });
  const priceCents = product.priceCents;
  const cart = await prisma.cart.upsert({
    where: { userId },
    create: { userId },
    update: {}
  });
  const item = await prisma.cartItem.upsert({
    where: { cartId_productId: { cartId: cart.id, productId } },
    create: { cartId: cart.id, productId, quantity, priceCents },
    update: { quantity, priceCents }
  });
  res.json({ cartId: cart.id, item });
});

cartRouter.delete('/items/:productId', requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const productId = req.params.productId;
  const cart = await prisma.cart.findFirst({ where: { userId }, select: { id: true } });
  if (!cart) return res.status(404).json({ error: 'Cart not found' });
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id, productId } });
  res.status(204).end();
});

