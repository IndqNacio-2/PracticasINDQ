import mongoose from 'mongoose';

// Bitacora de consultas: imprime cada operacion que Mongoose envia a MongoDB
// (find, insertOne, updateOne, ...) con la hora exacta, para que la terminal
// del backend muestre lo que hace la base de datos.
mongoose.set('debug', (coleccion: string, metodo: string, ...args: unknown[]) => {
    const hora = new Date().toLocaleTimeString('es-MX');
    const filtro = args.length ? ` ${JSON.stringify(args[0]).slice(0, 140)}` : '';
    console.log(`[MONGO ${hora}] ${coleccion}.${metodo}${filtro}`);
});

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