import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import { connectDB } from './lib/mongo';
import { requireCliente, secreto } from './middleware/auth';
import authRoutes from './routes/auth.routes';
import perfilRoutes from './routes/perfil.routes';
import claseRoutes from './routes/clases.routes';
import horarioRoutes from './routes/horarios.routes';
import reservacionRoutes from './routes/reservaciones.routes';

secreto(); // falla al arrancar si falta CLIENTES_JWT_SECRET

const app = express();
const PORT = Number(process.env.PORT) || 3005;

app.set('trust proxy', 1);
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
// 1 MB: la foto de perfil viaja en base64 dentro del JSON
app.use(express.json({ limit: '1mb' }));

// Públicas
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);

// Todo lo demás exige token de cliente
app.use('/api/me', requireCliente, perfilRoutes);
app.use('/api/clases', requireCliente, claseRoutes);
app.use('/api/horarios', requireCliente, horarioRoutes);
app.use('/api/reservaciones', requireCliente, reservacionRoutes);

app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// Errores: JSON mal formado, cuerpo demasiado grande y fallos inesperados
app.use((err: { status?: number; type?: string }, _req: Request, res: Response, _next: NextFunction) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'La información enviada es demasiado grande' });
    console.error(err);
    res.status(500).json({ error: 'Ocurrió un error inesperado. Inténtalo de nuevo' });
});

connectDB()
    .then(() => app.listen(PORT, () => console.log(`API de clientes escuchando en http://localhost:${PORT}`)))
    .catch((err) => {
        console.error('No se pudo conectar a MongoDB:', err);
        process.exit(1);
    });
