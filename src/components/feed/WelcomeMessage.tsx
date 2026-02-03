import React from 'react';
import { Sparkles } from 'lucide-react';

export const WelcomeMessage: React.FC = () => {
  return (
    <div className="mb-6 p-4 rounded-xl border border-border bg-gradient-to-br from-primary/5 to-accent/5">
      <div className="flex items-start gap-3">
        <div 
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ 
            background: 'linear-gradient(135deg, hsl(330 100% 64%), hsl(350 100% 70%))',
            boxShadow: '0 0 15px hsl(330 100% 64% / 0.3)'
          }}
        >
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="font-semibold text-lg mb-1">Welcome to Inlight!</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We're so glad to have you here. Explore the current happenings in your community and in the wider industry. 
            Create your own projects, teams, events and reputation here.
          </p>
        </div>
      </div>
    </div>
  );
};
