import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SYNCED_KEYS, applyRemote, clearSynced, getOwner, onUserChange, setOwner, snapshot } from '../lib/store';
import { syncConfigured } from './config';
import { SyncEngine, type Status } from './engine';
import { acceptValue } from './schema';

export interface AuthResult {
  error?: string;
  notice?: string;
}

export interface Sync {
  configured: boolean;
  ready: boolean;
  email: string | null;
  status: Status;
  signIn(email: string, password: string): Promise<AuthResult>;
  signUp(email: string, password: string): Promise<AuthResult>;
  magicLink(email: string): Promise<AuthResult>;
  signOut(): Promise<void>;
  syncNow(): void;
}

const IDLE: Status = { state: 'idle' };
const POLL_MS = 60_000;
const FOCUS_THROTTLE_MS = 5_000;

export function useSync(): Sync {
  const [ready, setReady] = useState(!syncConfigured);
  const [email, setEmail] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(IDLE);
  const sbRef = useRef<SupabaseClient | null>(null);
  const engineRef = useRef<SyncEngine | null>(null);

  useEffect(() => {
    if (!syncConfigured) return;
    let cancelled = false;
    let teardown: (() => void) | null = null;
    let activeUser: string | null = null;

    const stop = () => {
      teardown?.();
      teardown = null;
      engineRef.current = null;
      activeUser = null;
      setStatus(IDLE);
    };

    const start = async (sb: SupabaseClient, userId: string) => {
      const { supabaseRemote } = await import('./supabase');
      if (cancelled) return;
      // Never merge one account's local data into another account.
      const owner = getOwner();
      if (owner && owner !== userId) clearSynced();
      setOwner(userId);

      const engine = new SyncEngine(
        { snapshot, apply: applyRemote },
        supabaseRemote(sb, userId),
        SYNCED_KEYS,
        acceptValue,
      );
      engineRef.current = engine;
      activeUser = userId;
      const offStatus = engine.onStatus(setStatus);
      const offChange = onUserChange(() => engine.schedule());

      let last = 0;
      const pull = () => {
        if (document.visibilityState === 'hidden' || Date.now() - last < FOCUS_THROTTLE_MS) return;
        last = Date.now();
        void engine.syncNow();
      };
      document.addEventListener('visibilitychange', pull);
      window.addEventListener('focus', pull);
      window.addEventListener('online', pull);
      const poll = setInterval(pull, POLL_MS);

      teardown = () => {
        offStatus();
        offChange();
        document.removeEventListener('visibilitychange', pull);
        window.removeEventListener('focus', pull);
        window.removeEventListener('online', pull);
        clearInterval(poll);
        engine.dispose();
      };
      last = Date.now();
      void engine.syncNow();
    };

    (async () => {
      const { getClient } = await import('./supabase');
      if (cancelled) return;
      const sb = getClient();
      sbRef.current = sb;

      const handle = (session: { user: { id: string; email?: string } } | null) => {
        if (cancelled) return;
        if (session?.user) {
          setEmail(session.user.email ?? null);
          if (activeUser !== session.user.id) {
            stop();
            void start(sb, session.user.id);
          }
        } else {
          setEmail(null);
          stop();
        }
      };

      // Don't call back into Supabase inside this callback (it can deadlock): defer the work.
      sb.auth.onAuthStateChange((_event, session) => setTimeout(() => handle(session), 0));
      const { data } = await sb.auth.getSession();
      handle(data.session);
      if (!cancelled) setReady(true);
    })().catch(() => {
      if (!cancelled) setReady(true);
    });

    return () => {
      cancelled = true;
      stop();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const { error } = await sbRef.current!.auth.signInWithPassword({ email, password });
    return error ? { error: error.message } : {};
  }, []);

  const signUp = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const { data, error } = await sbRef.current!.auth.signUp({ email, password, options: { emailRedirectTo: location.origin } });
    if (error) return { error: error.message };
    return data.session ? {} : { notice: 'Check your email to confirm your account, then sign in.' };
  }, []);

  const magicLink = useCallback(async (email: string): Promise<AuthResult> => {
    const { error } = await sbRef.current!.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin } });
    return error ? { error: error.message } : { notice: 'Check your email for a sign-in link.' };
  }, []);

  const signOut = useCallback(async () => {
    const engine = engineRef.current;
    if (engine) {
      await engine.syncNow(); // push anything pending before this device forgets it
      if (engine.status.state === 'error' && !confirm('Your latest changes could not be synced. Signing out will discard them on this device. Sign out anyway?')) {
        return;
      }
    }
    clearSynced();
    setOwner(null);
    await sbRef.current?.auth.signOut();
  }, []);

  const syncNow = useCallback(() => void engineRef.current?.syncNow(), []);

  return { configured: syncConfigured, ready, email, status, signIn, signUp, magicLink, signOut, syncNow };
}
