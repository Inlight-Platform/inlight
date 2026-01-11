import React, { useState, useRef } from 'react';
import { X, Upload, Loader2, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { OpportunityType, PaidStatus, UnionStatus, CompensationPer, useOpportunitiesStore } from '@/store/opportunitiesStore';
import { useStore, UserRole } from '@/store/useStore';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, addDays } from 'date-fns';

const opportunitySchema = z.object({
  title: z.string().min(1, 'Title is required').max(80, 'Title must be 80 characters or less'),
  companyName: z.string().min(1, 'Company name is required'),
  typeTag: z.enum(['Gig', 'Short Film', 'Feature', 'Touring', 'Remote Session']),
  roleTags: z.array(z.enum(['Actor', 'Producer', 'Director', 'Musician'])).min(1, 'Select at least one role'),
  paidStatus: z.enum(['Paid', 'Unpaid']),
  unionStatus: z.enum(['Union', 'Non-Union', 'Open']),
  isRemote: z.boolean(),
  location: z.string().optional(),
  deadline: z.date().min(addDays(new Date(), 1), 'Deadline must be at least tomorrow'),
  description: z.string().min(100, 'Description must be at least 100 characters'),
  requirements: z.string().min(1, 'At least one requirement is needed'),
  compensation: z.string().optional(),
  compensationMin: z.number().optional(),
  compensationMax: z.number().optional(),
  compensationPer: z.enum(['Day', 'Week', 'Flat']).optional(),
  applicationUrl: z.string().url().optional().or(z.literal('')),
});

interface PostOpportunityModalProps {
  open: boolean;
  onClose: () => void;
}

const typeOptions: OpportunityType[] = ['Gig', 'Short Film', 'Feature', 'Touring', 'Remote Session'];
const roleOptions: UserRole[] = ['Actor', 'Producer', 'Director', 'Musician'];
const unionOptions: UnionStatus[] = ['Union', 'Non-Union', 'Open'];
const perOptions: CompensationPer[] = ['Day', 'Week', 'Flat'];

const stubLocations = ['Los Angeles, CA', 'New York, NY', 'Atlanta, GA', 'Chicago, IL', 'Austin, TX'];

