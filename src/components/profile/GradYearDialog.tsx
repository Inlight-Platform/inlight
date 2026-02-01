import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GraduationCap, Save, X } from 'lucide-react';
import { toast } from 'sonner';

interface GradYearDialogProps {
  currentStatus: string | null;
  currentYear: number | null;
  onSave: (status: string, year: number) => Promise<boolean>;
  onClear?: () => Promise<boolean>;
  disabled?: boolean;
  trigger?: React.ReactNode;
}

export const GradYearDialog: React.FC<GradYearDialogProps> = ({
  currentStatus,
  currentYear,
  onSave,
  onClear,
  disabled = false,
  trigger,
}) => {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<string>(currentStatus || '');
  const [year, setYear] = useState<string>(currentYear?.toString() || '');
  const [saving, setSaving] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setStatus(currentStatus || '');
      setYear(currentYear?.toString() || '');
    }
  }, [open, currentStatus, currentYear]);

  // Generate years from current year - 10 to current year + 10
  const currentCalendarYear = new Date().getFullYear();
  const years = Array.from({ length: 21 }, (_, i) => currentCalendarYear - 10 + i);

  const handleSave = async () => {
    if (!status) {
      toast.error('Please select student or alumni');
      return;
    }
    if (!year) {
      toast.error('Please select a year');
      return;
    }

    setSaving(true);
    const success = await onSave(status, parseInt(year));
    setSaving(false);

    if (success) {
      setOpen(false);
    }
  };

  const handleClear = async () => {
    if (!onClear) return;
    
    setSaving(true);
    const success = await onClear();
    setSaving(false);

    if (success) {
      setStatus('');
      setYear('');
      setOpen(false);
    }
  };

  const getDisplayLabel = () => {
    if (!currentStatus || !currentYear) return 'Grad Year';
    return `${currentStatus === 'student' ? 'Student' : 'Alumni'} '${currentYear.toString().slice(-2)}`;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            className="gap-2"
          >
            <GraduationCap className="w-4 h-4" />
            {getDisplayLabel()}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5" />
            Graduation Year
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="student">Student</SelectItem>
                <SelectItem value="alumni">Alumni</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              {status === 'student' ? 'Expected Graduation Year' : 'Graduation Year'}
            </label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger>
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent className="max-h-[200px]">
                {years.map((y) => (
                  <SelectItem key={y} value={y.toString()}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-between gap-2">
          {currentStatus && onClear && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              disabled={saving}
              className="text-destructive hover:text-destructive"
            >
              <X className="w-4 h-4 mr-1" />
              Clear
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !status || !year}>
              <Save className="w-4 h-4 mr-1" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
