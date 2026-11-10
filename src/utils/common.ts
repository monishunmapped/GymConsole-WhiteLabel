import { Member } from '../types';

export const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();

export function memberCodes(m: Member): string[] {
  const codes = [m.id, m.id.slice(0, 4)];
  if (m.id.length === 8) codes.push(m.id.slice(0, 4) + m.id.slice(6));
  const [y, mo, d] = (m.dob || '').split('-');
  if (y && mo && d) codes.push(d + mo, d + mo + y.slice(-2), d + mo + y);
  return codes.map(c => c.toUpperCase());
}

export function findMemberByCode(members: Member[], code: string): { member?: Member; ambiguous: boolean } {
  const c = code.trim().toUpperCase();
  const exact = members.find(m => m.id.toUpperCase() === c);
  if (exact) return { member: exact, ambiguous: false };
  const hits = members.filter(m => memberCodes(m).includes(c));
  return { member: hits.length === 1 ? hits[0] : undefined, ambiguous: hits.length > 1 };
}

export function normalizePhone(phone: string, countryCode = '91') {
  const n = phone.replace(/\D/g, '').replace(/^0+/, '');
  return n.length === 10 ? countryCode + n : n;
}

export const whatsappUrl = (phone: string, text: string, countryCode = '91') =>
  `https://wa.me/${normalizePhone(phone, countryCode)}?text=${encodeURIComponent(text)}`;

let audioCtx: AudioContext | undefined;

export function playBeep(success: boolean) {
  try {
    audioCtx ??= new AudioContext();
    audioCtx.resume();
    const ctx = audioCtx;
    const tone = (freq: number, start: number, end: number, type: OscillatorType, vol: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = ctx.currentTime;
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t + start);
      gain.gain.setValueAtTime(vol, t + start);
      gain.gain.exponentialRampToValueAtTime(0.001, t + end);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t + start);
      osc.stop(t + end);
    };
    if (success) {
      tone(659.25, 0, 0.15, 'sine', 0.08);
      tone(880, 0.08, 0.3, 'sine', 0.08);
    } else {
      tone(140, 0, 0.35, 'sawtooth', 0.12);
    }
  } catch {}
}

export function downloadCsv(fileName: string, rows: unknown[][]) {
  const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`).join(',')).join('\r\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }));
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export function fileToDataUrl(file: File, max = 400): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export function parseDobCode(raw: string): { id: string; dob?: string } | null {
  const s = raw.trim();
  if (!/^(\d{4}|\d{6}|\d{8})$/.test(s)) return null;
  const dd = s.slice(0, 2);
  const mm = s.slice(2, 4);
  if (+dd < 1 || +dd > 31 || +mm < 1 || +mm > 12) return null;
  if (s.length === 4) return { id: s };
  const yyyy = s.length === 8 ? s.slice(4) : String((+s.slice(4) > 30 ? 1900 : 2000) + +s.slice(4));
  return { id: dd + mm + yyyy, dob: `${yyyy}-${mm}-${dd}` };
}
