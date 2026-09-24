const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());//permite que react en el puerto 5173 hable con el puerto 3001
app.use(express.json());

//Mock de datos para prueba /////////////////////////////////////
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

let asistencias = []; //registros del reloj checador


//Modulo para recepcion y cobro

//GET para las reservas
app.get('/api/reservas', (req, res) => res.json(reservas));


//GET para clientes para llenar tabla del dashboard
app.get('/api/clientes',(req,res)=>{
 res.json(clientes);
});

//GET para el dropdown del modal de reservas
app.get('/api/clases',(req,res)=>{
res.json(clases);
});

//Post para la api de cobros
app.post('/api/cobros',(req,res)=>{
    const {clienteId,monto} = req.body;
    
    //validacion 1 para saber si existe el cliente
    const cliente = clientes.find(c => c.id === clienteId);
    if (!cliente) return res.status(404).json({error:'Cliente no encontrado'});

    //validacion 2 no cobrar el doble hoy
    const yaCobrado = pagos.find(p => p.clienteId === clienteId && p.fecha === new Date().toDateString());
    if (yaCobrado) return res.status(400).json({error:`${cliente.nombre} ya fue cobrado hoy`});

    const nuevoPago = {
        id: Date.now(),
        clienteId,
        clienteNombre: cliente.nombre,
        monto,
        fecha: new Date().toDateString(),
    };
    pagos.push(nuevoPago);

    res.status(201).json({mensaje: 'Pago registrado', pago: nuevoPago});
});

 //GET para tarjertas superiores del dashboard
 app.get('/api/kpis', (req,res) =>{
    const clientesEsperados = reservas.filter(r => r.status === 'pendiente').length;
    const ingresosHoy = pagos
    .filter(p => p.fecha === new Date().toDateString())
    .reduce((sum, p) => sum + p.monto, 0);

    res.json({
        clientesEsperados,
        ingresosHoy,
        totalReservas: reservas.length,
    });
 });

   //MODULO PARA ASISTENCIA
   app.post('/api/asistencia/marcar',(req,res)=>{
    const codigo = (req.body.codigo || '').trim().toUpperCase();

    //validacion 1 formato EPP-XXX
    if(!/^EMP-\d{3}$/.test(codigo)){
        return res.status(400).json({error:'Formato inválido. Ejemplo: 1'});
    }

    //Validacon 2 : corroboramos existencia del empleado
    const empleado = empleados.find(e => e.codigo === codigo);
    if(!empleado) return res.status(404).json({ error:`Código ${codigo} no registrado` });

    //validacion 3 : antispam (60 seg)
    const ultimo = [...asistencias].reverse().find(a => a.codigo === codigo);
    if (ultimo && (Date.now() - ultimo.ts) < 60000) {
        return res.status(429).json({error:'Espera 1 minuto entre marcas'});
    }

   //logica pora entrada y salida
   const tipo = (!ultimo || ultimo.tipo ==='salida') ? 'entrada' : 'salida';
   const registro = {
    _id: Date.now(),
    codigo,
    nombre:empleado.nombre,
    tipo,
    fecha: new Date().toISOString(),
    ts: Date.now(),
   };
   asistencias.push(registro);
   
   res.json(registro);
   });

   //Iniciar Servidor
   const PORT = 3001;
   app.listen(PORT,()=>{
    console.log(`Backend corriendo en http://localhost:${PORT}`)
   })