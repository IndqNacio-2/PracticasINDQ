import { api } from '../../lib/api';
import type {
  CrearProgramacionSemanal,
  EditarProgramacionSemanal,
  PlantillaHorario,
  ResultadoCreacionProgramacionSemanal,
  ResultadoOperacionSerieSemanal,
} from '../../types';

export const programacionApi = {
  listar: () => api.get<PlantillaHorario[]>('/plantillas-horarios'),
  crear: (programacion: CrearProgramacionSemanal) => (
    api.post<ResultadoCreacionProgramacionSemanal>('/plantillas-horarios', programacion)
  ),
  editarSerie: (serieId: string, programacion: EditarProgramacionSemanal) => (
    api.patch<ResultadoOperacionSerieSemanal>(`/plantillas-horarios/series/${serieId}`, programacion)
  ),
  desactivarSerie: (serieId: string, aplicarDesde: string) => (
    api.post<ResultadoOperacionSerieSemanal>(`/plantillas-horarios/series/${serieId}/desactivar`, { aplicarDesde })
  ),
  eliminarFuturoSerie: (serieId: string, aplicarDesde: string) => (
    api.delete<ResultadoOperacionSerieSemanal>(`/plantillas-horarios/series/${serieId}/futuro`, { aplicarDesde })
  ),
};