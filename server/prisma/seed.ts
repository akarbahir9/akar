import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash('adminadmin', 10);
  const vendorPassword = await bcrypt.hash('vendorvendor', 10);
  const customerPassword = await bcrypt.hash('customercustomer', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: { email: 'admin@example.com', name: 'Admin', passwordHash: adminPassword, role: 'ADMIN' }
  });

  const vendorUser = await prisma.user.upsert({
    where: { email: 'vendor@example.com' },
    update: {},
    create: { email: 'vendor@example.com', name: 'Vendor User', passwordHash: vendorPassword, role: 'VENDOR' }
  });

  const vendor = await prisma.vendor.upsert({
    where: { ownerId: vendorUser.id },
    update: {},
    create: { name: 'Acme Co', slug: 'acme', ownerId: vendorUser.id, description: 'Quality goods' }
  });

  const customer = await prisma.user.upsert({
    where: { email: 'customer@example.com' },
    update: {},
    create: { email: 'customer@example.com', name: 'Customer', passwordHash: customerPassword, role: 'CUSTOMER' }
  });

  const electronics = await prisma.category.upsert({ where: { slug: 'electronics' }, update: {}, create: { name: 'Electronics', slug: 'electronics' } });
  const apparel = await prisma.category.upsert({ where: { slug: 'apparel' }, update: {}, create: { name: 'Apparel', slug: 'apparel' } });

  await prisma.product.upsert({
    where: { slug: 'smartphone-xyz' },
    update: {},
    create: {
      title: 'Smartphone XYZ',
      slug: 'smartphone-xyz',
      description: 'A powerful smartphone',
      priceCents: 69900,
      stock: 50,
      vendorId: vendor.id,
      categories: { connect: [{ id: electronics.id }] },
      images: { create: [{ url: 'https://picsum.photos/seed/phone/800/800', alt: 'Phone' }] }
    }
  });

  console.log('Seed complete:', { admin: admin.email, vendor: vendor.name, customer: customer.email });
}

main().finally(async () => prisma.$disconnect());

