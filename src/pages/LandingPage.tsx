import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, GraduationCap, Briefcase, Users, Film, ArrowRight, ArrowLeft } from 'lucide-react';
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
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{
      background: 'linear-gradient(135deg, hsl(222 35% 6%) 0%, hsl(222 38% 5%) 40%, hsl(195 35% 8%) 100%)',
      backgroundSize: '400% 400%',
      animation: 'landing-bg-shift 20s ease infinite',
    }}>
      <style>{`
        @keyframes landing-bg-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .spotlight-card {
          position: relative;
          overflow: hidden;
        }
        .spotlight-card::after {
          content: '';
          position: absolute;
          top: -50%;
          left: -75%;
          width: 50%;
          height: 200%;
          background: linear-gradient(90deg, transparent, hsl(45 95% 58% / 0.07), transparent);
          transform: skewX(-20deg);
          transition: left 0.6s ease;
          pointer-events: none;
        }
        .spotlight-card:hover::after {
          left: 125%;
        }
      `}</style>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-2xl space-y-10">
          {/* Hero text */}
          <div className="space-y-4 text-center">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground font-['Space_Grotesk']">
              Welcome to Inlight
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto">
              Where university creatives connect, collaborate, and come to life.
            </p>
            <p className="text-sm font-medium text-accent italic">Made for the makers.</p>
          </div>

          {/* Features */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="spotlight-card border-border bg-card">
              <CardContent className="pt-6 text-center space-y-2">
                <Briefcase className="h-6 w-6 mx-auto text-primary" />
                <p className="text-sm text-foreground">Find and post jobs, events, and projects.</p>
              </CardContent>
            </Card>
            <Card className="spotlight-card border-border bg-card">
              <CardContent className="pt-6 text-center space-y-2">
                <Users className="h-6 w-6 mx-auto text-primary" />
                <p className="text-sm text-foreground">Look up people at your school.</p>
              </CardContent>
            </Card>
            <Card className="spotlight-card border-border bg-card">
              <CardContent className="pt-6 text-center space-y-2">
                <Film className="h-6 w-6 mx-auto text-primary" />
                <p className="text-sm text-foreground">Discover professional shows, films, and companies.</p>
              </CardContent>
            </Card>
          </div>

          {/* Auth section */}
          <div className="flex flex-col items-center gap-3">
            <Button className="w-full max-w-xs" onClick={() => navigate('/auth')}>
              Log in or Sign Up <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <GraduationCap className="h-3 w-3" />
              Only .edu emails are allowed
            </p>
          </div>

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
