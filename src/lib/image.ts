/**
 * Recorta a imagem em um quadrado (centro) e reduz para `size` x `size` em JPEG.
 * Assim a foto de perfil fica pequena (poucos KB) qualquer que seja o tamanho da original.
 */
export async function resizeSquareJpeg(file: File, size = 256, quality = 0.9): Promise<Blob> {
  // "from-image" respeita a orientação EXIF (fotos de celular tiradas em pé não ficam deitadas)
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - side) / 2;
    const sy = (bitmap.height - side) / 2;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Não foi possível processar a imagem neste navegador.');
    // JPEG não tem transparência: fundo branco para PNGs transparentes
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao gerar a imagem.'))), 'image/jpeg', quality),
    );
  } finally {
    bitmap.close();
  }
}
