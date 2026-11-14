import { Router, Request, Response } from 'express';
import {
    Filtros,
    leerFiltros,
    reporteAsistenciaClases,
    reporteInventario,
    reportePersonal,
    reporteVentas,
    reporteVisitas,
} from '../services/reportes.service';

// =====================================================================
// Rutas de reportes (sección 3.1.6). Se montan en /api/reportes.
//
// Todas son GET y comparten los mismos filtros por query string:
//   ?desde=AAAA-MM-DD&hasta=AAAA-MM-DD&horaDesde=0-23&horaHasta=0-23
// Por defecto: últimos 30 días y todo el día.
//
// La autenticación/roles se aplican donde se monte el router, por ejemplo:
//   app.use('/api/reportes', verificarToken, reportesRouter);
// =====================================================================

const router = Router();

type Generador = (filtros: Filtros) => Promise<unknown>;

// Valida los filtros (400 si son inválidos), ejecuta el reporte y responde en JSON.
function manejar(nombre: string, generar: Generador) {
    return async (req: Request, res: Response): Promise<void> => {
        const resultado = leerFiltros(req.query as Record<string, unknown>);
        if (!resultado.ok) {
            res.status(400).json({ mensaje: resultado.error });
            return;
        }

        try {
            res.json(await generar(resultado.filtros));
        } catch (err) {
            console.error(`[reportes] Error al generar el reporte de ${nombre}:`, err);
            res.status(500).json({ mensaje: `No se pudo generar el reporte de ${nombre}` });
        }
    };
}

// Ventas por día y/u horario, por tipo de producto, precio y ticket promedio
router.get('/ventas', manejar('ventas', reporteVentas));

// Visitas de socios (reloj checador) por día y/u horario
router.get('/visitas', manejar('visitas', reporteVisitas));

// Asistencia a clases, por clase y por entrenador
router.get('/asistencia-clases', manejar('asistencia a clases', reporteAsistenciaClases));

// Existencias actuales y mermas del periodo
router.get('/inventario', manejar('inventario', reporteInventario));

// Asistencia, ausentismo y retardos del personal
router.get('/personal', manejar('personal', reportePersonal));

export default router;