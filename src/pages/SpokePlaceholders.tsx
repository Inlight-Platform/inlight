import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

interface SpokePlaceholderProps {
  title: string;
  color: string;
}

const SpokePlaceholder: React.FC<SpokePlaceholderProps> = ({ title, color }) => {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-full hover:bg-accent transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-display font-bold">{title}</h1>
        </div>
      </header>
      <main className="flex items-center justify-center min-h-[60vh]">
        <div 
          className="w-24 h-24 rounded-full"
          style={{ backgroundColor: color, boxShadow: `0 0 40px ${color}` }}
        />
      </main>
    </div>
  );
};

export const InsightsPage = () => <SpokePlaceholder title="Insights" color="#FFD400" />;
export const EventsPage = () => <SpokePlaceholder title="Events" color="#FF6B2D" />;
export const OpportunitiesPage = () => <SpokePlaceholder title="Opportunities" color="#00FF87" />;
export const MessagesPage = () => <SpokePlaceholder title="Messages" color="#AE6DFF" />;
export const ResourcesPage = () => <SpokePlaceholder title="Resources" color="#39FFDC" />;
