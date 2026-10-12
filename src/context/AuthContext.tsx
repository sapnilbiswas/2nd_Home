import React, { createContext, useContext, useEffect, useState } from 'react';
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

  // Fetch profile and check must_change_password metadata
  const fetchUserProfile = async (userId: string, currentUser?: User) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('Error fetching profile:', error.message);
      }

      if (data) {
        setProfile(data as Profile);
        setRole(data.role as UserRole);
      } else {
        // Fallback role if profile not yet created
        setRole('tenant');
      }

      // Check user metadata for forced password change
      const targetUser = currentUser || user;
      const requiresChange = Boolean(
        targetUser?.user_metadata?.must_change_password === true
      );
      setMustChangePassword(requiresChange);
    } catch (err) {
      console.error('fetchUserProfile error:', err);
    }
  };

  useEffect(() => {
    // 1. Initial session restore
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      if (initialSession?.user) {
        fetchUserProfile(initialSession.user.id, initialSession.user).finally(() => {
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    // 2. Auth state change listener
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          await fetchUserProfile(currentSession.user.id, currentSession.user);
        } else {
          setProfile(null);
          setRole(null);
          setMustChangePassword(false);
        }
        setLoading(false);
      }
    );

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  // Format identifier: converts phone number (e.g. 9876543210) to phone email alias (9876543210@house.app)
  const formatEmail = (identifier: string): string => {
    const cleaned = identifier.trim().toLowerCase();
    if (cleaned.includes('@')) {
      return cleaned;
    }
    // Only numbers -> phone alias
    const digitsOnly = cleaned.replace(/\D/g, '');
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

      if (data.user) {
        setUser(data.user);
        await fetchUserProfile(data.user.id, data.user);
      }

      setLoading(false);
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
      setSession(null);
      setUser(null);
      setProfile(null);
      setRole(null);
      setMustChangePassword(false);
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchUserProfile(user.id, user);
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
