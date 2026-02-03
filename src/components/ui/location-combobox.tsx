import * as React from "react";
import { Check, ChevronsUpDown, MapPin, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ENTERTAINMENT_CITIES } from "@/data/entertainmentCities";

interface LocationComboboxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function LocationCombobox({ 
  value, 
  onChange,
  placeholder = "Select location..."
}: LocationComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");

  // Filter cities based on input
  const filteredCities = React.useMemo(() => {
    if (!inputValue.trim()) return ENTERTAINMENT_CITIES.slice(0, 20);
    const query = inputValue.toLowerCase();
    return ENTERTAINMENT_CITIES.filter(city => 
      city.toLowerCase().includes(query)
    ).slice(0, 20);
  }, [inputValue]);

  // Check if current input is a custom location (not in predefined list)
  const isCustomLocation = inputValue.trim() && 
    !ENTERTAINMENT_CITIES.some(city => 
      city.toLowerCase() === inputValue.toLowerCase()
    );

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue);
    setInputValue("");
    setOpen(false);
  };

  const handleAddCustom = () => {
    if (inputValue.trim()) {
      onChange(inputValue.trim());
      setInputValue("");
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-10 font-normal"
        >
          <div className="flex items-center gap-2 truncate">
            <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className={cn(!value && "text-muted-foreground")}>
              {value || placeholder}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-popover" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Search cities..." 
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList>
            <CommandEmpty className="py-2 px-3 text-sm text-muted-foreground">
              No cities found.
            </CommandEmpty>
            <CommandGroup>
              {filteredCities.map((city) => (
                <CommandItem
                  key={city}
                  value={city}
                  onSelect={() => handleSelect(city)}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === city ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {city}
                </CommandItem>
              ))}
            </CommandGroup>
            {/* Custom location option */}
            {isCustomLocation && (
              <CommandGroup>
                <CommandItem
                  onSelect={handleAddCustom}
                  className="cursor-pointer text-primary"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add "{inputValue.trim()}"
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
