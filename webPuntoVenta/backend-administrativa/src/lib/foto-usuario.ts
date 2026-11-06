// Solo imágenes raster embebidas: no se aceptan SVG ni URLs externas.
export const MAX_FOTO_CHARS = 200_000;

export type ResultadoFoto =
  | { ok: true; valor: string | null }
  | { ok: false; error: string };

export function validarFoto(valor: unknown): ResultadoFoto {
  if (valor === '' || valor === null || valor === undefined) {
    return { ok: true, valor: null };
  }

  if (typeof valor !== 'string' || valor.length > MAX_FOTO_CHARS) {
    return {
      ok: false,
      error: 'La foto debe ser una imagen de máximo 200 KB codificados.',
    };
  }

  const partes = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(valor);

  if (!partes || partes[2].length % 4 !== 0) {
    return {
      ok: false,
      error: 'Elige una imagen JPG, PNG o WEBP válida.',
    };
  }

  const bytes = Buffer.from(partes[2], 'base64');

  if (bytes.toString('base64') !== partes[2]) {
    return {
      ok: false,
      error: 'La foto contiene datos inválidos.',
    };
  }

  const valida =
    partes[1] === 'jpeg'
      ? bytes.length > 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
      : partes[1] === 'png'
        ? bytes.subarray(0, 8).equals(
          Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        )
        : bytes.length > 12 &&
        bytes.toString('ascii', 0, 4) === 'RIFF' &&
        bytes.toString('ascii', 8, 12) === 'WEBP';

  if (!valida) {
    return {
      ok: false,
      error: 'El contenido de la foto no corresponde a una imagen válida.',
    };
  }

  return { ok: true, valor };
}