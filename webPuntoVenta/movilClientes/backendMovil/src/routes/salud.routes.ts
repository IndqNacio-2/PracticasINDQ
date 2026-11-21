import { Router } from 'express';
import { Enfermedad, Lesion } from '../salud-core/catalogo.model';

// Catálogos de enfermedades y lesiones usuales para el registro. Son públicos (se consultan ANTES de tener cuenta)
// y de solo lectura: el administrador los edita desde la web (/api/enfermedades y /api/lesiones).
// Si el cliente tiene algo que no está en la lista, lo escribe en el registro y se guarda en su perfil de salud.
const router = Router();

const lista = (Modelo: typeof Enfermedad) => async (_req: unknown, res: { json: (v: unknown) => void }) => {
    const items = await Modelo.find({ estatus: 'activo' }).sort({ nombre: 1 }).collation({ locale: 'es', strength: 2 });
    res.json(items.map((i: any) => ({ id: String(i._id), nombre: i.nombre })));
};

router.get('/enfermedades', lista(Enfermedad));
router.get('/lesiones', lista(Lesion as unknown as typeof Enfermedad));

export default router;
