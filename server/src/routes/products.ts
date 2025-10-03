import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const productRouter = Router();

productRouter.get('/', async (req, res) => {
  const { vendor, q } = req.query as { vendor?: string; q?: string };
  const where: any = {};
  if (vendor) where.vendor = { slug: vendor };
  if (q) where.title = { contains: q, mode: 'insensitive' };
  const products = await prisma.product.findMany({
    where,
    select: { id: true, slug: true, title: true, priceCents: true, currency: true, vendor: { select: { slug: true, name: true } }, images: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json(products);
});

productRouter.get('/:slug', async (req, res) => {
  const { slug } = req.params;
  const product = await prisma.product.findUnique({
    where: { slug },
    include: { vendor: true, images: true, reviews: true, categories: true }
  });
  if (!product) return res.status(404).json({ error: 'Not found' });
  res.json(product);
});

const upsertSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().min(1),
  priceCents: z.number().int().positive(),
  stock: z.number().int().nonnegative(),
  images: z.array(z.object({ url: z.string().url(), alt: z.string().optional() })).default([]),
  categories: z.array(z.string()).default([])
});

productRouter.post('/', requireAuth, requireRole('ADMIN', 'VENDOR'), async (req, res) => {
  const parse = upsertSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
  const vendor = await prisma.vendor.findFirst({ where: { ownerId: req.user!.id } });
  if (!vendor) return res.status(400).json({ error: 'Vendor not found for user' });
  const { title, slug, description, priceCents, stock, images, categories } = parse.data;
  try {
    const product = await prisma.product.create({
      data: {
        title, slug, description, priceCents, stock, vendorId: vendor.id,
        images: { create: images.map((i, idx) => ({ url: i.url, alt: i.alt, position: idx })) },
        categories: { connectOrCreate: categories.map((name) => ({ where: { slug: name }, create: { name, slug: name } })) }
      },
      include: { images: true, categories: true }
    });
    res.status(201).json(product);
  } catch (e) {
    res.status(400).json({ error: 'Cannot create product. Slug may be taken.' });
  }
});

productRouter.put('/:slug', requireAuth, requireRole('ADMIN', 'VENDOR'), async (req, res) => {
  const parse = upsertSchema.partial({ slug: true }).safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
  const { slug } = req.params;
  const vendor = await prisma.vendor.findFirst({ where: { ownerId: req.user!.id } });
  if (!vendor) return res.status(400).json({ error: 'Vendor not found for user' });
  const product = await prisma.product.findUnique({ where: { slug } });
  if (!product || product.vendorId !== vendor.id) return res.status(404).json({ error: 'Not found' });
  const { title, description, priceCents, stock, images, categories } = parse.data;
  const updated = await prisma.product.update({
    where: { slug },
    data: {
      title, description, priceCents, stock,
      images: images ? { deleteMany: { productId: product.id }, create: images.map((i, idx) => ({ url: i.url, alt: i.alt, position: idx })) } : undefined,
      categories: categories ? { set: [], connectOrCreate: categories.map((name) => ({ where: { slug: name }, create: { name, slug: name } })) } : undefined
    },
    include: { images: true, categories: true }
  });
  res.json(updated);
});

productRouter.delete('/:slug', requireAuth, requireRole('ADMIN', 'VENDOR'), async (req, res) => {
  const vendor = await prisma.vendor.findFirst({ where: { ownerId: req.user!.id } });
  if (!vendor) return res.status(400).json({ error: 'Vendor not found for user' });
  const { slug } = req.params;
  const product = await prisma.product.findUnique({ where: { slug } });
  if (!product || product.vendorId !== vendor.id) return res.status(404).json({ error: 'Not found' });
  await prisma.product.delete({ where: { id: product.id } });
  res.status(204).end();
});

