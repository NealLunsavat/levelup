// Optional cross-device sync through your own free Supabase project (see README.md).
// The app works fully offline without it; sync just copies records between your devices.
import { mergeRemote, pendingChanges, markSynced } from './store.js';

const CFG_KEY = 'levelup:sync';
const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm';
const TABLE = 'levelup_records';

let client = null;
let running = null;
const state = { status: 'off', user: null, lastSync: null, error: '' }; // status: off | signed-out | syncing | ok | error
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
    client = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'levelup:auth' } });
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
  if (!running) running = doSync().finally(() => { running = null; });
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
    // 1. Pull everything changed on the server since last time (with a small overlap; merging is idempotent).
    const cfg = getConfig();
    const since = cfg.cursor ? new Date(Date.parse(cfg.cursor) - 5000).toISOString() : '1970-01-01T00:00:00Z';
    let newest = cfg.cursor ?? null;
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from(TABLE).select('data, server_ts').gt('server_ts', since).order('server_ts').range(from, from + 999);
      if (error) throw error;
      mergeRemote(data.map(r => r.data));
      const last = data.at(-1)?.server_ts;
      if (last && (!newest || Date.parse(last) > Date.parse(newest))) newest = last;
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
    saveConfig({ ...getConfig(), cursor: newest });
    setState({ status: 'ok', user: session.user, lastSync: Date.now() });
  } catch (err) {
    setState({ status: 'error', error: err.message || String(err) });
  }
}
