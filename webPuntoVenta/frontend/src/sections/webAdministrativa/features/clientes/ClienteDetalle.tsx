import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Badge } from '../../components/Badge';
import { mockClientes, mockReservaciones } from '../../data/mock';

type Tab = 'general' | 'salud' | 'membresia' | 'historial';

const tabs: { value: Tab; label: string }[] = [
  { value: 'general', label: 'Datos Generales' },
  { value: 'salud', label: 'Perfil de Salud' },
  { value: 'membresia', label: 'Membresía' },
  { value: 'historial', label: 'Historial' },
];

const membresiaColors: Record<string, string> = {
  mensual: 'bg-[#F3F4F6] text-[#6B7280]',
  trimestral: 'bg-[#F3F4F6] text-[#6B7280]',
  semestral: 'bg-[#F3F4F6] text-[#6B7280]',
  anual: 'bg-[#F3F4F6] text-emerald-700',
};

// Fecha de hoy "AAAA-MM-DD" en la hora local del navegador.
function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Edad exacta: compara mes y día para que el cumpleaños cuente el día correcto.
function calcularEdad(iso: string, hoy = hoyISO()): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const [hy, hm, hd] = hoy.split('-').map(Number);
  let edad = hy - y;
  if (hm < m || (hm === m && hd < d)) edad--;
  return edad;
}

function InfoRow({ label, value }: { label: string; value?: string | number }) {
  return (
    <div className="flex justify-between py-3 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-800 text-right max-w-xs">{value ?? '—'}</span>
    </div>
  );
}

export function ClienteDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('general');

  const cliente = mockClientes.find(c => c.idUsuario === id);
  if (!cliente) return (
    <div className="text-center py-20 text-gray-400">
      <p className="text-lg">Cliente no encontrado</p>
      <button onClick={() => navigate('/clientes')} className="rx-btn rx-btn--outline mt-4">← Volver a clientes</button>
    </div>
  );

  const reservas = mockReservaciones.filter(r => r.idCliente === id);

  const saludListas = [
    { titulo: 'Enfermedades', items: cliente.perfilSalud?.enfermedades ?? [] },
    { titulo: 'Lesiones', items: cliente.perfilSalud?.lesiones ?? [] },
  ];

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/clientes')} className="rx-icon-btn">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'DM Sans, sans-serif' }}>
            {cliente.nombre} {cliente.apellidos}
          </h1>
          <p className="text-gray-500 text-sm">Expediente de cliente · {cliente.codigoAcceso}</p>
        </div>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <div className="flex items-start gap-5">
          {cliente.avatar
            ? <img src={cliente.avatar} alt="" className="w-16 h-16 rounded-2xl object-cover bg-gray-100 flex-shrink-0" />
            : <div className="w-16 h-16 rounded-2xl bg-[#F3F4F6] flex items-center justify-center text-emerald-700 text-xl font-bold flex-shrink-0">{cliente.nombre[0]}{cliente.apellidos[0]}</div>
          }
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-lg font-semibold text-gray-900" style={{ fontFamily: 'DM Sans, sans-serif' }}>{cliente.nombre} {cliente.apellidos}</h2>
              <Badge variant={cliente.estatus} />
              {cliente.membresia && <Badge variant={cliente.membresia.estatus} label={`Membresía ${cliente.membresia.tipo}`} />}
            </div>
            <p className="text-gray-500 text-sm mt-1">{cliente.correo} · {cliente.telefono}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs text-gray-400">Registrado</p>
            <p className="text-sm font-medium text-gray-700">{cliente.fechaRegistro}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab.value} onClick={() => setActiveTab(tab.value)}
              className={`rx-tab ${activeTab === tab.value ? 'rx-tab--active' : ''}`}>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'general' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="font-semibold text-gray-900 mb-3" style={{ fontFamily: 'DM Sans, sans-serif' }}>Información Personal</h3>
                <InfoRow label="Nombre" value={cliente.nombre} />
                <InfoRow label="Apellidos" value={cliente.apellidos} />
                <InfoRow label="Fecha de nacimiento" value={cliente.fechaNacimiento} />
                <InfoRow label="Edad" value={`${calcularEdad(cliente.fechaNacimiento)} años`} />
                <InfoRow label="Correo electrónico" value={cliente.correo} />
                <InfoRow label="Celular" value={cliente.telefono} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-3" style={{ fontFamily: 'DM Sans, sans-serif' }}>Datos del Sistema</h3>
                <InfoRow label="ID Cliente" value={cliente.idUsuario} />
                <InfoRow label="Código de acceso" value={cliente.codigoAcceso} />
                <InfoRow label="Fecha de registro" value={cliente.fechaRegistro} />
                <InfoRow label="Estatus del registro" value={cliente.estatus} />
              </div>
            </div>
          )}

          {activeTab === 'salud' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {saludListas.map(({ titulo, items }) => (
                <div key={titulo}>
                  <h3 className="font-semibold text-gray-900 mb-3" style={{ fontFamily: 'DM Sans, sans-serif' }}>{titulo}</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {items.length > 0
                      ? items.map(i => <span key={i} className="px-2 py-0.5 bg-[#F3F4F6] text-[#6B7280] text-xs rounded-lg">{i}</span>)
                      : <span className="text-sm text-gray-400">Ninguna registrada</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'membresia' && (
            <div>
              {cliente.membresia ? (
                <div className="space-y-4">
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${membresiaColors[cliente.membresia.tipo]}`}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>
                    Membresía {cliente.membresia.tipo}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: 'Fecha inicio', value: cliente.membresia.fechaInicio },
                      { label: 'Fecha fin', value: cliente.membresia.fechaFin },
                      { label: 'Precio', value: `$${cliente.membresia.precio.toLocaleString()}` },
                      { label: 'Estatus', value: cliente.membresia.estatus },
                    ].map(item => (
                      <div key={item.label} className="bg-gray-50 rounded-xl p-4">
                        <p className="text-xs text-gray-500 mb-1">{item.label}</p>
                        <p className="font-semibold text-gray-800 capitalize">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <p className="text-gray-400 text-center py-8">Sin membresía activa</p>}
            </div>
          )}

          {activeTab === 'historial' && (
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900" style={{ fontFamily: 'DM Sans, sans-serif' }}>Historial de Reservaciones</h3>
              {reservas.length === 0 ? (
                <p className="text-gray-400 text-center py-8">Sin reservaciones registradas</p>
              ) : reservas.map(r => (
                <div key={r.idReservacion} className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl">
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{r.clase}</p>
                    <p className="text-xs text-gray-400">{r.entrenador} · {r.horaClase} · {r.fechaReservacion}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={r.estatus} />
                    {r.asistenciaConfirmada && (
                      <span className="flex items-center gap-1 text-xs text-emerald-600">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        Asistió
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}