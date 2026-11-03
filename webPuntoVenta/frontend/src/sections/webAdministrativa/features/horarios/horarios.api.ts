import { api } from '../../lib/api';
import type { EditarExcepcionSesion, HorarioClase, ResultadoExcepcionSesion } from '../../types';

export type GuardarHorario = Omit<HorarioClase, 'idHorario' | 'capacidadDisponible' | 'idPlantilla' | 'origen' | 'esExcepcionPlantilla'>;

export const horariosApi = {
  listar: () => api.get<HorarioClase[]>('/horarios'),
  crear: (horario: GuardarHorario) => api.post<HorarioClase>('/horarios', horario),
  editar: (idHorario: string, horario: GuardarHorario) => api.patch<HorarioClase>(`/horarios/${idHorario}`, horario),
  editarExcepcion: (idHorario: string, excepcion: EditarExcepcionSesion) => (
    api.patch<ResultadoExcepcionSesion>(`/horarios/${idHorario}/excepcion`, excepcion)
  ),
};