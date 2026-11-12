import { useState } from 'react';

export function UsuarioAvatar({ foto, nombre, apellidos, className = '' }: {
  foto?: string; nombre?: string; apellidos?: string; className?: string;
}) {
  const [fallida, setFallida] = useState<string | null>(null);
  return (
    <div className={`overflow-hidden flex items-center justify-center shrink-0 ${className}`}>
      {foto && foto !== fallida
        ? <img src={foto} alt={`Foto de ${nombre || 'usuario'}`} className="w-full h-full object-cover" onError={() => setFallida(foto)} />
        : <span>{nombre?.[0]}{apellidos?.[0]}{!nombre && !apellidos ? '?' : ''}</span>}
    </div>
  );
}