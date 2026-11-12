export interface MembresiaComprada {
  id: number | string;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
}

export function MembresiasCliente({ compras = [] }: { compras?: MembresiaComprada[] }) {
  const ahora = new Date();
  const hoy = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;

  if (!compras.length) return <span className="rx-help-text">Sin membresías compradas</span>;

  return (
    <ul className="space-y-3">
      {compras.map(compra => {
        const estado = compra.fechaInicio > hoy ? 'Próxima a iniciar' : compra.fechaFin < hoy ? 'Vencida' : 'Vigente';
        const colores = estado === 'Vigente' ? 'rx-badge--success' : estado === 'Vencida' ? 'rx-badge--neutral' : 'rx-badge--warning';
        return (
          <li key={compra.id}>
            <p className="rx-membership-name">{compra.nombre}</p>
            <p className="rx-membership-dates">{compra.fechaInicio} al {compra.fechaFin}</p>
            <span className={`rx-badge ${colores}`}>{estado}</span>
          </li>
        );
      })}
    </ul>
  );
}