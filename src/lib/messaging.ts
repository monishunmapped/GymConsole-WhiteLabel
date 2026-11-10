import { FirebaseError } from 'firebase/app';
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import { brandDb } from './brand';
import { normalizePhone } from '../utils/common';
import { toast } from '../components/Toaster';

export interface Attachment {
  filename: string;
  content: string;
}

const GATEWAY_DOWN = ['functions/not-found', 'functions/failed-precondition', 'functions/unavailable', 'functions/internal'];

async function send(payload: Record<string, unknown>, label: string, deviceUrl: string, attachments: Attachment[] = []) {
  try {
    if (!functions) throw new FirebaseError('functions/failed-precondition', 'Messaging gateway not configured');
    await httpsCallable(functions, 'sendMessage')(payload);
    toast(`${label} sent`);
    return true;
  } catch (err) {
    if (!(err instanceof FirebaseError && GATEWAY_DOWN.includes(err.code))) {
      toast(`${label} failed: ${err instanceof Error ? err.message : err}`, 'error');
      return false;
    }
    attachments.forEach(a => {
      const link = document.createElement('a');
      link.href = `data:application/pdf;base64,${a.content}`;
      link.download = a.filename;
      link.click();
    });
    window.location.href = deviceUrl;
    toast(`Gateway not configured — opened ${label} on this device${attachments.length ? '. Attach the downloaded PDF.' : ''}`, 'info');
    return true;
  }
}

export function sendSms(phone: string, text: string) {
  const to = `+${normalizePhone(phone, brandDb.get().countryCode)}`;
  return send({ channel: 'sms', to, text }, `SMS to ${to}`, `sms:${to}?body=${encodeURIComponent(text)}`);
}

export function sendEmail(to: string, subject: string, text: string, attachments: Attachment[] = []) {
  return send(
    { channel: 'email', to, subject, text, attachments },
    `Email to ${to}`,
    `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`,
    attachments
  );
}
