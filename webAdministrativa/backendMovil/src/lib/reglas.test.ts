// Ejecutar con: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { fechaLocal, instante, sumarDias, diaSemana } from './fecha';
import {
    estadoReserva, iniciales, nivelCupo, paqueteCubre, puedeCancelar, puedeReagendar,
    resumenMembresia, separarHoras, precioClase,
} from './reglas';

const mazatlan = process.env.APP_TZ === undefined || process.env.APP_TZ === 'America/Mazatlan';

test('fechas en la zona del negocio', { skip: !mazatlan }, () => {
    // 03:00 UTC del 29 = 20:00 del 28 en Mazatlán (UTC-7)
    assert.equal(fechaLocal(new Date('2026-10-29T03:00:00Z')), '2026-10-28');
    assert.equal(instante('2026-10-28', '06:00').toISOString(), '2026-10-28T13:00:00.000Z');
    assert.equal(instante('2026-10-28', '19:30').toISOString(), '2026-10-29T02:30:00.000Z');
});

test('fechas con horario de verano (Nueva York)', { skip: process.env.APP_TZ !== 'America/New_York' }, () => {
    assert.equal(instante('2026-07-01', '12:00').toISOString(), '2026-07-01T16:00:00.000Z'); // UTC-4
    assert.equal(instante('2026-12-01', '12:00').toISOString(), '2026-12-01T17:00:00.000Z'); // UTC-5
});

test('sumarDias y diaSemana', () => {
    assert.equal(sumarDias('2026-10-30', 3), '2026-11-02');
    assert.equal(sumarDias('2026-03-01', -1), '2026-02-28');
    assert.equal(diaSemana('2026-10-28'), 3); // miércoles
});

const reserva = { estatus: 'confirmada', fechaClase: '2026-10-30', horaClase: '06:00 - 06:50', asistenciaConfirmada: false };

test('estado de la reservación', { skip: !mazatlan }, () => {
    const antes = new Date('2026-10-29T00:00:00Z');
    const despues = new Date('2026-10-30T14:00:00Z'); // 07:00 locales, ya terminó
    assert.equal(estadoReserva(reserva, antes), 'proxima');
    assert.equal(estadoReserva(reserva, despues), 'no_asistio');
    assert.equal(estadoReserva({ ...reserva, asistenciaConfirmada: true }, despues), 'asistio');
    assert.equal(estadoReserva({ ...reserva, estatus: 'cancelada' }, antes), 'cancelada');
    // en curso (06:30 locales) sigue como próxima
    assert.equal(estadoReserva(reserva, new Date('2026-10-30T13:30:00Z')), 'proxima');
});

test('cancelar solo con 24 h o más', { skip: !mazatlan }, () => {
    // la clase empieza el 30 a las 06:00 locales = 13:00Z
    assert.equal(puedeCancelar(reserva, new Date('2026-10-29T13:00:00Z')), true); // justo 24 h
    assert.equal(puedeCancelar(reserva, new Date('2026-10-29T13:01:00Z')), false); // faltan 23 h 59 min
    assert.equal(puedeCancelar({ ...reserva, estatus: 'cancelada' }, new Date('2026-10-20T00:00:00Z')), false);
});

test('reagendar una sola vez', { skip: !mazatlan }, () => {
    const ahora = new Date('2026-10-30T10:00:00Z');
    assert.equal(puedeReagendar(reserva, ahora), true);
    assert.equal(puedeReagendar({ ...reserva, reagendada: true }, ahora), false);
    assert.equal(puedeReagendar(reserva, new Date('2026-10-30T13:30:00Z')), false); // ya empezó
});

test('membresía y paquete (7 de 12 = 58 %)', () => {
    const m = { tipo: 'mensual', estatus: 'activo', fechaFin: '2026-11-04', claseIncluida: 'Pilates', clasesTotal: 12, clasesUsadas: 5 };
    const r = resumenMembresia(m, '2026-10-28')!;
    assert.equal(r.vigente, true);
    assert.equal(r.paquete?.nombre, 'Pilates · 12 clases');
    assert.equal(r.paquete?.restantes, 7);
    assert.equal(r.paquete?.porcentajeRestante, 58);

    assert.equal(paqueteCubre(m, 'pilates', '2026-10-28'), true);
    assert.equal(paqueteCubre(m, 'Yoga', '2026-10-28'), false);
    assert.equal(paqueteCubre(m, 'Pilates', '2026-11-05'), false); // vencido
    assert.equal(paqueteCubre({ ...m, clasesUsadas: 12 }, 'Pilates', '2026-10-28'), false); // sin accesos
    assert.equal(paqueteCubre({ ...m, estatus: 'inactivo' }, 'Pilates', '2026-10-28'), false);
    assert.equal(paqueteCubre(null, 'Pilates', '2026-10-28'), false);
    assert.equal(resumenMembresia({ tipo: 'mensual', estatus: 'activo', fechaFin: '2026-11-04' }, '2026-10-28')?.paquete, null);
});

test('utilidades', () => {
    assert.equal(nivelCupo(0), 'agotado');
    assert.equal(nivelCupo(2), 'critico');
    assert.equal(nivelCupo(5), 'bajo');
    assert.equal(nivelCupo(6), 'normal');
    assert.equal(iniciales('Andrea Solís'), 'AS');
    assert.deepEqual(separarHoras('06:00 - 06:50'), { inicio: '06:00', fin: '06:50' });
    assert.equal(precioClase(undefined, 180), 180);
    assert.equal(precioClase(250, 180), 250);
});
