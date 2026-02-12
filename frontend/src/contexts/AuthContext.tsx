//TODO hook instead of context?

// frontend/src/contexts/AuthContext-PushOnly.tsx
// Simple push-only sync: Pull once on auth, then continuous push

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';

PouchDB.plugin(PouchDBFind);

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';
const LOCAL_DB_NAME = 'chess-training-local';

// Export localDB as constant (always available)
export const localDB = new PouchDB(LOCAL_DB_NAME);

// Create indexes
localDB
  .createIndex({
    index: { fields: ['type', 'userId'] },
  })
  .catch((err) => console.error('Failed to create index:', err));

interface User {
  id: string;
  email: string;
  name?: string;
  picture?: string;
}

interface SyncStatus {
  state: 'idle' | 'pulling' | 'pushing' | 'synced' | 'error';
  lastSync?: Date;
  error?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  syncStatus: SyncStatus;
  localDB: PouchDB.Database;
  remoteDB: PouchDB.Database | null;

  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ state: 'idle' });
  const [remoteDB, setRemoteDB] = useState<PouchDB.Database | null>(null);
  const [pushHandler, setPushHandler] = useState<PouchDB.Replication.Replication<{}> | null>(null);

  /**
   * SIMPLE PUSH-ONLY SYNC
   *
   * Flow:
   * 1. On auth: Pull remote → local (one time, get latest)
   * 2. Start continuous push: local → remote (all changes sync automatically)
   * 3. That's it!
   *
   * Conflicts:
   * - Last write wins (simple!)
   * - Remote is source of truth on sign-in
   * - No complex conflict detection needed
   */
  const setupPushOnlySync = async (dbConfig: any, password?: string) => {
    console.log('SET UP');
    try {
      console.log('Setting up push-only sync...');
      console.log("DBCONF", dbConfig)

      // Get credentials if needed
      let auth = { username: dbConfig.userName, password: password || '' };

      if (!password) {
        const credsResponse = await fetch(`${API_URL}/auth/couch-credentials`, {
          credentials: 'include',
        });

        if (credsResponse.ok) {
          const creds = await credsResponse.json();
          auth.password = creds.password;
        } else {
          throw new Error('Could not retrieve database credentials');
        }
      }

      // Connect to remote database
      const remote = new PouchDB(dbConfig.url, {
        auth,
        skip_setup: true,
      });

      setRemoteDB(remote);

      // STEP 1: Pull from remote to get latest state
      console.log('Pulling latest state from remote...');
      setSyncStatus({ state: 'pulling' });

      await localDB.replicate.from(remote);
      console.log('Pull complete - local is up to date');

      // STEP 2: Start continuous push to remote
      console.log('Starting continuous push to remote...');
      setSyncStatus({ state: 'pushing' });

      const push = localDB.replicate.to(remote, {
        live: true,
        retry: true,
      });

      // Event handlers
      push.on('change', (info) => {
        console.log(`Pushed ${info.docs.length} changes to remote`);
        setSyncStatus({
          state: 'synced',
          lastSync: new Date(),
        });
      });

      push.on('paused', () => {
        // Replication is idle (caught up)
        setSyncStatus((prev) => ({
          ...prev,
          state: 'synced',
          lastSync: new Date(),
        }));
      });

      push.on('active', () => {
        // Replication is actively pushing
        setSyncStatus((prev) => ({
          ...prev,
          state: 'pushing',
        }));
      });

      push.on('error', (err) => {
        console.error('Push error:', err);
        setSyncStatus({
          state: 'error',
          error: err.message,
        });
      });

      setPushHandler(push);

      console.log('Push-only sync active');
    } catch (err) {
      console.error('Sync setup error:', err);
      setSyncStatus({
        state: 'error',
        error: err instanceof Error ? err.message : 'Sync failed',
      });
      throw err;
    }
  };

  /**
   * Check authentication status on mount
   */
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch(`${API_URL}/auth/status`, {
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          if (data.isAuthenticated) {
            setUser({
              id: data.user.id,
              email: data.user.email,
              name: data.user.name,
              picture: data.user.picture,
            });

            // Set up sync with stored database config
            if (data.dbConfig) {
              await setupPushOnlySync(data.dbConfig);
            }
          }
        }
      } catch (err) {
        console.error('Auth check failed:', err);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  /**
   * Sign in with Google
   */
  // const signInWithGoogle = useCallback(async () => {
  //   const width = 500;
  //   const height = 600;
  //   const left = window.screenX + (window.outerWidth - width) / 2;
  //   const top = window.screenY + (window.outerHeight - height) / 2;

  //   const popup = window.open(
  //     `${API_URL}/auth/google/url`,
  //     'Google Sign In',
  //     `width=${width},height=${height},left=${left},top=${top}`,
  //   );

  //   if (!popup) {
  //     alert('Please allow popups for this site');
  //     return;
  //   }

  //   // Listen for auth code from popup
  //   const handleMessage = async (event: MessageEvent) => {
  //     if (event.origin !== window.location.origin) return;

  //     if (event.data.type === 'auth-success' && event.data.code) {
  //       window.removeEventListener('message', handleMessage);

  //       try {
  //         // Exchange code for session
  //         const response = await fetch(`${API_URL}/auth/google/callback`, {
  //           method: 'POST',
  //           headers: { 'Content-Type': 'application/json' },
  //           credentials: 'include',
  //           body: JSON.stringify({ code: event.data.code }),
  //         });

  //         if (!response.ok) {
  //           throw new Error('Authentication failed');
  //         }

  //         const data = await response.json();

  //         setUser({
  //           id: data.user.id,
  //           email: data.user.email,
  //           name: data.user.name,
  //           picture: data.user.picture,
  //         });

  //         // Set up push-only sync
  //         await setupPushOnlySync(data.dbConfig, data.couchPassword);
  //       } catch (err) {
  //         console.error('Sign in error:', err);
  //         setSyncStatus({
  //           state: 'error',
  //           error: err instanceof Error ? err.message : 'Sign in failed',
  //         });
  //       }
  //     }
  //   };

  //   window.addEventListener('message', handleMessage);
  // }, []);

  const signInWithGoogle = async () => {
    try {
      // Get Google OAuth URL from backend
      const urlResponse = await fetch(`${API_URL}/auth/google/url`);
      const { url } = await urlResponse.json();

      // Open OAuth popup
      const width = 500;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        url,
        'Google Sign In',
        `width=${width},height=${height},left=${left},top=${top}`,
      );

      // Listen for OAuth callback
      return new Promise<void>((resolve, reject) => {
        const handleMessage = async (event: MessageEvent) => {
          if (event.origin !== window.location.origin) return;

          if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
            window.removeEventListener('message', handleMessage);
            popup?.close();

            try {
              // Exchange code for tokens
              const response = await fetch(`${API_URL}/auth/google/callback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ code: event.data.code }),
              });

              if (!response.ok) {
                throw new Error('Authentication failed');
              }

              const data = await response.json();
              // server(auth code) ==> DB creds
              console.log("DATA From server after sending auth code", data);
              setUser({
                id: data.user.id,
                email: data.user.email,
                name: data.user.name,
                picture: data.user.picture,
              });

              // Set up sync
              await setupPushOnlySync(data.database, data.database.password);

              resolve();
            } catch (err) {
              reject(err);
            }
          } else if (event.data.type === 'GOOGLE_AUTH_ERROR') {
            window.removeEventListener('message', handleMessage);
            popup?.close();
            reject(new Error(event.data.error));
          }
        };

        window.addEventListener('message', handleMessage);

        // Check if popup was closed
        const checkClosed = setInterval(() => {
          if (popup?.closed) {
            clearInterval(checkClosed);
            window.removeEventListener('message', handleMessage);
            reject(new Error('Authentication cancelled'));
          }
        }, 1000);
      });
    } catch (err) {
      console.error('Sign in error:', err);
      throw err;
    }
  };

  /**
   * Sign out
   */
  const signOut = useCallback(async () => {
    try {
      // Cancel push replication
      if (pushHandler) {
        pushHandler.cancel();
      }

      // Call backend to clear session
      await fetch(`${API_URL}/auth/signout`, {
        method: 'POST',
        credentials: 'include',
      });

      setUser(null);
      setRemoteDB(null);
      setPushHandler(null);
      setSyncStatus({ state: 'idle' });
    } catch (err) {
      console.error('Sign out error:', err);
    }
  }, [pushHandler]);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    syncStatus,
    localDB,
    remoteDB,
    signInWithGoogle,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
