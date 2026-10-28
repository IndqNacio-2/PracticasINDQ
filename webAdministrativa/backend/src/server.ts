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
import reporteRoutes from './routes/reportes.routes';
import asistenciaRoutes from './routes/asistencia.routes';
import { requireAuth } from './middleware/auth';
import { connectDB } from './lib/mongo';

if (!process.env.JWT_SECRET) {
  throw new Error('Falta JWT_SECRET en el archivo .env');
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
// 1 MB: la foto del entrenador viaja en base64 dentro del JSON
app.use(express.json({ limit: '8mb' }));

// Públicas
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes); // /login es público; /me ya usa requireAuth por dentro

// Todo lo demás exige sesión (token Bearer). Los permisos por rol están dentro de cada ruta.
app.use('/api/clientes', requireAuth, clienteRoutes);
app.use('/api/reservaciones', requireAuth, reservacionRoutes);
app.use('/api/horarios', requireAuth, horarioRoutes);
app.use('/api/clases', requireAuth, claseRoutes);
app.use('/api/productos', requireAuth, productoRoutes);
app.use('/api/movimientos', requireAuth, movimientoRoutes);
app.use('/api/usuarios', requireAuth, usuarioRoutes);
app.use('/api/ventas', requireAuth, ventaRoutes);
app.use('/api/reportes', requireAuth, reporteRoutes);
app.use('/api/asistencia', requireAuth, asistenciaRoutes);

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