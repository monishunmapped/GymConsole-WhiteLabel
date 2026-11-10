const pageCss = '@page{size:A4 portrait;margin:10mm}html,body{margin:0;background:#fff}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}';

export function printElement(el: HTMLElement, title = document.title) {
  const clone = el.cloneNode(true) as HTMLElement;
  clone.classList.remove('hidden');
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(iframe);
  const win = iframe.contentWindow!;
  const doc = win.document;
  const styles = [...document.querySelectorAll('style, link[rel="stylesheet"]')].map(n => n.outerHTML).join('');
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><base href="${document.baseURI}">${styles}<style>${pageCss}</style></head><body></body></html>`);
  doc.close();
  doc.body.appendChild(doc.importNode(clone, true));
  const ready = Promise.all([
    doc.fonts?.ready,
    ...[...doc.images].map(img => (img.complete ? null : new Promise(r => (img.onload = img.onerror = r)))),
    ...[...doc.querySelectorAll('link[rel="stylesheet"]')].map(l => new Promise(r => { (l as HTMLLinkElement).onload = (l as HTMLLinkElement).onerror = r; setTimeout(r, 1500); })),
  ]);
  ready.then(() => {
    win.onafterprint = () => iframe.remove();
    win.focus();
    win.print();
    setTimeout(() => iframe.isConnected && iframe.remove(), 60_000);
  });
}

export async function elementToPdf(el: HTMLElement) {
  const [{ toCanvas }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')]);
  const root = document.documentElement;
  const dark = root.classList.contains('dark');
  root.classList.remove('dark');
  try {
    const canvas = await toCanvas(el, { pixelRatio: 2, backgroundColor: '#ffffff', skipFonts: true });
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const width = 190;
    const pageHeight = 277;
    const height = (canvas.height * width) / canvas.width;
    const image = canvas.toDataURL('image/jpeg', 0.92);
    for (let y = 0; y < height; y += pageHeight) {
      if (y) pdf.addPage();
      pdf.addImage(image, 'JPEG', 10, 10 - y, width, height);
    }
    return pdf;
  } finally {
    if (dark) root.classList.add('dark');
  }
}

export async function downloadPdf(el: HTMLElement, fileName: string) {
  (await elementToPdf(el)).save(fileName);
}

export async function viewPdf(el: HTMLElement) {
  const tab = window.open('', '_blank');
  const url = (await elementToPdf(el)).output('bloburl').toString();
  if (tab) tab.location.href = url;
  else window.location.href = url;
}

export async function pdfBase64(el: HTMLElement) {
  return (await elementToPdf(el)).output('datauristring').split(',')[1];
}
