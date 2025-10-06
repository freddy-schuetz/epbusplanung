import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('[useAuth] Setting up auth listeners');
    
    // Listen for auth changes FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[useAuth] Auth state changed:', event, 'User:', session?.user?.email);
      setUser(session?.user ?? null);
      if (event === 'SIGNED_IN') {
        console.log('[useAuth] User signed in successfully');
      }
    });

    // THEN get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[useAuth] Initial session:', session?.user?.email);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      console.log('[useAuth] Cleaning up auth listeners');
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    console.log('[useAuth] Attempting sign in for:', email);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error('[useAuth] Sign in error:', error);
      throw error;
    }
    console.log('[useAuth] Sign in successful:', data.user?.email);
    return data;
  };

  const signUp = async (email: string, password: string) => {
    console.log('[useAuth] Attempting sign up for:', email);
    const redirectUrl = `${window.location.origin}/`;
    const { data, error } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });
    if (error) {
      console.error('[useAuth] Sign up error:', error);
      throw error;
    }
    console.log('[useAuth] Sign up successful');
    return data;
  };

  const signOut = async () => {
    console.log('[useAuth] Signing out');
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('[useAuth] Sign out error:', error);
      throw error;
    }
    console.log('[useAuth] Sign out successful');
  };

  return { user, loading, signIn, signUp, signOut };
};
