/** 在浏览器里把照片缩小、重新编码成 JPEG（顺带去掉拍摄位置等信息）。 */
export async function shrink(file: Blob, maxSide: number, quality = 0.88): Promise<Blob> {
  const src = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = src;
    await img.decode();
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/jpeg', quality));
  } finally {
    URL.revokeObjectURL(src);
  }
}
