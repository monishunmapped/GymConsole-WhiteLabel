import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret, defineString } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';

initializeApp();

const TWILIO_ACCOUNT_SID = defineSecret('TWILIO_ACCOUNT_SID');
const TWILIO_AUTH_TOKEN = defineSecret('TWILIO_AUTH_TOKEN');
const TWILIO_FROM = defineString('TWILIO_FROM', { default: '' });
const SMTP_URL = defineSecret('SMTP_URL');
const MAIL_FROM = defineString('MAIL_FROM', { default: '' });
const DATABASE_ID = defineString('DATABASE_ID', { default: '(default)' });
const REGION = defineString('REGION', { default: 'asia-south1' });

interface Payload {
  channel: 'sms' | 'email';
  to: string;
  subject?: string;
  text: string;
  attachments?: { filename: string; content: string }[];
}

const lastTen = (s = '') => s.replace(/\D/g, '').slice(-10);

async function isMember({ channel, to }: Payload) {
  const snap = await getFirestore(DATABASE_ID.value()).collection('members').get();
  return snap.docs.some(d => {
    const m = d.data();
    return channel === 'sms'
      ? [m.phone, m.alternatePhone].some(p => p && lastTen(p) === lastTen(to))
      : String(m.email || '').toLowerCase() === to.toLowerCase();
  });
}

async function sendSms(to: string, text: string) {
  const sid = TWILIO_ACCOUNT_SID.value();
  if (!sid || !TWILIO_FROM.value()) throw new HttpsError('failed-precondition', 'SMS gateway is not configured');
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${TWILIO_AUTH_TOKEN.value()}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: TWILIO_FROM.value(), Body: text }),
  });
  if (!res.ok) throw new HttpsError('aborted', `SMS provider error: ${((await res.json()) as { message?: string }).message || res.status}`);
}

async function sendEmail({ to, subject, text, attachments = [] }: Payload) {
  if (!SMTP_URL.value() || !MAIL_FROM.value()) throw new HttpsError('failed-precondition', 'Email gateway is not configured');
  await nodemailer.createTransport(SMTP_URL.value()).sendMail({
    from: MAIL_FROM.value(),
    to,
    subject: subject || 'Message',
    text,
    attachments: attachments.slice(0, 3).map(a => ({ filename: a.filename, content: Buffer.from(a.content, 'base64') })),
  }).catch(err => {
    throw new HttpsError('aborted', `Email provider error: ${err.message}`);
  });
}

export const sendMessage = onCall(
  { region: REGION, secrets: [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, SMTP_URL], cors: true, maxInstances: 5 },
  async req => {
    const data = req.data as Payload;
    if (!data || !['sms', 'email'].includes(data.channel) || typeof data.to !== 'string' || typeof data.text !== 'string' || !data.text.trim()) {
      throw new HttpsError('invalid-argument', 'channel, to and text are required');
    }
    if (data.text.length > 2000) throw new HttpsError('invalid-argument', 'Message is too long');
    if (!(await isMember(data))) throw new HttpsError('permission-denied', 'Recipient is not a registered member');
    if (data.channel === 'sms') await sendSms(data.to, data.text);
    else await sendEmail(data);
    return { ok: true };
  }
);
