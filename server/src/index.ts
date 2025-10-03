import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { json } from 'express';
import { authRouter } from './routes/auth.js';
import { vendorRouter } from './routes/vendors.js';
import { productRouter } from './routes/products.js';
import { cartRouter } from './routes/cart.js';
import { orderRouter } from './routes/orders.js';

const app = express();
app.use(helmet());
app.use(cors({ origin: '*'}));
app.use(json());

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/auth', authRouter);
app.use('/vendors', vendorRouter);
app.use('/products', productRouter);
app.use('/cart', cartRouter);
app.use('/orders', orderRouter);

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

