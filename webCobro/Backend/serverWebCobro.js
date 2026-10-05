const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();

app.use(cors());//permite que react en el puerto 5173 hable con el puerto 3001
app.use(express.json());

const BACKEND_ADMIN_URL = process.env.BACKEND_ADMIN_URL || 'http://localhost:4000';

const pool = new Pool({
  connectionString: process.env.PG_URL
});

//conexion con postgres
pool.connect()
.then(()=> console.log('PostgreSQL conectado'))
.catch(err => console.error('Error al conectar a PostgreSQL', err));

//conexion con mongo
mongoose.connect(process.env.MONGO_URL)
.then(()=> console.log('MongoDB conectado'))
.catch(err => console.error('Error al conectar a MongoDB', err));



//Mock de datos para prueba /////////////////////////////////////
/*
let clientes = [
     { id: 1, nombre: 'Juan Pérez', membresia: 'Premium', telefono: '555-0101' },
  { id: 2, nombre: 'María López', membresia: 'Básica', telefono: '555-0102' },
  { id: 3, nombre: 'Carlos Ruiz', membresia: 'Premium', telefono: '555-0103' },
];

let clases = [
 { id: 1, nombre: 'Spinning', precio: 150 },
  { id: 2, nombre: 'Yoga', precio: 120 },
  { id: 3, nombre: 'CrossFit', precio: 200 },
];

let reservas = [
  { id: 1, client: "Ana García", class: "Yoga Vinyasa", time: "10:00", status: "pendiente", price: 150 },
  { id: 2, client: "Carlos López", class: "CrossFit", time: "10:30", status: "pagado", price: 200 },
];

let pagos = []; //aqui se acumulan los pagos

let empleados = [
  { codigo: 'EMP-101', nombre: 'Ana Torres', rol: 'entrenador' },
  { codigo: 'EMP-102', nombre: 'Luis Gómez', rol: 'recepción' }, 
];
*/


//Modulo para recepcion y cobro



//GET para clientes para llenar tabla del dashboard
app.get('/api/clientes', async(req,res)=>{
  try{
    const respuesta = await fetch(`${BACKEND_ADMIN_URL}/api/clientes`);

    if (!respuesta.ok){
      throw new Error(`Error del servidor: ${respuesta.status}`);
    }

    const clientes = await respuesta.json();
    res.json(clientes);
  } catch (error){
    console.error('Proxy /api/clientes falló:', error.message);
    res.status(500).json({ error: 'Servicio de clientes no disponible'});
  }
    });


//GET para el dropdown del modal de reservas
app.get('/api/clases', async (req,res)=>{
    try{
      const respuesta = await fetch(`${BACKEND_ADMIN_URL}/api/clases`);
      if (!respuesta.ok){
        throw new Error(`Error del servidor: ${respuesta.status}`);
      }
      //convertimos a json la respuesta
      const clases = await respuesta.json();

      //Adaptamos las respuestas para nuestro front
      const ClasesAdaptadas = clases.map((c,i)=>({
        id : c._id ?? c.id ?? `temp-${i}`,//mongo usa _id
        nombre: c.nombre,
        cupo: c.cupo ?? c.capacidad,
        precio: c.precio ?? 150,
        entrenador: c.entrenador || null,
        horario: c.horario || null,
      }));
      res.json(ClasesAdaptadas);

    }
    catch(error){
      console.error('Proxy /api/clases falló:', error.message);
      res.status(503).json({error:'Servicio de clases no disponible'});
    }
});

//Post para la api de cobros
app.post('/api/cobros', async (req, res) => {
  const { clienteId, monto } = req.body;

  try {
    // 1. Validar cliente (llamamos al proxy o a BD si ya tienes clientes en Postgres)
    // Por ahora, usamos el proxy para validar existencia
    const clientesRes = await fetch(`${BACKEND_ADMIN_URL}/api/clientes`);
    const clientes = await clientesRes.json();
    const cliente = clientes.find(c => String(c.id) === String(clienteId)); // Comparación 

    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });

    // 2. Validar no cobrar doble (en Postgres)
    const yaCobrado = await pool.query(
      'SELECT * FROM cobros WHERE cliente_id = $1 AND fecha::date = CURRENT_DATE',
      [clienteId]
    );

    if (yaCobrado.rows.length > 0) {
      return res.status(400).json({ error: `${cliente.nombre} ya fue cobrado hoy` });
    }

    // 3. Guardar en Postgres
    const nuevoPago = await pool.query(
      `INSERT INTO cobros (cliente_id, cliente_nombre, monto, fecha) 
       VALUES ($1, $2, $3, NOW()) RETURNING id, fecha`,
      [clienteId, cliente.nombre, monto]
    );

    res.status(201).json({ mensaje: 'Pago registrado', pago: nuevoPago.rows[0] });

  } catch (error) {
    console.error('Error en cobro:', error);
    res.status(500).json({ error: 'Error procesando el pago' });
  }
});


 //GET para tarjertas superiores del dashboard
 app.get('/api/kpis', async (req, res) => {
  try {
    const ingresos = await pool.query('SELECT COALESCE(SUM(monto), 0) as total FROM cobros WHERE fecha::date = CURRENT_DATE');
    res.json({
      ingresosHoy: parseFloat(ingresos.rows[0].total),
      clientesEsperados: 0,
      totalReservas: 0
    });
  } catch (error) {
    res.status(500).json({ error: 'Error calculando KPIs' });
  }
});
    
   //MODULO PARA ASISTENCIA
  app.post('/api/asistencia/marcar', async (req, res) => {
   const codigo = (req.body.codigo || '').trim().toUpperCase();
    if (!/^EMP-\d{3}$/.test(codigo)) return res.status(400).json({ error: 'Formato inválido' });

    const empleado = { codigo, nombre: 'Empleado Demo' };

    try {
    const ultimo = await Asistencia.findOne({ codigo }).sort({ ts: -1 });
    if (ultimo && (Date.now() - ultimo.ts) < 60000) return res.status(429).json({ error: 'Espera 1 minuto' });

    const tipo = (!ultimo || ultimo.tipo === 'salida') ? 'entrada' : 'salida';
    const registro = new Asistencia({ codigo, nombre: empleado.nombre, tipo, fecha: new Date(), ts: Date.now() });
    await registro.save();
    res.json(registro);
    } catch (error) {
    res.status(500).json({ error: 'Error al registrar asistencia' });
    }
    });


   //Iniciar Servidor
   const PORT = 3001;
   app.listen(PORT,()=>{
    console.log(`Backend corriendo en http://localhost:${PORT}`)
   })