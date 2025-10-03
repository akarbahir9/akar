import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const vendorRouter = Router();

vendorRouter.get('/', async (_req, res) => {
  const vendors = await prisma.vendor.findMany({ select: { id: true, name: true, slug: true, description: true } });
  res.json(vendors);
});

const createVendorSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional()
});

vendorRouter.post('/', requireAuth, requireRole('ADMIN', 'VENDOR'), async (req, res) => {
  const parse = createVendorSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
  const ownerId = req.user!.id;
  const { name, slug, description } = parse.data;
  try {
    const vendor = await prisma.vendor.create({ data: { name, slug, description, ownerId } });
    res.status(201).json(vendor);
  } catch (e) {
    res.status(400).json({ error: 'Could not create vendor. Slug may be taken.' });
  }
});

