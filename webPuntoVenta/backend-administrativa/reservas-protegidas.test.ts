import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reservasDeHorario, ocupacionReal } from './src/services/reservas-protegidas';

test('ocupacion operativa usa ID y excluye espera, cancelaciones e inasistencias', () => {
    const horario = { idHorario: 'sesion-1', nombreClase: 'Yoga', fecha: '2026-11-05', horaInicio: '18:00' };
    const reservas = [
        { horarioId: 'sesion-1', status: 'pagado', capacityStatus: 'confirmada' },
        { horarioId: 'sesion-1', status: 'asistido', capacityStatus: 'confirmada' },
        { horarioId: 'sesion-1', status: 'pendiente', capacityStatus: 'espera' },
        { horarioId: 'sesion-1', status: 'cancelado', capacityStatus: 'confirmada' },
        { horarioId: 'sesion-1', status: 'no_asistio', capacityStatus: 'confirmada' },
        { horarioId: 'otra', class: 'Yoga', fecha: horario.fecha, time: horario.horaInicio },
        { class: 'Yoga', fecha: horario.fecha, time: horario.horaInicio, status: 'pendiente' },
    ];
    const historial = reservasDeHorario(reservas, horario);
    assert.equal(historial.length, 6);
    assert.equal(ocupacionReal(historial), 3);
});