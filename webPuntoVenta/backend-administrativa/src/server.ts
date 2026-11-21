import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import clienteRoutes from './routes/clientes.routes';
import reservacionRoutes from './routes/reservaciones.routes';
import horarioRoutes from './routes/horarios.routes';
import claseRoutes from './routes/clases.routes';
import plantillaHorarioRoutes from './routes/plantillas-horarios.routes';
import productoRoutes from './routes/productos.routes';
import movimientoRoutes from './routes/movimientos.routes';
import usuarioRoutes from './routes/usuarios.routes';
import ventaRoutes from './routes/ventas.routes';
import membresiaRoutes from './routes/membresia.routes';
import reportesRoutes from './routes/reportes.routes';
import comprasMembresiaRoutes from './routes/compras-membresia.routes';
import { crearRutasClientesMovil } from './routes/clientes-movil.routes';
import { pool } from './lib/post';
import { permitir, PERMISOS } from './middleware/permisos';
import { connectDB } from './lib/mongo';
import { marcarInasistenciasVencidas } from './services/reservaciones.service';
import { iniciarMantenimientoHorizonte } from './services/mantener-horizonte-sesiones';
import { iniciarCumpleanos } from './services/cumpleanos.service';

if (!process.env.JWT_SECRET) {
  throw new Error('Falta JWT_SECRET en el archivo .env');
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
// Límite ampliado exclusivamente para usuarios con foto reducida.
app.use('/api/usuarios', express.json({ limit: '25mb' }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/movil', crearRutasClientesMovil(pool));
// Permisos por rol: ver src/middleware/permisos.ts (productos, movimientos, membresías y usuarios
// ya validan su rol dentro de su propio router).
app.use('/api/clientes', permitir(PERMISOS.clientes), clienteRoutes);
app.use('/api/reservaciones', permitir(PERMISOS.reservaciones), reservacionRoutes);
app.use('/api/horarios', permitir(PERMISOS.clasesYHorarios), horarioRoutes);
app.use('/api/clases', permitir(PERMISOS.clasesYHorarios), claseRoutes);
app.use('/api/plantillas-horarios', permitir(PERMISOS.clasesYHorarios), plantillaHorarioRoutes);
app.use('/api/productos', productoRoutes);
app.use('/api/movimientos', movimientoRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/ventas', permitir(PERMISOS.ventas), ventaRoutes);
app.use('/api/membresias', membresiaRoutes);
app.use('/api/reportes', permitir(PERMISOS.reportes), reportesRoutes);
app.use('/api/membresias-compras', permitir(PERMISOS.membresiasCompras), comprasMembresiaRoutes);

// Exporta la app para que el gateway unificado pueda montarla bajo su prefijo
// (/admin) en un solo puerto. Con GATEWAY_MODE no abre su propio puerto y un
// fallo de MongoDB solo afecta a esta sección: no apaga el proceso completo.
export default app;

connectDB()
  .then(() => {
    iniciarMantenimientoHorizonte();
    iniciarCumpleanos();
    // Cada minuto: las clases que ya pasaron sin asistencia quedan como inasistencia (antes lo hacía cobro).
    setInterval(() => {
      marcarInasistenciasVencidas().catch((error) => console.error('Revisión de inasistencias:', error.message));
    }, 60_000).unref();
    if (process.env.GATEWAY_MODE) {
      console.log('API administrativa conectada a MongoDB (gateway unificado)');
      return;
    }
    app.listen(PORT, () => {
      console.log(`API escuchando en http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    if (process.env.GATEWAY_MODE) {
      console.error('MongoDB no disponible; la sección administrativa fallará:', err);
      return;
    }
    console.error('No se pudo conectar a MongoDB:', err);
    process.exit(1);
  });