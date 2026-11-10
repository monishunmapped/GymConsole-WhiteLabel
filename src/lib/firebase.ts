import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, doc, setDoc, getDocs, onSnapshot, writeBatch, WriteBatch, Firestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { Member, CheckIn, MembershipPlan, WelcomeMessage, SecurityConfig, Feedback } from '../types';
import { MEMBERSHIP_PLANS, INITIAL_MEMBERS, INITIAL_CHECKINS } from '../data/initialData';

const env = import.meta.env;
const app = env.VITE_FIREBASE_PROJECT_ID
  ? initializeApp({
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: env.VITE_FIREBASE_APP_ID,
    })
  : null;

export const db: Firestore | null = app
  ? initializeFirestore(app, { experimentalForceLongPolling: true, ignoreUndefinedProperties: true }, env.VITE_FIREBASE_DATABASE_ID || '(default)')
  : null;

export const functions = app ? getFunctions(app, env.VITE_FUNCTIONS_REGION || 'asia-south1') : null;

const warn = (ctx: string) => (err: unknown) => console.warn(`[Firestore] ${ctx}:`, err instanceof Error ? err.message : err);

function readLocal<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

async function commitAll(ops: ((b: WriteBatch, db: Firestore) => void)[]) {
  if (!db) return;
  for (let i = 0; i < ops.length; i += 450) {
    const batch = writeBatch(db);
    ops.slice(i, i + 450).forEach(op => op(batch, db));
    await batch.commit();
  }
}

const newestFirst = (a: { timestamp: string }, b: { timestamp: string }) => Date.parse(b.timestamp) - Date.parse(a.timestamp);

function createStore<T extends object>(col: string, fallback: T[], idOf: (x: T) => string, sort?: (a: T, b: T) => number) {
  const key = `gym_local_${col}`;
  const listeners = new Set<(list: T[]) => void>();
  const get = () => readLocal<T[]>(key, fallback);
  const set = (list: T[]) => {
    if (sort) list.sort(sort);
    localStorage.setItem(key, JSON.stringify(list));
    listeners.forEach(fn => fn(list));
  };

  window.addEventListener('storage', e => e.key === key && listeners.forEach(fn => fn(get())));

  return {
    get,
    subscribe(fn: (list: T[]) => void) {
      listeners.add(fn);
      fn(get());
      const unsub = db ? onSnapshot(collection(db, col), snap => set(snap.docs.map(d => d.data() as T)), warn(`subscribe ${col}`)) : () => {};
      return () => {
        listeners.delete(fn);
        unsub();
      };
    },
    async seed() {
      if (!localStorage.getItem(key)) set([...fallback]);
      if (!db || !fallback.length || !(await getDocs(collection(db, col))).empty) return;
      await commitAll(fallback.map(x => (b, d) => b.set(doc(d, col, idOf(x)), x)));
    },
    async put(...items: T[]) {
      const ids = new Set(items.map(idOf));
      set([...items, ...get().filter(x => !ids.has(idOf(x)))]);
      await commitAll(items.map(x => (b, d) => b.set(doc(d, col, idOf(x)), x))).catch(warn(`put ${col}`));
    },
    async patch(id: string, updates: Partial<T>) {
      set(get().map(x => (idOf(x) === id ? { ...x, ...updates } : x)));
      await commitAll([(b, d) => b.set(doc(d, col, id), updates, { merge: true })]).catch(warn(`patch ${col}`));
    },
    async patchAll(updates: Partial<T>) {
      const list = get();
      set(list.map(x => ({ ...x, ...updates })));
      await commitAll(list.map(x => (b, d) => b.set(doc(d, col, idOf(x)), updates, { merge: true }))).catch(warn(`patchAll ${col}`));
    },
    async remove(...ids: string[]) {
      set(get().filter(x => !ids.includes(idOf(x))));
      await commitAll(ids.map(id => (b, d) => b.delete(doc(d, col, id)))).catch(warn(`remove ${col}`));
    },
    async clear() {
      set([]);
      if (!db) return;
      try {
        const snap = await getDocs(collection(db, col));
        await commitAll(snap.docs.map(s => b => b.delete(s.ref)));
      } catch (err) {
        warn(`clear ${col}`)(err);
      }
    },
  };
}

function createSetting<T extends object>(id: string, defaults: T) {
  const key = `gym_local_settings_${id}`;
  const listeners = new Set<(value: T) => void>();
  const get = (): T => ({ ...defaults, ...readLocal<Partial<T>>(key, {}) });
  const set = (value: T) => {
    localStorage.setItem(key, JSON.stringify(value));
    listeners.forEach(fn => fn(value));
  };
  window.addEventListener('storage', e => e.key === key && listeners.forEach(fn => fn(get())));
  return {
    get,
    subscribe(fn: (value: T) => void) {
      listeners.add(fn);
      fn(get());
      const ref = db && doc(db, 'settings', id);
      const unsub = ref
        ? onSnapshot(ref, snap => {
            if (snap.exists()) set({ ...defaults, ...(snap.data() as T) });
            else setDoc(ref, get()).catch(warn(`seed ${id}`));
          }, warn(`subscribe ${id}`))
        : () => {};
      return () => {
        listeners.delete(fn);
        unsub();
      };
    },
    async update(value: T) {
      set(value);
      if (db) await setDoc(doc(db, 'settings', id), value).catch(warn(`update ${id}`));
    },
  };
}

export const membersDb = createStore<Member>('members', INITIAL_MEMBERS, m => m.id);
export const plansDb = createStore<MembershipPlan>('membership_plans', MEMBERSHIP_PLANS, p => p.name);
export const checkInsDb = createStore<CheckIn>('checkins', INITIAL_CHECKINS, c => c.id, newestFirst);
export const messagesDb = createStore<WelcomeMessage>('welcome_messages', [], m => m.id, newestFirst);
export const feedbacksDb = createStore<Feedback>('feedbacks', [], f => f.id, newestFirst);

export const securityDb = createSetting<SecurityConfig>('security', {
  id: 'security',
  ownerEmail: 'owner@example.com',
  ownerPassword: 'ChangeMe-Owner1',
  adminEmail: 'admin@example.com',
  adminPassword: 'ChangeMe-Admin1',
});

export async function deleteMember(id: string) {
  await Promise.all([
    membersDb.remove(id),
    checkInsDb.remove(...checkInsDb.get().filter(c => c.memberId === id).map(c => c.id)),
  ]);
}

export async function seedDatabaseIfEmpty() {
  await Promise.all([membersDb.seed(), plansDb.seed(), checkInsDb.seed()]).catch(warn('seed'));
}

export async function factoryReset() {
  await Promise.all([messagesDb.clear(), checkInsDb.clear()]);
  await Promise.all([plansDb.put(...MEMBERSHIP_PLANS), membersDb.put(...INITIAL_MEMBERS), checkInsDb.put(...INITIAL_CHECKINS)]);
}

export { createSetting };
