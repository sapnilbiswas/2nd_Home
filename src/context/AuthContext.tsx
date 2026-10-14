import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../api/supabase';
import { Profile, UserRole } from '../types/database';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  role: UserRole | null;
  mustChangePassword: boolean;
  loading: boolean;
  signIn: (identifier: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  completePasswordChange: (newPassword: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const authenticatedUserId = useRef<string | null>(null);

  // This function deliberately runs outside of onAuthStateChange. Supabase holds an
  // internal auth lock while notifying subscribers, so database calls in the
  // subscriber can deadlock authentication and leave the app on the login screen.
  const fetchUserProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('Error fetching profile:', error.message);
        // A newly provisioned account can briefly exist before its profile row is
        // available. Keep the existing tenant fallback rather than blocking login.
        if (authenticatedUserId.current === userId) {
          setProfile(null);
          setRole('tenant');
        }
        return;
      }

      if (authenticatedUserId.current !== userId) {
        return;
      }

      if (data) {
        setProfile(data as Profile);
        setRole(data.role as UserRole);
      } else {
        // Fallback role if profile not yet created
        setProfile(null);
        setRole('tenant');
      }
    } catch (err) {
      console.error('fetchUserProfile error:', err);
      if (authenticatedUserId.current === userId) {
        // Do not strand a valid session on the loading screen if profile retrieval
        // fails transiently. The app can retry through refreshProfile later.
        setProfile(null);
        setRole('tenant');
      }
    }
  }, []);

  const applyAuthState = useCallback((currentSession: Session | null) => {
    const currentUser = currentSession?.user ?? null;
    const nextUserId = currentUser?.id ?? null;
    const userChanged = authenticatedUserId.current !== nextUserId;

    authenticatedUserId.current = nextUserId;
    setSession(currentSession);
    setUser(currentUser);

    if (userChanged) {
      setProfile(null);
      setRole(null);
    }

    setMustChangePassword(
      currentUser?.user_metadata?.must_change_password === true
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    // Auth callbacks must remain synchronous. See fetchUserProfile for why the
    // profile query is handled by the effect below instead.
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        applyAuthState(currentSession);
      }
    );

    supabase.auth.getSession().then(
      ({ data: { session: initialSession } }) => {
        applyAuthState(initialSession);
      },
      (error: unknown) => {
        console.error('Unable to restore session:', error);
        applyAuthState(null);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [applyAuthState]);

  useEffect(() => {
    if (user) {
      void fetchUserProfile(user.id);
    } else {
      setProfile(null);
      setRole(null);
      setMustChangePassword(false);
    }
  }, [fetchUserProfile, user?.id]);

  // Format identifier: converts phone number (e.g. 9876543210 or +919876543210) to phone email alias (9876543210@house.app)
  // and allows typing "admin" or admin phone directly
  const formatEmail = (identifier: string): string => {
    const cleaned = identifier.trim().toLowerCase();
    if (cleaned === 'admin' || cleaned === '9999999999') {
      return 'admin@house.app';
    }
    if (cleaned.includes('@')) {
      return cleaned;
    }
    let digitsOnly = cleaned.replace(/\D/g, '');
    if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
      digitsOnly = digitsOnly.slice(2);
    } else if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
      digitsOnly = digitsOnly.slice(1);
    }
    if (digitsOnly === '9999999999') {
      return 'admin@house.app';
    }
    return `${digitsOnly}@house.app`;
  };

  const signIn = async (identifier: string, password: string) => {
    setLoading(true);
    try {
      const email = formatEmail(identifier);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setLoading(false);
        return { error };
      }

      if (!data.session) {
        setLoading(false);
        return { error: new Error('Sign in did not create a session. Please try again.') };
      }

      // The event listener normally applies this state, but applying the returned
      // session as well keeps navigation reliable if a native event is delayed.
      applyAuthState(data.session);
      return { error: null };
    } catch (err: any) {
      setLoading(false);
      return { error: err };
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Sign out error:', err);
    } finally {
      applyAuthState(null);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchUserProfile(user.id);
    }
  };

  const completePasswordChange = async (newPassword: string) => {
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
        data: { must_change_password: false },
      });

      if (error) {
        return { error };
      }

      if (data.user) {
        setUser(data.user);
      }
      setMustChangePassword(false);
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        role,
        mustChangePassword,
        loading,
        signIn,
        signOut,
        refreshProfile,
        completePasswordChange,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
