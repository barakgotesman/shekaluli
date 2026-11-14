import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut as firebaseSignOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { clearLocalData } from '../logic/storage';

/**
 * Tracks the Firebase Auth session and exposes Google sign-in/sign-out.
 * `loading` stays true until Firebase has restored (or ruled out) a saved session,
 * so the app doesn't flash the login screen for already-signed-in users.
 * @returns the current user (null when signed out), loading flag, and sign-in/out actions
 */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u);
        setLoading(false);
      }),
    [],
  );

  /** Signs in with Google; falls back to a full-page redirect when the popup is blocked/unsupported. */
  async function signIn() {
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      const code = (e as { code?: string }).code;      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        await signInWithRedirect(auth, googleProvider);
      } else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setError('ההתחברות נכשלה. נסו שוב.');
      }
    }
  }

  /** Signs out and wipes the local cache so the next account on this device never sees this user's data. */
  async function signOut() {
    await firebaseSignOut(auth);
    clearLocalData();
  }

  return { user, loading, error, signIn, signOut };
}
