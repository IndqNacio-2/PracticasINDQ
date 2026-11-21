import { Router } from 'express';
import { isValidObjectId, type Model } from 'mongoose';
import { asyncHandler, manejarErrores } from '../lib/asynchandler';
import { Enfermedad, Lesion } from '../salud-core/catalogo.model';
import { patronBusqueda } from '../clientes-core/busqueda';

// CRUD de los catálogos de enfermedades (/api/enfermedades) y lesiones (/api/lesiones).
// Lectura: administrador, recepción y vendedor. Alta, edición y baja: administrador (ver middleware/permisos.ts).
// Un cliente que tiene algo que no viene en la lista lo escribe y se guarda en su perfil de salud (no aquí).
function crud(Modelo: Model<any>, etiqueta: string) {
    const router = Router();
    const error = (res: any, status: number, mensaje: string) => res.status(status).json({ error: mensaje });
    const nombreValido = (v: unknown) => {
        const n = typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '';
        return n.length >= 2 && n.length <= 80 ? n : null;
    };
    const duplicado = (err: any) => err?.code === 11000;

    // ?estatus=activo|inactivo & ?q=texto (por nombre, sin acentos ni mayúsculas)
    router.get('/', asyncHandler(async (req, res) => {
        const filtro: Record<string, any> = {};
        if (req.query.estatus === 'activo' || req.query.estatus === 'inactivo') filtro.estatus = req.query.estatus;
        if (typeof req.query.q === 'string' && req.query.q.trim()) filtro.nombre = { $regex: patronBusqueda(req.query.q), $options: 'i' };
        res.json(await Modelo.find(filtro).sort({ nombre: 1 }).collation({ locale: 'es', strength: 2 }));
    }));

    router.get('/:id', asyncHandler(async (req, res) => {
        if (!isValidObjectId(req.params.id)) return error(res, 400, 'ID inválido');
        const item = await Modelo.findById(req.params.id);
        if (!item) return error(res, 404, `${etiqueta} no encontrada`);
        res.json(item);
    }));

    router.post('/', asyncHandler(async (req, res) => {
        const nombre = nombreValido(req.body?.nombre);
        if (!nombre) return error(res, 400, 'El nombre es obligatorio (2 a 80 caracteres)');
        try {
            const estatus = req.body?.estatus === 'inactivo' ? 'inactivo' : 'activo';
            res.status(201).json(await Modelo.create({ nombre, estatus }));
        } catch (err) {
            if (duplicado(err)) return error(res, 409, `Ya existe esa ${etiqueta.toLowerCase()} en el catálogo`);
            throw err;
        }
    }));

    router.patch('/:id', asyncHandler(async (req, res) => {
        if (!isValidObjectId(req.params.id)) return error(res, 400, 'ID inválido');
        const item = await Modelo.findById(req.params.id);
        if (!item) return error(res, 404, `${etiqueta} no encontrada`);
        if (req.body?.nombre !== undefined) {
            const nombre = nombreValido(req.body.nombre);
            if (!nombre) return error(res, 400, 'El nombre debe tener de 2 a 80 caracteres');
            item.nombre = nombre;
        }
        if (req.body?.estatus === 'activo' || req.body?.estatus === 'inactivo') item.estatus = req.body.estatus;
        try {
            res.json(await item.save());
        } catch (err) {
            if (duplicado(err)) return error(res, 409, `Ya existe esa ${etiqueta.toLowerCase()} en el catálogo`);
            throw err;
        }
    }));

    // Se elimina del catálogo; los clientes que ya la tienen en su perfil la conservan (ahí se guarda como texto).
    router.delete('/:id', asyncHandler(async (req, res) => {
        if (!isValidObjectId(req.params.id)) return error(res, 400, 'ID inválido');
        const item = await Modelo.findByIdAndDelete(req.params.id);
        if (!item) return error(res, 404, `${etiqueta} no encontrada`);
        res.json({ mensaje: `${etiqueta} eliminada del catálogo` });
    }));

    router.use(manejarErrores);
    return router;
}

export const enfermedadesRoutes = crud(Enfermedad as unknown as Model<any>, 'Enfermedad');
export const lesionesRoutes = crud(Lesion as unknown as Model<any>, 'Lesión');
