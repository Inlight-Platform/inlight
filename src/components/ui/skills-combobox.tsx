import React, { useState, useMemo } from 'react';
import { Check, Plus } from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ENTERTAINMENT_SKILLS } from '@/data/entertainmentSkills';

interface SkillsComboboxProps {
  existingSkills: string[];
  onAddSkill: (skill: string) => void;
  disabled?: boolean;
}

export const SkillsCombobox: React.FC<SkillsComboboxProps> = ({
  existingSkills,
  onAddSkill,
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  // Filter skills that aren't already added
  const availableSkills = useMemo(() => {
    const existingLower = new Set(existingSkills.map(s => s.toLowerCase()));
    return ENTERTAINMENT_SKILLS.filter(
      skill => !existingLower.has(skill.toLowerCase())
    );
  }, [existingSkills]);

  const handleSelect = (skill: string) => {
    onAddSkill(skill);
    setOpen(false);
    setSearchValue('');
  };

  const handleAddCustom = () => {
    const trimmed = searchValue.trim();
    if (trimmed && !existingSkills.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
      onAddSkill(trimmed);
      setOpen(false);
      setSearchValue('');
    }
  };

  // Check if current search is a custom skill (not in predefined list)
  const isCustomSkill = searchValue.trim() && 
    !ENTERTAINMENT_SKILLS.some(s => s.toLowerCase() === searchValue.trim().toLowerCase()) &&
    !existingSkills.some(s => s.toLowerCase() === searchValue.trim().toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className="h-8 gap-1"
        >
          <Plus className="w-3 h-3" />
          Add Skill
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0 bg-popover border-border z-50" align="start">
        <Command shouldFilter={true}>
          <CommandInput 
            placeholder="Search or type skill..." 
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            <CommandEmpty>
              {isCustomSkill ? (
                <button
                  className="w-full px-3 py-2 text-sm text-left hover:bg-accent cursor-pointer flex items-center gap-2"
                  onClick={handleAddCustom}
                >
                  <Plus className="w-4 h-4" />
                  Add "{searchValue.trim()}"
                </button>
              ) : (
                <p className="py-2 text-center text-sm text-muted-foreground">
                  No skills found.
                </p>
              )}
            </CommandEmpty>
            <CommandGroup>
              {availableSkills.map((skill) => (
                <CommandItem
                  key={skill}
                  value={skill}
                  onSelect={() => handleSelect(skill)}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      existingSkills.includes(skill) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {skill}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
