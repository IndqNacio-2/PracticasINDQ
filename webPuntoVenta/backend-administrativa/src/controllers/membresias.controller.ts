import type { Request, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import { Membresia } from '../models/Membresia/membresia.model';
import { claveNombre, validarMembresia } from '../lib/membresia.lib';
import { Clase } from '../models/Clases/clases';

async function clasesValidas(ids?: string[]) {
  return !ids || await Clase.countDocuments({ _id: { $in: ids } }) === ids.length;
}

async function nombreRepetido(nombre: string, excluirId?: string) {
  return !!(await Membresia.exists({
    nombreClave: claveNombre(nombre),
    ...(excluirId ? { _id: { $ne: excluirId } } : {}),
  }));
}

function responderError(error: unknown, res: Response) {
  if ((error as { code?: number })?.code === 11000) {
    return res.status(409).json({ message: 'Ya existe una membresía con ese nombre.' });
  }
  console.error('Error en membresías:', error);
  return res.status(500).json({ message: 'No se pudo completar la operación de membresías.' });
}

export async function listarMembresias(req: Request, res: Response) {
  try {
    const filtro: Record<string, unknown> = {};
    if (req.query.estatus === 'activo' || req.query.estatus === 'inactivo') filtro.estatus = req.query.estatus;
    res.json(await Membresia.find(filtro).sort({ fechaCreacion: 1, nombre: 1 }));
  } catch (error) { responderError(error, res); }
}

export async function consultarMembresia(req: Request, res: Response) {
  const id = String(req.params.id);
  if (!isValidObjectId(id)) return res.status(400).json({ message: 'Identificador inválido.' });
  try {
    const membresia = await Membresia.findById(id);
    if (!membresia) return res.status(404).json({ message: 'Membresía no encontrada.' });
    res.json(membresia);
  } catch (error) { responderError(error, res); }
}

export async function crearMembresia(req: Request, res: Response) {
  if (!Array.isArray(req.body?.clasesIds)) return res.status(400).json({ message: 'Selecciona las clases del catálogo para crear una membresía.' });
  const resultado = validarMembresia(req.body);
  if (!resultado.ok) return res.status(400).json({ message: resultado.error });
  try {
    if (!await clasesValidas(resultado.valor.clasesIds)) return res.status(400).json({ message: 'Una de las clases seleccionadas ya no existe.' });
    if (await nombreRepetido(resultado.valor.nombre)) {
      return res.status(409).json({ message: 'Ya existe una membresía con ese nombre.' });
    }
    const membresia = await Membresia.create({ ...resultado.valor, nombreClave: claveNombre(resultado.valor.nombre) });
    res.status(201).json(membresia);
  } catch (error) { responderError(error, res); }
}

export async function actualizarMembresia(req: Request, res: Response) {
  const id = String(req.params.id);
  if (!isValidObjectId(id)) return res.status(400).json({ message: 'Identificador inválido.' });
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ message: 'Datos inválidos.' });
  }
  try {
    const actual = await Membresia.findById(id);
    if (!actual) return res.status(404).json({ message: 'Membresía no encontrada.' });
    const resultado = validarMembresia({ ...actual.toJSON(), ...req.body });
    if (!resultado.ok) return res.status(400).json({ message: resultado.error });
    if (actual.toJSON().clasesIds && !resultado.valor.clasesIds) return res.status(400).json({ message: 'No se pueden quitar los vínculos con las clases.' });
    if (!await clasesValidas(resultado.valor.clasesIds)) return res.status(400).json({ message: 'Una de las clases seleccionadas ya no existe.' });
    if (await nombreRepetido(resultado.valor.nombre, id)) {
      return res.status(409).json({ message: 'Ya existe una membresía con ese nombre.' });
    }
    // La baja es lógica y no modifica contratos ni reservaciones existentes.
    actual.set({ ...resultado.valor, nombreClave: claveNombre(resultado.valor.nombre) });
    await actual.save();
    res.json(actual);
  } catch (error) { responderError(error, res); }
}