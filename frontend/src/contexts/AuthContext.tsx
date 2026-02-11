/*
TODO:
  do we need all syncState types?
  do we need bi-direction syncing? 
    how can trigger rerender? 
    use case fits
*/

// frontend/src/contexts/AuthContext.tsx
// Authentication context with PouchDB sync management

//TODO should we a store instead?
// store vs. context?
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';

// Enable PouchDB find plugin
PouchDB.plugin(PouchDBFind);

// Types
interface User {
  id: string;
  email: string;
  name?: string;
  picture?: string;
}

interface DatabaseConfig {
  name: string;
  url: string;
  userName: string;
  password?: string;
}

type SyncState = 'idle' | 'syncing' | 'synced' | 'error' | 'paused';

interface SyncStatus {
  state: SyncState;
  error?: string;
  lastSync?: Date;
  changesReceived?: number;
  changesSent?: number;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  syncStatus: SyncStatus;
  localDB: PouchDB.Database; // Always available, never null
  remoteDB: PouchDB.Database | null; // Only available when authenticated

  // Auth methods
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;

  // Sync methods
  forceSync: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

//TODO change
const API_URL = import.meta.env.VITE_API_URL;
const LOCAL_DB_NAME = 'chess-training-local';

// Initialize local database IMMEDIATELY - not in useEffect
// This ensures localDB is always available, even before component mounts
// TODO is localDB always working?
// TODO do we want to export this in this way?
export const localDB = new PouchDB(LOCAL_DB_NAME);

// Create indexes for efficient queries
localDB
  .createIndex({
    index: { fields: ['type', 'chapterId'] },
  })
  .catch((err) => console.error('Failed to create index:', err));

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ state: 'idle' });

  const [remoteDB, setRemoteDB] = useState<PouchDB.Database | null>(null);
  const [syncHandler, setSyncHandler] = useState<PouchDB.Replication.Sync<{}> | null>(null);

  // Check authentication status on mount
  useEffect(() => {
    checkAuth();
  }, []);

  /**
   * Check if user is authenticated
   */
  const checkAuth = async () => {
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);

        // Set up sync with stored credentials
        await setupSync(data.database);
      }
    } catch (err) {
      console.log('Not authenticated');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Sign in with Google
   */
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
              setUser(data.user);

              // Set up sync
              await setupSync(data.database, data.database.password);

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
  const signOut = async () => {
    try {
      // Stop sync
      if (syncHandler) {
        syncHandler.cancel();
        setSyncHandler(null);
      }

      // Close remote DB
      if (remoteDB) {
        await remoteDB.close();
        setRemoteDB(null);
      }

      // Clear user
      setUser(null);
      setSyncStatus({ state: 'idle' });

      // Call backend logout
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  /**
   * Set up PouchDB sync
   */
  const setupSync = async (dbConfig: DatabaseConfig, password?: string) => {
    try {
      // Get credentials if not provided
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

      // Create remote database connection
      const remote = new PouchDB(dbConfig.url, {
        auth,
        skip_setup: true,
      });

      setRemoteDB(remote);

      // FIRST: Pull all existing data from remote to local
      // This ensures data is available immediately when loading
      console.log('Pulling initial data from remote...');
      setSyncStatus({ state: 'syncing' });
      await localDB.replicate.from(remote);
      console.log('Initial data pull complete');

      // Update status to indicate data is ready
      setSyncStatus({
        state: 'synced',
        lastSync: new Date(),
      });

      // THEN: Start continuous live sync for ongoing updates
      const sync = localDB.sync(remote, {
        live: true,
        retry: true,
      });

      // Set up event handlers
      sync.on('change', (info) => {
        setSyncStatus((prev) => ({
          ...prev,
          state: 'syncing',
          changesReceived:
            (prev.changesReceived || 0) + (info.direction === 'pull' ? info.change.docs.length : 0),
          changesSent: (prev.changesSent || 0) + (info.direction === 'push' ? info.change.docs.length : 0),
        }));
    });

      // Set up event handlers
      sync.on('change', (info) => {
        setSyncStatus((prev) => ({
          ...prev,
          state: 'syncing',
          changesReceived:
            (prev.changesReceived || 0) + (info.direction === 'pull' ? info.change.docs.length : 0),
          changesSent: (prev.changesSent || 0) + (info.direction === 'push' ? info.change.docs.length : 0),
        }));
      });

      sync.on('paused', () => {
        setSyncStatus((prev) => ({
          ...prev,
          state: 'synced',
          lastSync: new Date(),
        }));
      });

      sync.on('active', () => {
        setSyncStatus((prev) => ({
          ...prev,
          state: 'syncing',
          error: undefined,
        }));
      });

      sync.on('error', (err) => {
        console.error('Sync error:', err);
        setSyncStatus((prev) => ({
          ...prev,
          state: 'error',
          error: err.message,
        }));
      });

      setSyncHandler(sync);
    } catch (err) {
      console.error('Sync setup error:', err);
      setSyncStatus({
        state: 'error',
        error: err instanceof Error ? err.message : 'Sync setup failed',
      });
    }
  };

  /**
   * Force immediate sync
   */
  const forceSync = useCallback(async () => {
    if (!remoteDB) {
      throw new Error('Cannot sync: not authenticated');
    }

    setSyncStatus((prev) => ({ ...prev, state: 'syncing' }));

    try {
      await localDB.replicate.to(remoteDB);
      await localDB.replicate.from(remoteDB);

      setSyncStatus((prev) => ({
        ...prev,
        state: 'synced',
        lastSync: new Date(),
      }));
    } catch (err) {
      setSyncStatus({
        state: 'error',
        error: err instanceof Error ? err.message : 'Sync failed',
      });
      throw err;
    }
  }, [remoteDB]);

  // TODO can also store pfp!
  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    syncStatus,
    localDB, // Always available - constant, not state
    remoteDB,
    signInWithGoogle,
    signOut,
    forceSync,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
