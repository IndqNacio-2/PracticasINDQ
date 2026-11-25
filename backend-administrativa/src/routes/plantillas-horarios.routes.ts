import { Router } from 'express';
import {
    listarPlantillas,
    crearProgramacionSemanal,
    editarSerieSemanal,
    desactivarSerieSemanal,
    eliminarFuturoSerieSemanal,
    editarPlantilla,
    generarSesiones,
    mantenerHorizonte
} from '../controllers/plantillas-horarios.controller';

const router = Router();

router.get('/', listarPlantillas);
router.post('/', crearProgramacionSemanal);
router.patch('/series/:serieId', editarSerieSemanal);
router.post('/series/:serieId/desactivar', desactivarSerieSemanal);
router.delete('/series/:serieId/futuro', eliminarFuturoSerieSemanal);
router.patch('/:id', editarPlantilla);
router.post('/generar', generarSesiones);
router.post('/mantener-horizonte', mantenerHorizonte);

export default router;
