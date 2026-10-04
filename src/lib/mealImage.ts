/** Drawing only pixels into a fresh canvas strips EXIF/GPS before upload. */
export async function prepareMealImage(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Use uma foto JPEG, PNG ou WebP.');
  if (file.size > 20 * 1024 * 1024) throw new Error('Escolha uma foto de até 20 MB.');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = url; await img.decode();
    if (!img.width || !img.height) throw new Error('Foto inválida.');
    const scale = Math.min(1, 1024 / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Não foi possível preparar a foto.');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const result = canvas.toDataURL('image/jpeg', 0.8);
    if (result.length > 1400000) throw new Error('A foto ficou muito grande. Escolha uma imagem menor.');
    return result;
  } catch (err) {
    throw new Error(err instanceof Error && /foto|grande|MB/i.test(err.message) ? err.message : 'Não foi possível abrir a foto. Use JPEG, PNG ou WebP.');
  } finally { URL.revokeObjectURL(url); }
}
