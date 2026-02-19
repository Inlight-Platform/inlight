import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, GraduationCap, Briefcase, Calendar, Users, Film, ArrowRight } from 'lucide-react';
import inlightLogo from '@/assets/inlight-logo.png';

const LandingPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'info' | 'signup'>('info');

  const { signUp } = useAuth();
  const navigate = useNavigate();

  const validateEduEmail = (email: string): boolean => {
    const allowedEmails = ['info@inlight.social', 'alabfestival@gmail.com'];
    return email.toLowerCase().endsWith('.edu') || allowedEmails.includes(email.toLowerCase());
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateEduEmail(email)) {
      toast.error('Only .edu email addresses are allowed to sign up.');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);
    const { error } = await signUp(email, password, displayName);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Account created! Welcome to Inlight.');
      navigate('/');
    }
    setIsLoading(false);
  };

  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="w-full px-6 py-4 flex items-center justify-end max-w-5xl mx-auto">
        <Button variant="outline" size="sm" onClick={() => navigate('/auth')}>
          Log in
        </Button>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-4 pb-16">
        <div className="w-full max-w-2xl space-y-10">
          {/* Hero text */}
          <div className="space-y-6 text-center">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground font-['Space_Grotesk']">
            Welcome to Inlight
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto">
              Inlight is an interactive community platform for entertainment professionals in university programs.
            </p>
          </div>

          {/* Features */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="border-border bg-card">
              <CardContent className="pt-6 text-center space-y-2">
                <Briefcase className="h-6 w-6 mx-auto text-primary" />
                <p className="text-sm text-foreground">Find and post jobs, events, and projects.</p>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardContent className="pt-6 text-center space-y-2">
                <Users className="h-6 w-6 mx-auto text-primary" />
                <p className="text-sm text-foreground">Look up people at your school.</p>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardContent className="pt-6 text-center space-y-2">
                <Film className="h-6 w-6 mx-auto text-primary" />
                <p className="text-sm text-foreground">Discover professional shows, films, and companies.</p>
              </CardContent>
            </Card>
          </div>

          {/* Signup section */}
          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              {mode === 'info' ? (
                <div className="flex flex-col items-center gap-4">
                  <Button className="w-full max-w-xs" onClick={() => setMode('signup')}>
                    Create an Account <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <GraduationCap className="h-3 w-3" />
                    Only .edu emails are allowed
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSignup} className="space-y-4 max-w-sm mx-auto">
                  <div className="space-y-2">
                    <Label htmlFor="landing-name">Display Name</Label>
                    <Input
                      id="landing-name"
                      type="text"
                      placeholder="Jane Doe"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="landing-email">Email</Label>
                    <Input
                      id="landing-email"
                      type="email"
                      placeholder="you@university.edu"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <GraduationCap className="h-3 w-3" />
                      Only .edu emails are allowed
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="landing-password">Password</Label>
                    <Input
                      id="landing-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                    <p className="text-xs text-muted-foreground">Minimum 6 characters</p>
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      'Create Account'
                    )}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => setMode('info')}>
                    Cancel
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Disclaimer */}
          <p className="text-xs text-muted-foreground text-center leading-relaxed max-w-lg mx-auto">
            This is a platform designed by students, for students, and is not officially affiliated with New York University as of {today}.
          </p>
        </div>
      </main>
    </div>
  );
};

export default LandingPage;
