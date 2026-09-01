import React, { useState, useRef, useEffect } from 'react';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

interface DropdownProps {
  value: string | number;
  options: Array<DropdownOption>;
  onChange: (value: string | number) => void;
  placeholder?: string;
  headerContent?: React.ReactNode;
  hideArrow?: boolean;
  className?: string;
  title?: string;
  disabled?: boolean;
  searchable?: boolean;
}

interface DropdownOption {
  value: string | number;
  label: string;
  icon?: string | React.ElementType;
}

const Dropdown = ({
  value,
  options,
  onChange,
  placeholder = "Select...",
  headerContent,
  hideArrow = false,
  className = "",
  title = "",
  disabled = false,
  searchable = false,
}: DropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setFocusedIndex(-1);
    }
  }, [isOpen]);

  useEffect(() => {
    setFocusedIndex(-1);
  }, [searchQuery]);

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = searchable
    ? options.filter((opt) =>
        opt.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : options;
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < filteredOptions.length) {
          onChange(filteredOptions[focusedIndex].value);
          setIsOpen(false);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
      case 'Tab':
        setIsOpen(false);
        break;
    }
  };

  useEffect(() => {
    if (focusedIndex >= 0 && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const item = container.children[focusedIndex] as HTMLElement;
      if (item) {
        const itemTop = item.offsetTop;
        const itemBottom = itemTop + item.offsetHeight;
        const containerTop = container.scrollTop;
        const containerBottom = containerTop + container.offsetHeight;

        if (itemTop < containerTop) {
          container.scrollTop = itemTop;
        } else if (itemBottom > containerBottom) {
          container.scrollTop = itemBottom - container.offsetHeight;
        }
      }
    }
  }, [focusedIndex]);

  // Helper to render the icon slot
  const renderIcon = (Icon: DropdownOption['icon']) => {
    if (!Icon) return null;
    return (
      <div className="flex items-center justify-center w-5 h-5 shrink-0">
        {typeof Icon === 'string' ? (
          <span className="text-[10px] font-bold">{Icon}</span>
        ) : (
          <Icon sx={{ fontSize: 18 }} />
        )}
      </div>
    );
  };

  return (
    <div 
      className="relative inline-block w-full" 
      ref={dropdownRef}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        title={title}
        disabled={disabled}
        className={`flex items-center justify-between group/dropdown-header ${hideArrow ? "p-1.5" : "min-w-[120px] px-3 py-2"} gap-2 text-sm font-medium bg-mainBg border border-border text-textSecondary hover:text-textPrimary rounded-lg transition-all w-full ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <div className="flex items-center gap-2 truncate w-full">
          {headerContent ? (
            headerContent
          ) : (
            <>
              {selectedOption && renderIcon(selectedOption.icon)}
              <span className="truncate">
                {selectedOption ? selectedOption.label : placeholder}
              </span>
            </>
          )}
        </div>
        {!hideArrow && (
          <ExpandMoreIcon
            className={`text-textSecondary transform-gpu duration-200 transition-transform ease-in-out ${isOpen ? "rotate-180" : ""}`}
            fontSize="small"
          />
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-full min-w-[200px] bg-secondaryBg border border-border shadow-2xl rounded-xl overflow-hidden z-[100] animate-in fade-in zoom-in-95 duration-100">
          {searchable && (
            <div className="p-2 border-b border-border bg-mainBg/50">
              <input
                type="text"
                autoFocus
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-mainBg border border-border rounded-md px-3 py-1.5 text-sm text-textPrimary placeholder-textMuted focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
          )}
          <div 
            ref={scrollContainerRef}
            className="max-h-60 overflow-y-auto custom-scrollbar"
          >
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-sm flex gap-3 transition-colors ${
                    focusedIndex === filteredOptions.indexOf(opt) ? 'bg-border/60 text-textPrimary' : 'hover:bg-border/40 text-textSecondary'
                  } ${value === opt.value ? 'bg-primary/5 text-primary font-semibold' : ''}`}
                >
                  {renderIcon(opt.icon)}
                  <span className="truncate">{opt.label}</span>
                </button>
              ))
            ) : (
              <div className="px-4 py-3 text-xs text-textMuted text-center">
                No results found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dropdown;