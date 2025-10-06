import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

const Auth = () => {
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, loading: authLoading, signIn, signUp } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    console.log('[Auth] Current user:', user?.email, 'Auth loading:', authLoading);
    if (!authLoading && user) {
      console.log('[Auth] User is logged in, redirecting to main page');
      navigate('/');
    }
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[Auth] Form submitted, isSignUp:', isSignUp);
    setLoading(true);

    try {
      if (isSignUp) {
        console.log('[Auth] Calling signUp');
        await signUp(email, password);
        toast.success('Konto erstellt! Bitte bestätigen Sie Ihre E-Mail.');
      } else {
        console.log('[Auth] Calling signIn');
        const result = await signIn(email, password);
        console.log('[Auth] Sign in result:', result);
        toast.success('Erfolgreich angemeldet!');
        
        // Force navigation after successful login
        console.log('[Auth] Navigating to main page after successful login');
        setTimeout(() => {
          navigate('/');
        }, 100);
      }
    } catch (error: any) {
      console.error('[Auth] Authentication error:', error);
      toast.error(error.message || 'Ein Fehler ist aufgetreten');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Lädt...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-5">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">
            🚌 Busplanungs-Management
          </CardTitle>
          <CardDescription className="text-center">
            {isSignUp ? 'Erstellen Sie ein neues Konto' : 'Melden Sie sich an'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-Mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Passwort</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Lädt...' : isSignUp ? 'Registrieren' : 'Anmelden'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setIsSignUp(!isSignUp)}
            >
              {isSignUp ? 'Haben Sie bereits ein Konto? Anmelden' : 'Neues Konto erstellen'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
