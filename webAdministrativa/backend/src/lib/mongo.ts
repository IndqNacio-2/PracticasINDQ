import mongoose from 'mongoose';

export async function connectDB(): Promise<void> {
    const uri = process.env.MONGO_URI;
    if (!uri) {
        throw new Error('Falta MONGO_URI en el archivo .env');
    }

    mongoose.connection.on('connected', () => {
        console.log('MongoDB conectado:', mongoose.connection.name);
    });

    mongoose.connection.on('error', (err) => {
        console.error('Error de conexión a MongoDB:', err);
    });

    await mongoose.connect(uri);
}