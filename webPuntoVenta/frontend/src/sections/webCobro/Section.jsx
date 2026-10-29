// Sección webCobro (trabajo de un compañero del equipo).
//
// Su diseño original era oscuro (slate). Su hoja de estilos pintaba el fondo
// desde el body, pero eso afectaría a toda la aplicación, así que aquí el
// fondo de la paleta del módulo (#4B5563) se aplica solo a su contenedor.
//
// Se monta completa y aparte: tiene su propio login, su propio menú y su
// propio estado. Todavía no comparte nada con la aplicación de Punto de
// Venta ni con las demás secciones (sin enlaces ni llamadas entre ellas).
import CobroApp from "./App.jsx";

export default function WebCobroSection() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#4B5563" }}>
      <CobroApp />
    </div>
  );
}
