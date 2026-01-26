import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ClipboardList, Clapperboard, Film, Archive } from 'lucide-react';

type ProjectStatus = 'planning' | 'active' | 'wrapping' | 'archived';

interface ProjectStatusDropdownProps {
  projectId: string;
  currentStatus: string;
  disabled?: boolean;
}

const statusOptions: { value: ProjectStatus; label: string; icon: React.ElementType }[] = [
  { value: 'planning', label: 'Planning', icon: ClipboardList },
  { value: 'active', label: 'Active', icon: Clapperboard },
  { value: 'wrapping', label: 'Wrapping', icon: Film },
  { value: 'archived', label: 'Archived', icon: Archive },
];

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
  return statusMap[s?.toLowerCase()] || 'planning';
};

export const ProjectStatusDropdown: React.FC<ProjectStatusDropdownProps> = ({
  projectId,
  currentStatus,
  disabled,
}) => {
  const queryClient = useQueryClient();
  const normalizedStatus = normalizeStatus(currentStatus);

  const updateStatus = useMutation({
    mutationFn: async (newStatus: ProjectStatus) => {
      const { error } = await supabase
        .from('projects')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', projectId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      toast.success('Project status updated');
    },
    onError: () => {
      toast.error('Failed to update status');
    },
  });

  return (
    <Select
      value={normalizedStatus}
      onValueChange={(value) => updateStatus.mutate(value as ProjectStatus)}
      disabled={disabled || updateStatus.isPending}
    >
      <SelectTrigger className="w-[160px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {statusOptions.map(option => {
          const Icon = option.icon;
          return (
            <SelectItem key={option.value} value={option.value}>
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4" />
                {option.label}
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
};

export default ProjectStatusDropdown;
