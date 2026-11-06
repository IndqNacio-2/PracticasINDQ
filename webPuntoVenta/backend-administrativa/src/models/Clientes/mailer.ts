import nodemailer, { type Transporter } from 'nodemailer';

// Envío de correos por SMTP. Todo sale del .env, así que cambiar de cuenta
// es editar SMTP_USER / SMTP_PASS / MAIL_FROM y reiniciar el backend.
let transporte: Transporter | null = null;

export function correoConfigurado(): boolean {
    return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function obtenerTransporte(): Transporter {
    if (!transporte) {
        const puerto = Number(process.env.SMTP_PORT ?? 587);
        transporte = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: puerto,
            secure: puerto === 465, // 465 = TLS directo; 587 = STARTTLS
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        });
    }
    return transporte;
}

export async function enviarCorreo(opciones: { to: string; subject: string; text: string; html: string }): Promise<void> {
    if (!correoConfigurado()) {
        throw new Error('Falta configurar SMTP_HOST, SMTP_USER y SMTP_PASS en el .env');
    }
    await obtenerTransporte().sendMail({
        from: process.env.MAIL_FROM || process.env.SMTP_USER,
        ...opciones,
    });
}