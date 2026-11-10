import qrcode from 'qrcode-generator';

export function generateQrSvg(text: string, size = 256): string {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ scalable: true, margin: 2 }).replace('<svg ', `<svg width="${size}" height="${size}" style="max-width:100%;height:auto;display:block;background:#fff" `);
}
