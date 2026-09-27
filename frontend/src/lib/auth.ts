import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth'
import { auth, googleProvider, isFirebaseConfigured } from './firebase'
import { type Role } from '@/stores/role-store'
import { API_BASE_URL } from './api'

export interface AuthUser {
  uid: string
  email: string
  displayName?: string
  role: Role
  photoURL?: string
  createdAt?: string
}

export interface AuthState {
  authenticated: boolean
  user: AuthUser | null
  role: Role | null
  isLoading: boolean
}

async function fetchMe(token: string): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error("Failed to resolve user");
    return await res.json();
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') throw { code: 'auth/network-request-failed', message: 'Backend verification timed out.' };
    throw err;
  }
}

async function fetchSignup(token: string, payload: any): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/signup`, {
      method: "POST",
      headers: { 
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error("Failed to signup user in backend");
    return await res.json();
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') throw { code: 'auth/network-request-failed', message: 'Backend registration timed out.' };
    throw err;
  }
}

export function getFriendlyErrorMessage(error: any): string {
  if (!error) return 'An unexpected error occurred. Please try again.'
  const code = error.code || ''
  const message = error.message || ''

  switch (code) {
    case 'auth/invalid-email': return 'Please enter a valid email address.'
    case 'auth/invalid-credential':
    case 'auth/wrong-password': return 'Invalid email or password.'
    case 'auth/user-not-found': return 'No account exists with this email. Please check your email or create an account.'
    case 'auth/email-already-in-use': return 'This email is already registered. Please sign in instead.'
    case 'auth/weak-password': return 'Your password is too weak. Please use at least 6 characters.'
    case 'auth/popup-closed-by-user': return 'Google sign-in was cancelled.'
    case 'auth/popup-blocked': return 'Google sign-in popup was blocked by your browser. Please allow popups for this site.'
    case 'auth/too-many-requests': return 'Too many unsuccessful attempts. Please try again later.'
    case 'auth/user-disabled': return 'This account has been disabled. Please contact resort support.'
    case 'auth/unauthorized-domain': return 'This domain is not authorized in Firebase Console (Authentication > Settings > Authorized domains).'
    case 'auth/network-request-failed': return 'Network error. Please check your internet connection and try again.'
    default:
      if (message.includes('missing-config') || !isFirebaseConfigured) {
        return 'Firebase Authentication is not configured. Please ensure VITE_FIREBASE_* variables are set in frontend/.env.local.'
      }
      return message || 'Authentication failed. Please check your credentials.'
  }
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "992989791821-45v9om88hqleien9u1mruaems40b9nqr.apps.googleusercontent.com";

function promptGoogleLogin(): Promise<{ token: string; user: any }> {
  return new Promise((resolve, reject) => {
    function setupClient() {
      try {
        const client = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: 'openid email profile',
          callback: async (tokenResponse: any) => {
            if (tokenResponse.error) {
              if (tokenResponse.error === 'popup_closed_by_user') {
                reject({ code: 'auth/popup-closed-by-user' });
              } else {
                reject({ code: 'auth/network-request-failed', message: tokenResponse.error_description || tokenResponse.error });
              }
              return;
            }
            try {
              const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
              });
              const userInfo = await res.json();
              resolve({
                token: tokenResponse.access_token,
                user: userInfo
              });
            } catch (err) {
              reject(err);
            }
          },
        });
        client.requestAccessToken();
      } catch (err) {
        reject(err);
      }
    }

    if (typeof (window as any).google !== 'undefined' && (window as any).google?.accounts?.oauth2) {
      setupClient();
    } else {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = () => setupClient();
      script.onerror = () => reject({ code: 'auth/network-request-failed', message: 'Failed to load Google Sign-In SDK' });
      document.body.appendChild(script);
    }
  });
}

export const AuthService = {
  getCurrentUser(): AuthUser | null {
    try {
      const stored = localStorage.getItem('sr360_auth_user')
      if (stored) return JSON.parse(stored)
    } catch { }
    return null
  },

  isAuthenticated(): boolean {
    return Boolean(auth?.currentUser) || Boolean(this.getCurrentUser())
  },

  async getIdToken(forceRefresh: boolean = false): Promise<string | null> {
    if (auth?.currentUser) {
      try {
        const token = await auth.currentUser.getIdToken(forceRefresh)
        if (token) {
          sessionStorage.setItem('sr360_id_token', token)
          localStorage.setItem('sr360_id_token', token)
          return token
        }
      } catch (e) {
        console.warn('Failed to retrieve Firebase ID token:', e)
      }
    }
    const token = sessionStorage.getItem('sr360_id_token') || localStorage.getItem('sr360_id_token')
    if (token) return token

    // Fallback: if user is logged in, their uid acts as authorized token
    const user = this.getCurrentUser()
    if (user?.uid) {
      return user.uid
    }
    return null
  },

  async signInWithEmail(email: string, password: string): Promise<AuthUser> {
    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail) throw { code: 'auth/invalid-email' }
    if (!password) throw { code: 'auth/wrong-password' }
    if (!isFirebaseConfigured || !auth) throw { code: 'auth/missing-config' }

    const cred = await signInWithEmailAndPassword(auth, trimmedEmail, password)
    const token = await cred.user.getIdToken()
    const dbUser = await fetchMe(token);

    const authUser: AuthUser = {
      uid: dbUser.id.toString(), // Internal ID
      email: dbUser.email,
      displayName: dbUser.name,
      role: dbUser.role as Role,
      photoURL: cred.user.photoURL || undefined,
    }

    this.persistSession(authUser, token)
    return authUser
  },

  async signUpWithEmail(email: string, password: string, confirmPassword: string, fullName: string): Promise<AuthUser> {
    const trimmedEmail = email.trim().toLowerCase()
    const trimmedName = fullName.trim()

    if (!trimmedEmail) throw { code: 'auth/invalid-email' }
    if (!password || password.length < 6) throw { code: 'auth/weak-password' }
    if (password !== confirmPassword) throw { code: 'auth/passwords-mismatch', message: 'Passwords do not match.' }
    if (!trimmedName) throw { code: 'auth/invalid-name', message: 'Please enter your full name.' }
    if (!isFirebaseConfigured || !auth) throw { code: 'auth/missing-config' }

    const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, password)
    try { await updateProfile(cred.user, { displayName: trimmedName }) } catch (e) { }

    const token = await cred.user.getIdToken()
    const payload = {
      name: trimmedName,
      email: trimmedEmail,
      firebase_uid: cred.user.uid
    }
    const dbUser = await fetchSignup(token, payload);

    const authUser: AuthUser = {
      uid: dbUser.id.toString(),
      email: dbUser.email,
      displayName: dbUser.name,
      role: dbUser.role as Role,
    }

    this.persistSession(authUser, token)
    return authUser
  },

  async signInWithGoogle(): Promise<AuthUser> {
    // 1. Try Direct Google OAuth with Google Cloud Client ID
    try {
      const { token, user: googleUser } = await promptGoogleLogin();
      
      const payload = {
        name: googleUser.name || "Google User",
        email: googleUser.email,
        firebase_uid: googleUser.sub
      };
      const dbUser = await fetchSignup(token, payload);

      const authUser: AuthUser = {
        uid: dbUser.id.toString(),
        email: dbUser.email,
        displayName: dbUser.name,
        role: dbUser.role as Role,
        photoURL: googleUser.picture || undefined,
      };

      this.persistSession(authUser, token);
      return authUser;
    } catch (err: any) {
      // If direct Google OAuth was cancelled by user, rethrow
      if (err?.code === 'auth/popup-closed-by-user') {
        throw err;
      }
      // Fallback to Firebase Google Provider if configured
      if (isFirebaseConfigured && auth && googleProvider) {
        const cred = await signInWithPopup(auth, googleProvider);
        const token = await cred.user.getIdToken();
        const payload = {
          name: cred.user.displayName || "Google User",
          email: cred.user.email,
          firebase_uid: cred.user.uid
        };
        const dbUser = await fetchSignup(token, payload);
        const authUser: AuthUser = {
          uid: dbUser.id.toString(),
          email: dbUser.email,
          displayName: dbUser.name,
          role: dbUser.role as Role,
          photoURL: cred.user.photoURL || undefined,
        };
        this.persistSession(authUser, token);
        return authUser;
      }
      throw err;
    }
  },

  async sendPasswordReset(email: string): Promise<void> {
    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail) throw { code: 'auth/invalid-email' }
    if (!isFirebaseConfigured || !auth) throw { code: 'auth/missing-config' }
    await sendPasswordResetEmail(auth, trimmedEmail)
  },

  async signOut(): Promise<void> {
    if (auth) {
      try { await firebaseSignOut(auth) } catch (e) { }
    }
    localStorage.removeItem('sr360_auth_user')
    localStorage.removeItem('resort_entered')
    sessionStorage.removeItem('resort_entered')
    sessionStorage.removeItem('sr360_id_token')
  },

  persistSession(user: AuthUser, idToken?: string) {
    localStorage.setItem('sr360_auth_user', JSON.stringify(user))
    localStorage.setItem('resort_entered', 'true')
    sessionStorage.setItem('resort_entered', 'true')
    const existingToken = sessionStorage.getItem('sr360_id_token') || localStorage.getItem('sr360_id_token')
    const tokenToSave = idToken || existingToken || user.uid
    if (tokenToSave) {
      sessionStorage.setItem('sr360_id_token', tokenToSave)
      localStorage.setItem('sr360_id_token', tokenToSave)
    }
  },

  subscribeToAuthState(callback: (user: AuthUser | null) => void): () => void {
    if (!isFirebaseConfigured || !auth) {
      callback(this.getCurrentUser())
      return () => {}
    }

    return onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        try {
          const token = await firebaseUser.getIdToken()
          sessionStorage.setItem('sr360_id_token', token)
          
          const dbUser = await fetchMe(token);
          const authUser: AuthUser = {
            uid: dbUser.id.toString(),
            email: dbUser.email,
            displayName: dbUser.name,
            role: dbUser.role as Role,
            photoURL: firebaseUser.photoURL || undefined,
          }
          this.persistSession(authUser, token)
          callback(authUser)
        } catch (e) {
          console.warn("Failed to resolve user from backend", e);
          callback(null);
        }
      } else {
        const currentUser = this.getCurrentUser();
        if (currentUser) {
          callback(currentUser);
          return;
        }
        localStorage.removeItem('sr360_auth_user')
        localStorage.removeItem('resort_entered')
        sessionStorage.removeItem('resort_entered')
        sessionStorage.removeItem('sr360_id_token')
        callback(null)
      }
    })
  },
}
