import MaterialIcon from "./MaterialIcon";
/**
 * Propiedades de una pantalla temporal.
 */
interface ModulePlaceholderProps {
    title: string;
    description: string;
    icon: string;
}  

/**
 * Esta pantalla permite validar la navegación antes de
 * desarrollar cada módulo completo.
 */

export default function ModulePlaceholder({
    title,
    description,
    icon,
}: ModulePlaceholderProps) {
    return (
        <section className="flex h-full flex-1 items-center justify-center bg-[#F0F2F7] p-8">
            <div className="w-full max-w-lg rounded-2xl border border-[#E5E7EB] bg-white p-10 text-center shadow-sm">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FFF5F0] text-[#FF5C00]">
                    <MaterialIcon name={icon} className="text-4xl" filled />
                </div>

                <h2 className="mb-2 text-2xl font-bold text-[#0D0F14]">
                    {title}
                </h2>

                <p className="text-sm leading-6 text-[#6B7280]">
                    {description}
                </p>
            </div>
        </section>
    );
}