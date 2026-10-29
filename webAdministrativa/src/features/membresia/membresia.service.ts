import { api } from '../../lib/api';
import type { Estatus } from '../../types';
import type { Membresia, MembresiaInput } from './types';

// Servicio de membresías: habla con la API del backend (/api/membresias).
// Lectura: administrador y recepción. Alta, edición y baja: solo administrador.
// La baja es lógica: la membresía pasa a "inactivo", no se borra.
export const membresiasService = {
    listar: () => api.get<Membresia[]>('/membresias'),
    crear: (datos: MembresiaInput) => api.post<Membresia>('/membresias', datos),
    actualizar: (idMembresia: string, datos: MembresiaInput) => api.patch<Membresia>(`/membresias/${idMembresia}`, datos),
    cambiarEstatus: (idMembresia: string, estatus: Estatus) => api.patch<Membresia>(`/membresias/${idMembresia}`, { estatus }),
};