const PostOpportunityModal: React.FC<PostOpportunityModalProps> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const { createOpportunity } = useOpportunitiesStore();
  const { currentUserId } = useStore();
  const { toast } = useToast();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Form state
  const [title, setTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [typeTag, setTypeTag] = useState<OpportunityType>('Gig');
  const [roleTags, setRoleTags] = useState<UserRole[]>([]);
  const [isPaid, setIsPaid] = useState(true);
  const [unionStatus, setUnionStatus] = useState<UnionStatus>('Open');
  const [isRemote, setIsRemote] = useState(false);
  const [location, setLocation] = useState('');
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [deadline, setDeadline] = useState<Date | undefined>();
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [compensation, setCompensation] = useState('');
  const [compensationMin, setCompensationMin] = useState('');
  const [compensationMax, setCompensationMax] = useState('');
  const [compensationPer, setCompensationPer] = useState<CompensationPer>('Day');
  const [applicationUrl, setApplicationUrl] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  
  const logoInputRef = useRef<HTMLInputElement>(null);
  
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast({ title: 'File too large', description: 'Logo must be under 2MB', variant: 'destructive' });
        return;
      }
      if (!file.type.includes('image')) {
        toast({ title: 'Invalid file type', description: 'Please upload an image', variant: 'destructive' });
        return;
      }
      setLogoFile(file);
      
      const reader = new FileReader();
      reader.onload = () => setLogoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };
  
  const toggleRole = (role: UserRole) => {
    setRoleTags(prev => 
      prev.includes(role) 
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };
  
  const validateForm = () => {
    const formData = {
      title,
      companyName,
      typeTag,
      roleTags,
      paidStatus: isPaid ? 'Paid' : 'Unpaid' as PaidStatus,
      unionStatus,
      isRemote,
      location: isRemote ? undefined : location,
      deadline: deadline || new Date(),
      description,
      requirements,
      compensation: isPaid ? compensation : undefined,
      compensationMin: compensationMin ? parseFloat(compensationMin) : undefined,
      compensationMax: compensationMax ? parseFloat(compensationMax) : undefined,
      compensationPer: isPaid ? compensationPer : undefined,
      applicationUrl: applicationUrl || undefined,
    };
    
    try {
      opportunitySchema.parse(formData);
      setErrors({});
      return true;
    } catch (e) {
      if (e instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        e.errors.forEach(err => {
          const path = err.path.join('.');
          newErrors[path] = err.message;
        });
        setErrors(newErrors);
      }
      return false;
    }
  };
  
  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    
    // Simulate upload delay
    await new Promise(r => setTimeout(r, 1000));
    
    const requirementsList = requirements
      .split('\n')
      .map(r => r.trim())
      .filter(r => r.length > 0);
    
    const id = createOpportunity({
      title,
      companyName,
      typeTag,
      paidStatus: isPaid ? 'Paid' : 'Unpaid',
      unionStatus,
      deadline: deadline!.toISOString(),
      logoURL: logoPreview || undefined,
      posterUserId: currentUserId,
      roleTags,
      isRemote,
      location: isRemote ? undefined : location,
      description,
      requirements: requirementsList,
      compensation: isPaid ? compensation : undefined,
      compensationMin: compensationMin ? parseFloat(compensationMin) : undefined,
      compensationMax: compensationMax ? parseFloat(compensationMax) : undefined,
      compensationPer: isPaid ? compensationPer : undefined,
      applicationUrl: applicationUrl || undefined,
    });
    
    setIsSubmitting(false);
    onClose();
    
    toast({
      title: 'Opportunity live!',
      description: 'Your opportunity has been posted.',
    });
    
    navigate(`/opportunities?tab=posts&highlight=${id}`);
  };
  
  const isValid = title && companyName && roleTags.length > 0 && deadline && description.length >= 100 && requirements;
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Post an Opportunity</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[calc(90vh-140px)]">
          <div className="p-6 space-y-6">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 80))}
                placeholder="e.g., Lead Actor for Indie Thriller"
                aria-describedby={errors.title ? 'title-error' : undefined}
                className={cn(errors.title && 'border-destructive')}
              />
              <div className="flex justify-between">
                {errors.title && <p id="title-error" className="text-xs text-destructive">{errors.title}</p>}
                <p className="text-xs text-muted-foreground ml-auto">{title.length}/80</p>
              </div>
            </div>
            
            {/* Company */}
            <div className="space-y-2">
              <Label htmlFor="company">
                Production / Company <span className="text-destructive">*</span>
              </Label>
              <Input
                id="company"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g., Midnight Productions"
                className={cn(errors.companyName && 'border-destructive')}
              />
              {errors.companyName && <p className="text-xs text-destructive">{errors.companyName}</p>}
            </div>
            
            {/* Type */}
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={typeTag} onValueChange={(v) => setTypeTag(v as OpportunityType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {typeOptions.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Roles */}
            <div className="space-y-2">
              <Label>
                Role tags <span className="text-destructive">*</span>
              </Label>
              <div className="flex flex-wrap gap-2">
                {roleOptions.map(role => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => toggleRole(role)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                      roleTags.includes(role)
                        ? "bg-[#00FF87] text-black"
                        : "bg-secondary text-secondary-foreground hover:bg-accent"
                    )}
                    aria-pressed={roleTags.includes(role)}
                  >
                    {role}
                  </button>
                ))}
              </div>
              {errors.roleTags && <p className="text-xs text-destructive">{errors.roleTags}</p>}
            </div>
            
            {/* Paid toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="paid">Paid opportunity</Label>
              <Switch
                id="paid"
                checked={isPaid}
                onCheckedChange={setIsPaid}
                aria-pressed={isPaid}
              />
            </div>
            
            {/* Compensation (if paid) */}
            {isPaid && (
              <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                <div className="space-y-2">
                  <Label htmlFor="compensation">Compensation details</Label>
                  <Textarea
                    id="compensation"
                    value={compensation}
                    onChange={(e) => setCompensation(e.target.value.slice(0, 500))}
                    placeholder="Describe compensation..."
                    className="min-h-[80px]"
                  />
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="min">Min ($)</Label>
                    <Input
                      id="min"
                      type="number"
                      value={compensationMin}
                      onChange={(e) => setCompensationMin(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max">Max ($)</Label>
                    <Input
                      id="max"
                      type="number"
                      value={compensationMax}
                      onChange={(e) => setCompensationMax(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="per">Per</Label>
                    <Select value={compensationPer} onValueChange={(v) => setCompensationPer(v as CompensationPer)}>
                      <SelectTrigger id="per">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {perOptions.map(per => (
                          <SelectItem key={per} value={per}>{per}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
            
            {/* Union status */}
            <div className="space-y-2">
              <Label>Union status</Label>
              <Select value={unionStatus} onValueChange={(v) => setUnionStatus(v as UnionStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {unionOptions.map(status => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Remote toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="remote">Remote position</Label>
              <Switch
                id="remote"
                checked={isRemote}
                onCheckedChange={setIsRemote}
                aria-pressed={isRemote}
              />
            </div>
            
            {/* Location (if not remote) */}
            {!isRemote && (
              <div className="space-y-2 relative">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => {
                    setLocation(e.target.value);
                    setShowLocationSuggestions(true);
                  }}
                  onFocus={() => setShowLocationSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowLocationSuggestions(false), 200)}
                  placeholder="City, State"
                />
                {showLocationSuggestions && location && (
                  <div className="absolute z-10 w-full mt-1 bg-popover border rounded-lg shadow-lg">
                    {stubLocations
                      .filter(l => l.toLowerCase().includes(location.toLowerCase()))
                      .map(loc => (
                        <button
                          key={loc}
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                          onMouseDown={() => {
                            setLocation(loc);
                            setShowLocationSuggestions(false);
                          }}
                        >
                          {loc}
                        </button>
                      ))
                    }
                  </div>
                )}
              </div>
            )}
            
            {/* Deadline */}
            <div className="space-y-2">
              <Label>
                Deadline <span className="text-destructive">*</span>
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !deadline && "text-muted-foreground",
                      errors.deadline && "border-destructive"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {deadline ? format(deadline, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={deadline}
                    onSelect={setDeadline}
                    disabled={(date) => date < addDays(new Date(), 1)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {errors.deadline && <p className="text-xs text-destructive">{errors.deadline}</p>}
            </div>
            
            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">
                Description <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the opportunity in detail. Use **bold** for emphasis."
                className={cn("min-h-[150px]", errors.description && 'border-destructive')}
              />
              <div className="flex justify-between">
                {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
                <p className={cn(
                  "text-xs ml-auto",
                  description.length < 100 ? "text-muted-foreground" : "text-[#00FF87]"
                )}>
                  {description.length}/100 min
                </p>
              </div>
            </div>
            
            {/* Requirements */}
            <div className="space-y-2">
              <Label htmlFor="requirements">
                Requirements <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="requirements"
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                placeholder="Enter each requirement on a new line"
                className={cn("min-h-[100px]", errors.requirements && 'border-destructive')}
              />
              {errors.requirements && <p className="text-xs text-destructive">{errors.requirements}</p>}
            </div>
            
            {/* Application URL */}
            <div className="space-y-2">
              <Label htmlFor="appUrl">Application URL (optional)</Label>
              <Input
                id="appUrl"
                type="url"
                value={applicationUrl}
                onChange={(e) => setApplicationUrl(e.target.value)}
                placeholder="https://..."
              />
              <p className="text-xs text-muted-foreground">Leave empty to receive applications via Inlight inbox</p>
            </div>
            
            {/* Logo upload */}
            <div className="space-y-2">
              <Label>Logo (optional)</Label>
              <div 
                className={cn(
                  "relative border-2 border-dashed rounded-lg p-4 transition-colors cursor-pointer",
                  logoPreview ? "border-[#00FF87] bg-[#00FF87]/5" : "border-border hover:border-muted-foreground"
                )}
                onClick={() => logoInputRef.current?.click()}
              >
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={handleLogoUpload}
                  className="hidden"
                  aria-label="Upload company logo"
                />
                {logoPreview ? (
                  <div className="flex items-center gap-3">
                    <img src={logoPreview} alt="Logo preview" className="w-16 h-16 rounded-lg object-cover" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{logoFile?.name}</p>
                      <p className="text-xs text-muted-foreground">Click to change</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLogoFile(null);
                        setLogoPreview(null);
                      }}
                      className="p-1 hover:bg-muted rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-center">
                    <Upload className="w-8 h-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Click to upload (JPG/PNG, max 2MB)
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
        
        {/* Actions */}
        <div className="p-6 pt-0 flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting}
            className="flex-1 bg-[#00FF87] text-black hover:bg-[#00FF87]/90"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Posting...
              </>
            ) : (
              'Post Opportunity'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PostOpportunityModal;
