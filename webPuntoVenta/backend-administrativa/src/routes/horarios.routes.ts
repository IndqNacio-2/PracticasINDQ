import { Router } from 'express';
import { listarHorarios, listarHorariosReservables, crearHorario, editarHorario, editarExcepcionHorario, eliminarHorario } from '../controllers/horarios.controller';
import { Horario } from '../models/Horarios/horarios';
import { Clase } from '../models/Clases/clases';
import { Usuario } from '../models/Usuarios/usuarios';
import { esObjectId } from '../lib/validacion';

const router = Router();

router.get('/', listarHorarios);
router.get('/reservables', listarHorariosReservables);
// Solo confirma referencias; no expone información personal del entrenador.
router.get('/:id/validacion', async (req, res) => {
    if (!esObjectId(req.params.id)) return res.status(400).json({ error: 'El horario no es válido.' });
    const horario: any = await Horario.findById(req.params.id);
    if (!horario) return res.status(404).json({ error: 'El horario no existe.' });
    if (!esObjectId(horario.idClase) || !esObjectId(horario.entrenadorId)) return res.status(409).json({ error: 'La sesión no tiene clase o entrenador válidos.' });
    const [clase, entrenador]: any[] = await Promise.all([Clase.findById(horario.idClase), Usuario.findById(horario.entrenadorId)]);
    if (!clase || clase.estatus !== 'activo' || !entrenador || entrenador.rol !== 'entrenador' || entrenador.estatus !== 'activo') {
        return res.status(409).json({ error: 'La clase o el entrenador no existen o están inactivos.' });
    }
    res.json({ valido: true });
});
router.post('/', crearHorario);
router.patch('/:id', editarHorario);
router.patch('/:id/excepcion', editarExcepcionHorario);
router.delete('/:id', eliminarHorario);

export default router;
