import { Router } from 'express';
import { listarHorarios, listarHorariosReservables, crearHorario, editarHorario, editarExcepcionHorario, eliminarHorario } from '../controllers/horarios.controller';

const router = Router();

router.get('/', listarHorarios);
router.get('/reservables', listarHorariosReservables);
router.post('/', crearHorario);
router.patch('/:id', editarHorario);
router.patch('/:id/excepcion', editarExcepcionHorario);
router.delete('/:id', eliminarHorario);

export default router;
