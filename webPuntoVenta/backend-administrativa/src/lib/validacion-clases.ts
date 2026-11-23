import { esEnteroPositivo, esTextoNoVacio } from './validacion';

export function validarClase(datos: unknown, parcial = false): string | null {
    if (!datos || typeof datos !== 'object' || Array.isArray(datos)) return 'Envía un objeto con los datos de la clase.';
    const d = datos as Record<string, unknown>;
    const permitidos = ['nombre', 'descripcion', 'capacidad', 'precio', 'color', 'estatus'];
    if (Object.keys(d).some(campo => !permitidos.includes(campo))) return 'La clase contiene campos no permitidos; el entrenador se asigna en el horario.';
    if ((!parcial || 'nombre' in d) && !esTextoNoVacio(d.nombre)) return 'El nombre de la clase es obligatorio y no puede contener solo espacios.';
    if ((!parcial || 'capacidad' in d) && !esEnteroPositivo(d.capacidad)) return 'La capacidad debe ser un número entero mayor que cero.';
    if ('precio' in d && (typeof d.precio !== 'number' || !Number.isFinite(d.precio) || d.precio < 0)) return 'El precio debe ser un número mayor o igual a cero.';
    if ('estatus' in d && !['activo', 'inactivo'].includes(String(d.estatus))) return 'El estatus debe ser activo o inactivo.';
    return null;
}