import { Router } from 'express';
import mongoose from 'mongoose';
import { requireAuth } from '../middleware/auth';
import { asyncHandler, manejarErrores } from '../lib/asynchandler';

// Catálogos de enfermedades y lesiones para el registro de clientes (solo lectura).
// El cliente guarda textos (webcobro.clientes.enfermedades / lesiones): lo que no esté en el
// catálogo se registra como "adicional" en su ficha y el catálogo no cambia.
const router = Router();
router.use(requireAuth);

const COLECCIONES = { enfermedades: 'webadministrativa_enfermedades', lesiones: 'webadministrativa_lesiones' } as const;

// Catálogo base por si la colección todavía está vacía.
const BASE: Record<keyof typeof COLECCIONES, string[]> = {
    enfermedades: ['Asma', 'Diabetes tipo 1', 'Diabetes tipo 2', 'Hipertensión arterial', 'Hipotensión', 'Cardiopatía', 'Arritmia cardiaca',
        'Epilepsia', 'Migraña', 'Hipotiroidismo', 'Hipertiroidismo', 'Anemia', 'Artritis', 'Osteoporosis', 'Obesidad', 'Colesterol alto',
        'Enfermedad renal', 'Hernia discal', 'Escoliosis', 'Vértigo', 'Ansiedad', 'Depresión', 'Alergia a medicamentos', 'Embarazo', 'Fibromialgia'],
    lesiones: ['Esguince de tobillo', 'Esguince de rodilla', 'Lesión de ligamento cruzado', 'Lesión de menisco', 'Tendinitis rotuliana',
        'Tendinitis de Aquiles', 'Fascitis plantar', 'Lesión de manguito rotador', 'Luxación de hombro', 'Tendinitis de hombro', 'Epicondilitis (codo de tenista)',
        'Túnel carpiano', 'Esguince de muñeca', 'Lumbalgia', 'Hernia lumbar', 'Cervicalgia', 'Contractura muscular', 'Desgarre muscular',
        'Fractura reciente', 'Cirugía reciente', 'Periostitis tibial'],
};

router.get('/:tipo', asyncHandler(async (req, res) => {
    const tipo = req.params.tipo as keyof typeof COLECCIONES;
    if (!(tipo in COLECCIONES)) return res.status(404).json({ error: 'Catálogo no encontrado.' });
    const db = mongoose.connection.db;
    const filas = db
        ? await db.collection(COLECCIONES[tipo]).find({ estatus: { $ne: 'inactivo' } }).project({ nombre: 1 }).sort({ nombre: 1 }).toArray()
        : [];
    res.json(filas.length
        ? filas.map((f) => ({ id: String(f._id), nombre: String(f.nombre) }))
        : BASE[tipo].map((nombre, i) => ({ id: `base-${i}`, nombre })));
}));

router.use(manejarErrores);
export default router;
