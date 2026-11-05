export interface MembresiaComprada {
  id: number | string;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
}

export function MembresiasCliente({ compras = [] }: { compras?: MembresiaComprada[] }) {
  const ahora = new Date();
  const hoy = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;

  if (!compras.length) return <span className="text-gray-500">Sin membresías compradas</span>;

  return (
    <ul className="space-y-3">
      {compras.map(compra => {
        const estado = compra.fechaInicio > hoy ? 'Próxima a iniciar' : compra.fechaFin < hoy ? 'Vencida' : 'Vigente';
        const colores = estado === 'Vigente' ? 'bg-emerald-50 text-emerald-700' : estado === 'Vencida' ? 'bg-gray-100 text-gray-600' : 'bg-amber-50 text-amber-700';
        return (
          <li key={compra.id}>
            <p className="font-medium text-gray-800">{compra.nombre}</p>
            <p className="text-xs text-gray-500">{compra.fechaInicio} al {compra.fechaFin}</p>
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colores}`}>{estado}</span>
          </li>
        );
      })}
    </ul>
  );
}