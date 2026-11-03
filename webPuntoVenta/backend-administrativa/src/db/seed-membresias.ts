import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../lib/mongo';
import { sembrarMembresias } from '../lib/membresia.lib';

try {
  await connectDB();
  console.log(`Membresías creadas: ${await sembrarMembresias()}. Los registros existentes se conservaron.`);
} catch (error) {
  console.error('No se pudo cargar el catálogo de membresías:', error);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}