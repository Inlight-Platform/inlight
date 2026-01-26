import React from 'react';
import { cn } from '@/lib/utils';
import { ClipboardList, Clapperboard, Film, Archive } from 'lucide-react';

type ProjectStatus = 'planning' | 'active' | 'wrapping' | 'archived';

interface ProjectTimelineProps {
  status: ProjectStatus | string;
  className?: string;
}

const stages: { key: ProjectStatus; label: string; icon: React.ElementType }[] = [
  { key: 'planning', label: 'Planning', icon: ClipboardList },
  { key: 'active', label: 'Active', icon: Clapperboard },
  { key: 'wrapping', label: 'Wrapping', icon: Film },
  { key: 'archived', label: 'Archived', icon: Archive },
];

export const ProjectTimeline: React.FC<ProjectTimelineProps> = ({ status, className }) => {
  // Map old status values to new ones
  const normalizeStatus = (s: string): ProjectStatus => {
    const statusMap: Record<string, ProjectStatus> = {
      'pre-production': 'planning',
      'in-production': 'active',
      'post-production': 'wrapping',
      'completed': 'archived',
      'planning': 'planning',
      'active': 'active',
      'wrapping': 'wrapping',
      'archived': 'archived',
    };
    return statusMap[s.toLowerCase()] || 'planning';
  };

  const currentStatus = normalizeStatus(status);
  const currentIndex = stages.findIndex(s => s.key === currentStatus);

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center justify-between relative">
        {/* Progress line background */}
        <div className="absolute top-5 left-0 right-0 h-1 bg-muted rounded-full" />
        
        {/* Progress line filled */}
        <div 
          className="absolute top-5 left-0 h-1 bg-primary rounded-full transition-all duration-500"
          style={{ width: `${(currentIndex / (stages.length - 1)) * 100}%` }}
        />

        {stages.map((stage, index) => {
          const Icon = stage.icon;
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isPending = index > currentIndex;

          return (
            <div key={stage.key} className="flex flex-col items-center relative z-10">
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300',
                  isCompleted && 'bg-primary text-primary-foreground',
                  isCurrent && 'bg-primary text-primary-foreground ring-4 ring-primary/20',
                  isPending && 'bg-muted text-muted-foreground'
                )}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span
                className={cn(
                  'text-xs mt-2 font-medium transition-colors',
                  isCompleted && 'text-primary',
                  isCurrent && 'text-primary',
                  isPending && 'text-muted-foreground'
                )}
              >
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProjectTimeline;
