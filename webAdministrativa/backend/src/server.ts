import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import clienteRoutes from './routes/clientes.routes';
import reservacionRoutes from './routes/reservaciones.routes';
import horarioRoutes from './routes/horarios.routes';
import claseRoutes from './routes/clases.routes';
import productoRoutes from './routes/productos.routes';
import movimientoRoutes from './routes/movimientos.routes';
import usuarioRoutes from './routes/usuarios.routes';
import ventaRoutes from './routes/ventas.routes';
import { connectDB } from './lib/mongo';

if (!process.env.JWT_SECRET) {
  throw new Error('Falta JWT_SECRET en el archivo .env');
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/clientes', clienteRoutes);
app.use('/api/reservaciones', reservacionRoutes);
app.use('/api/horarios', horarioRoutes);
app.use('/api/clases', claseRoutes);
app.use('/api/productos', productoRoutes);
app.use('/api/movimientos', movimientoRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/ventas', ventaRoutes);

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`API escuchando en http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('No se pudo conectar a MongoDB:', err);
    process.exit(1);
  });