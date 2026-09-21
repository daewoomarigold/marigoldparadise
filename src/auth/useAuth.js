// Shared auth hook — used by both TeacherDashboard.jsx and IslandView.jsx
// (see LoginScreen.jsx, shown by both when there's no session) so the
// same login gate/state logic isn't duplicated across the two pages.
import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';

// Locked down to just Taylor's two accounts for now (explicit request —
// "may open it up" later, not scoped/designed yet). This is a client-side
// convenience check only — the REAL enforcement is server-side, via
// is_allowed_owner() in supabase/schema.sql, which every RLS policy
// requires. Without this check here too, a non-allowed account would
// still see a real (if instantly-empty/broken) dashboard before every
// request failed against RLS; this catches it immediately and signs them
// back out instead. Keep this list in sync with schema.sql's function —
// updating one without the other means either a UI that still shows a
// blocked account "signed in" (client says yes, DB says no), or the
// reverse (DB allows someone the client turns away).
const ALLOWED_EMAILS = ['glover.taylorjames@gmail.com', 'daewoomarigold@gmail.com'];

export function useAuth() {
  const [session, setSession] = useState(undefined); // undefined = not checked yet, null = signed out, object = signed in
  const [error, setError] = useState('');

  useEffect(() => {
    function handleSession(newSession) {
      if (newSession && !ALLOWED_EMAILS.includes(newSession.user.email)) {
        // Not on the allowlist — sign them straight back out rather than
        // exposing a dashboard that would just fail against RLS on every
        // request. Signing out here fires another onAuthStateChange event
        // with a null session, which this same function handles as a
        // normal sign-out below — no separate cleanup needed.
        setError(`${newSession.user.email} isn't authorized for this app.`);
        supabase.auth.signOut();
        return;
      }
      setError('');
      setSession(newSession);
    }

    supabase.auth.getSession().then(({ data, error: err }) => {
      if (err) setError(err.message);
      handleSession(data.session);
    });

    // Fires on sign-in, sign-out, and token refresh — keeps `session` (and
    // therefore both pages' gate) live without a reload.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      handleSession(newSession);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  function signInWithGoogle() {
    setError('');
    // Explicit redirectTo, not the default — left unset, auth-js falls
    // back to Supabase's "Site URL" setting (which, unless changed in the
    // dashboard, is still the placeholder http://localhost:3000 every
    // project starts with — see CLAUDE.md's Database section). Even with
    // that fixed, the client's OTHER default is window.location.origin,
    // which drops the path entirely (/marigoldparadise/teacher/ vs
    // /marigoldparadise/island/ — two separate pages, see
    // vite.config.js) — window.location.href preserves the full current
    // URL, so sign-in from either page returns to that same page instead
    // of always landing back on the dashboard.
    supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.href } }).then(({ error: err }) => {
      if (err) setError(err.message);
    });
  }

  function signOut() {
    supabase.auth.signOut();
  }

  return {
    session,
    loading: session === undefined,
    error,
    signInWithGoogle,
    signOut,
  };
}
