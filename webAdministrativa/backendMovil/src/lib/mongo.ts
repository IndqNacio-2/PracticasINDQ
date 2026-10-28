import mongoose from 'mongoose';

export async function connectDB(): Promise<void> {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error('Falta MONGO_URI en el archivo .env');
    await mongoose.connect(uri);
    console.log('MongoDB conectado');
}
