// Optional cross-device sync through your own free Supabase project (see README.md).
// The app works fully offline without it; sync just copies records between your devices.
import { mergeRemote, pendingChanges, markSynced } from './store.js';

const CFG_KEY = 'levelup:sync';
const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm';
const TABLE = 'levelup_records';

let client = null;
let running = null;
// status: off | signed-out | syncing | ok | error. `report` says what the last sync did.
const state = { status: 'off', user: null, lastSync: null, error: '', report: null };
const SYNC_TIMEOUT = 45000;
const listeners = new Set();

export const syncState = () => state;
export function onSyncChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function setState(patch) {
  Object.assign(state, patch);
  listeners.forEach(fn => fn());
}

export function getConfig() {
  try {
    return JSON.parse(localStorage.getItem(CFG_KEY)) || {};
  } catch {
    return {};
  }
}
const saveConfig = cfg => localStorage.setItem(CFG_KEY, JSON.stringify(cfg));

async function getClient() {
  const { url, key } = getConfig();
  if (!url || !key) return null;
  if (!client) {
    const { createClient } = await import(SUPABASE_JS);
    client = createClient(url, key, {
      auth: {
        persistSession: true, autoRefreshToken: true, storageKey: 'levelup:auth',
        // Skip the cross-tab browser lock: if another tab or a frozen page holds it, every sync hangs forever.
        lock: (name, timeout, fn) => fn(),
      },
      // Never let the browser answer a sync request from its cache.
      global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
    });
  }
  return client;
}

export async function init() {
  try {
    const sb = await getClient();
    if (!sb) return setState({ status: 'off', user: null });
    const { data: { session } } = await sb.auth.getSession();
    setState({ user: session?.user ?? null, status: session ? 'ok' : 'signed-out' });
    if (session) syncNow();
  } catch (err) {
    setState({ status: 'error', error: err.message || String(err) });
  }
}

export function connect(url, key) {
  saveConfig({ url: url.trim().replace(/\/+$/, ''), key: key.trim() });
  client = null;
  return init();
}

export async function disconnect() {
  try {
    await client?.auth.signOut();
  } catch {}
  localStorage.removeItem(CFG_KEY);
  client = null;
  setState({ status: 'off', user: null, lastSync: null, error: '' });
}

export async function signIn(email, password) {
  const sb = await getClient();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  setState({ user: data.user, status: 'ok' });
  await syncNow();
}

export async function signUp(email, password) {
  const sb = await getClient();
  const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.href.split('#')[0] } });
  if (error) throw error;
  if (!data.session) return 'confirm-email';
  setState({ user: data.user, status: 'ok' });
  await syncNow();
  return 'signed-in';
}

export async function signOut() {
  await client?.auth.signOut();
  setState({ user: null, status: 'signed-out' });
}

export function syncNow() {
  if (!running) {
    // A sync that stalls (bad connection, sleeping tab) is abandoned so the next one can run.
    const timeout = new Promise(resolve => setTimeout(() => resolve('timeout'), SYNC_TIMEOUT));
    running = Promise.race([doSync(), timeout])
      .then(result => {
        if (result === 'timeout') setState({ status: 'error', error: 'Sync timed out. Check your connection and tap Sync now.' });
      })
      .finally(() => { running = null; });
  }
  return running;
}

async function doSync() {
  if (!navigator.onLine) return;
  const sb = await getClient().catch(() => null);
  if (!sb) return;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return setState({ status: 'signed-out', user: null });
  setState({ status: 'syncing', error: '' });
  try {
    // 1. Pull every record from the cloud and merge it (newest edit wins, so repeating this is harmless).
    // The whole save is small, and always pulling all of it means a device can never get stuck behind.
    let pulled = 0;
    let fresh = 0;
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from(TABLE).select('data').order('id').range(from, from + 999);
      if (error) throw error;
      pulled += data.length;
      fresh += mergeRemote(data.map(r => r.data));
      if (data.length < 1000) break;
    }
    // 2. Push this device's unsynced changes. The server ignores any that are older than what it has.
    const changes = pendingChanges();
    for (let i = 0; i < changes.length; i += 500) {
      const chunk = changes.slice(i, i + 500);
      const rows = chunk.map(r => ({ id: r.id, user_id: session.user.id, data: r, updated_at: r.updatedAt }));
      const { error } = await sb.from(TABLE).upsert(rows, { onConflict: 'user_id,id' });
      if (error) throw error;
      markSynced(chunk);
    }
    setState({ status: 'ok', user: session.user, lastSync: Date.now(), report: { pulled, fresh, sent: changes.length } });
  } catch (err) {
    setState({ status: 'error', error: err.message || String(err) });
  }
}
