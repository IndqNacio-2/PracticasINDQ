// Adaptación de la reducción de fotos de Alexis al formulario existente.
export async function reducirFoto(archivo: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(archivo.type)) {
    throw new Error('Elige una imagen JPG, PNG o WEBP.');
  }
  if (archivo.size > 10 * 1024 * 1024) throw new Error('La imagen no debe superar 10 MB.');
  const url = URL.createObjectURL(archivo);
  try {
    const imagen = new Image();
    await new Promise<void>((resolve, reject) => {
      imagen.onload = () => resolve();
      imagen.onerror = () => reject(new Error('No se pudo leer la imagen.'));
      imagen.src = url;
    });
    if (!imagen.naturalWidth || !imagen.naturalHeight) throw new Error('La imagen está vacía.');
    const escala = Math.min(1, 320 / Math.max(imagen.naturalWidth, imagen.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(imagen.naturalWidth * escala));
    canvas.height = Math.max(1, Math.round(imagen.naturalHeight * escala));
    const contexto = canvas.getContext('2d');
    if (!contexto) throw new Error('No se pudo procesar la imagen en este navegador.');
    contexto.fillStyle = '#ffffff';
    contexto.fillRect(0, 0, canvas.width, canvas.height);
    contexto.drawImage(imagen, 0, 0, canvas.width, canvas.height);
    const foto = canvas.toDataURL('image/jpeg', 0.85);
    if (!foto.startsWith('data:image/jpeg;base64,') || foto.length > 200_000) {
      throw new Error('La foto sigue siendo demasiado grande. Elige otra imagen.');
    }
    return foto;
  } finally {
    URL.revokeObjectURL(url);
  }
}