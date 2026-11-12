import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { listarMembresias, consultarMembresia, crearMembresia, actualizarMembresia } from '../controllers/membresias.controller';

const router = Router();
const lectura = requireRole('administrador', 'recepcion');
const escritura = requireRole('administrador');
router.use(requireAuth);
router.get('/', lectura, listarMembresias);
router.get('/:id', lectura, consultarMembresia);
router.post('/', escritura, crearMembresia);
router.patch('/:id', escritura, actualizarMembresia);
export default router;