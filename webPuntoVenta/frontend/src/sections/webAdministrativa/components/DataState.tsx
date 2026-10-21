interface DataStateProps {
    loading?: boolean;
    error?: string | null;
    empty?: boolean;
    emptyMessage?: string;
    onRetry?: () => void;
    children?: React.ReactNode;
}

export function DataState({ loading, error, empty, emptyMessage = 'Sin datos registrados', onRetry, children }: DataStateProps) {
    if (loading) {
        return (
            <div className="flex items-center justify-center py-16 text-slate-400">
                <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                <span className="text-sm">Cargando...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-sm text-red-500 mb-3">{error}</p>
                {onRetry && (
                    <button onClick={onRetry} className="text-xs font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors">
                        Reintentar
                    </button>
                )}
            </div>
        );
    }

    if (empty) {
        return <p className="text-slate-400 text-center py-16">{emptyMessage}</p>;
    }

    return <>{children}</>;
}