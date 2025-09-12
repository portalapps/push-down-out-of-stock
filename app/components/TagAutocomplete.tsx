// SHOPIFY-STYLE TAG AUTOCOMPLETE COMPONENT
// Mimics the native Shopify admin tag input behavior with smooth autocomplete

// REACT IMPORTS
import { useState, useMemo, useRef, useEffect, useCallback } from "react";

// SHOPIFY POLARIS UI COMPONENTS
import {
  TextField,
  Tag,
  InlineStack,
  BlockStack,
  Button,
} from "@shopify/polaris";
import { PlusIcon } from '@shopify/polaris-icons';

// COMPONENT PROPS INTERFACE
interface TagAutocompleteProps {
  /** All available tags from the store for suggestions */
  availableTags: string[];
  /** Currently selected tags */
  selectedTags: string[];
  /** Callback when a tag is added */
  onAddTag: (tag: string) => void;
  /** Callback when a tag is removed */
  onRemoveTag: (tag: string) => void;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Label for accessibility */
  label?: string;
  /** Whether to hide the label visually */
  labelHidden?: boolean;
  /** Whether the component is disabled */
  disabled?: boolean;
}

export function TagAutocomplete({
  availableTags = [],
  selectedTags = [],
  onAddTag,
  onRemoveTag,
  placeholder = "Add tag",
  label = "Add tag",
  labelHidden = true,
  disabled = false,
}: TagAutocompleteProps) {
  // Validate props
  if (!onAddTag || !onRemoveTag) {
    console.error('TagAutocomplete: onAddTag and onRemoveTag are required props');
    return null;
  }
  // INPUT STATE
  const [inputValue, setInputValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isFocused, setIsFocused] = useState(false);
  const [showInput, setShowInput] = useState(false); // Controls whether the input box is visible
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const [floatingInputPosition, setFloatingInputPosition] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const plusButtonRef = useRef<HTMLButtonElement>(null);

  // FILTER SUGGESTIONS BASED ON INPUT
  const suggestions = useMemo(() => {
    try {
      if (!inputValue?.trim()) {
        // Show first 10 tags when input is focused but empty
        return (availableTags || [])
          .filter(tag => tag && selectedTags && !selectedTags.includes(tag.toLowerCase()))
          .slice(0, 10);
      }
      
      const inputLower = inputValue.toLowerCase().trim();
      const filtered = (availableTags || []).filter(tag => 
        tag && 
        tag.toLowerCase().includes(inputLower) &&
        selectedTags && !selectedTags.includes(tag.toLowerCase())
      );
      
      return filtered; // Show all matching suggestions (scrollable)
    } catch (error) {
      console.error('Error in suggestions filter:', error);
      return [];
    }
  }, [inputValue, availableTags, selectedTags]);

  // CHECK IF CURRENT INPUT IS A NEW TAG
  const isNewTag = useMemo(() => {
    try {
      const trimmedInput = inputValue?.trim()?.toLowerCase() || '';
      return trimmedInput.length > 0 && 
             suggestions && !suggestions.some(tag => tag?.toLowerCase() === trimmedInput) &&
             selectedTags && !selectedTags.includes(trimmedInput);
    } catch (error) {
      console.error('Error in isNewTag calculation:', error);
      return false;
    }
  }, [inputValue, suggestions, selectedTags]);

  // HANDLE TAG SELECTION
  const handleTagSelect = useCallback((tag: string) => {
    try {
      const normalizedTag = tag?.toLowerCase()?.trim() || '';
      if (normalizedTag && selectedTags && !selectedTags.includes(normalizedTag) && onAddTag) {
        onAddTag(normalizedTag);
      }
      setInputValue("");
      setShowSuggestions(false);
      setSelectedIndex(-1);
    } catch (error) {
      console.error('Error in handleTagSelect:', error);
    }
  }, [onAddTag, selectedTags]);

  // HANDLE INPUT SUBMISSION (Enter or comma)
  const handleInputSubmit = useCallback(() => {
    try {
      const normalizedInput = inputValue?.toLowerCase()?.trim() || '';
      if (normalizedInput && selectedTags && !selectedTags.includes(normalizedInput) && onAddTag) {
        onAddTag(normalizedInput);
      }
      setInputValue("");
      setShowSuggestions(false);
      setSelectedIndex(-1);
      setShowInput(false); // Hide input after adding tag
    } catch (error) {
      console.error('Error in handleInputSubmit:', error);
    }
  }, [inputValue, onAddTag, selectedTags]);

  // HANDLE + BUTTON CLICK
  const handlePlusClick = useCallback(() => {
    if (disabled) return;
    
    setShowInput(true);
    setIsFocused(true);
    
    // Calculate floating input position based on + button
    if (plusButtonRef.current) {
      const rect = plusButtonRef.current.getBoundingClientRect();
      setFloatingInputPosition({
        top: rect.bottom + 8, // 8px gap below button
        left: rect.left,
        width: 300, // Fixed width for floating input
      });
    }
    
    // Focus the input after it becomes visible
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select(); // Select any existing text
    }, 50); // Increased timeout to ensure DOM is ready
  }, [disabled]);

  // HANDLE INPUT CLOSE (Escape or click outside)
  const handleInputClose = useCallback(() => {
    setShowInput(false);
    setIsFocused(false);
    setShowSuggestions(false);
    setInputValue("");
    setSelectedIndex(-1);
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    try {
      if (!showSuggestions || totalItems === 0) {
        if (event.key === 'Enter' || event.key === ',') {
          event.preventDefault();
          simpleInputSubmit();
        }
        return;
      }

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setSelectedIndex(prev => 
            prev < totalItems - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          event.preventDefault();
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : totalItems - 1
          );
          break;
        case 'Enter':
          event.preventDefault();
          if (selectedIndex >= 0) {
            if (selectedIndex < suggestions.length && suggestions[selectedIndex]) {
              // Selected an existing suggestion
              handleTagSelect(suggestions[selectedIndex]);
            } else {
              // Selected the "add new tag" option
              simpleInputSubmit();
            }
          } else {
            simpleInputSubmit();
          }
          break;
        case 'Escape':
          handleInputClose();
          break;
        case ',':
          event.preventDefault();
          simpleInputSubmit();
          break;
      }
    } catch (error) {
      console.error('Error in handleKeyDown:', error);
    }
  };

  // UPDATE SUGGESTIONS VISIBILITY
  useEffect(() => {
    // Only show suggestions if input is focused
    const shouldShow = isFocused && (suggestions.length > 0 || isNewTag);
    setShowSuggestions(shouldShow);
    if (!shouldShow) {
      setSelectedIndex(-1);
    }
  }, [suggestions, isNewTag, isFocused]);

  // UPDATE DROPDOWN POSITION WHEN SHOWING
  useEffect(() => {
    const updateDropdownPosition = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + 2,
          left: rect.left,
          width: rect.width
        });
      }
    };

    if (showSuggestions) {
      updateDropdownPosition();
      
      // Update position on scroll/resize
      window.addEventListener('scroll', updateDropdownPosition, { passive: true });
      window.addEventListener('resize', updateDropdownPosition);
      
      return () => {
        window.removeEventListener('scroll', updateDropdownPosition);
        window.removeEventListener('resize', updateDropdownPosition);
      };
    }
  }, [showSuggestions]);

  // CALCULATE TOTAL ITEMS (suggestions + new tag option)
  const totalItems = suggestions.length + (isNewTag ? 1 : 0);

  // Simple handlers without useCallback to avoid dependency issues
  const handleInputChange = (value: string) => {
    setInputValue(value);
    setSelectedIndex(-1); // Reset selection when typing
  };

  const simpleInputSubmit = () => {
    try {
      const normalizedInput = inputValue?.toLowerCase()?.trim() || '';
      if (normalizedInput && selectedTags && !selectedTags.includes(normalizedInput) && onAddTag) {
        onAddTag(normalizedInput);
      }
      setInputValue("");
      setShowSuggestions(false);
      setSelectedIndex(-1);
      setShowInput(false); // Hide input after adding tag
    } catch (error) {
      console.error('Error in simpleInputSubmit:', error);
    }
  };

  // Handle clicks outside the component to close input
  useEffect(() => {
    if (!showInput) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        handleInputClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showInput, handleInputClose]);

  return (
    <>
      <div ref={containerRef} style={{ position: 'relative', width: '100%', maxWidth: '250px' }}>
        {/* SELECTED TAGS AND + BUTTON */}
        <InlineStack gap="100" wrap={true} align="start">
          {/* SELECTED TAGS */}
          {selectedTags.map((tag) => (
            <Tag key={tag} onRemove={disabled ? undefined : () => onRemoveTag(tag)}>
              {tag}
            </Tag>
          ))}
          
          {/* + BUTTON (only show when input is not visible) */}
          {!showInput && (
            <button
              ref={plusButtonRef}
              onClick={handlePlusClick}
              disabled={disabled}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '24px',
                height: '24px',
                borderRadius: '4px',
                border: '1px solid var(--p-color-border)',
                backgroundColor: disabled ? 'var(--p-color-bg-surface-disabled)' : 'var(--p-color-bg-surface)',
                color: disabled ? 'var(--p-color-text-disabled)' : 'var(--p-color-text)',
                cursor: disabled ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (!disabled) {
                  e.currentTarget.style.backgroundColor = 'var(--p-color-bg-surface-hover)';
                  e.currentTarget.style.borderColor = 'var(--p-color-border-strong)';
                }
              }}
              onMouseLeave={(e) => {
                if (!disabled) {
                  e.currentTarget.style.backgroundColor = 'var(--p-color-bg-surface)';
                  e.currentTarget.style.borderColor = 'var(--p-color-border)';
                }
              }}
              aria-label={placeholder || "Add tag"}
            >
              +
            </button>
          )}
        </InlineStack>
      </div>

      {/* UNIFIED FLOATING BOX (positioned absolutely, outside table flow) */}
      {showInput && (
        <div
          style={{
            position: 'fixed',
            top: floatingInputPosition.top + 'px',
            left: floatingInputPosition.left + 'px',
            width: floatingInputPosition.width + 'px',
            zIndex: 10001,
            backgroundColor: 'white',
            border: '1px solid var(--p-color-border)',
            borderRadius: 'var(--p-border-radius-200)',
            boxShadow: 'var(--p-shadow-300)',
            overflow: 'hidden', // Prevents content from bleeding outside rounded corners
          }}
        >
          {/* INPUT SECTION */}
          <div style={{ padding: '12px' }}>
            <TextField
              ref={inputRef}
              label={label}
              labelHidden={labelHidden}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              autoComplete="off"
              autoFocus={true}
              onFocus={() => {
                setIsFocused(true);
                // Suggestions will be shown via useEffect based on focus state
              }}
            />
          </div>

          {/* SUGGESTIONS SECTION (directly below input, no gap) */}
          {showSuggestions && totalItems > 0 && (
            <div
              style={{
                borderTop: '1px solid var(--p-color-border-subdued)',
                maxHeight: Math.min(totalItems * 40, 240) + 'px', // Max 6 items visible
                overflowY: totalItems > 6 ? 'auto' : 'hidden',
              }}
            >
              {/* EXISTING SUGGESTIONS */}
              {suggestions.map((suggestion, index) => (
                <div
                  key={suggestion}
                  style={{
                    padding: '10px 12px',
                    cursor: 'pointer',
                    backgroundColor: index === selectedIndex ? 'var(--p-color-bg-surface-hover)' : 'transparent',
                    borderBottom: (index < suggestions.length - 1 || isNewTag) ? '1px solid var(--p-color-border-subdued)' : 'none',
                    minHeight: '40px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault(); // Prevent input blur
                    handleTagSelect(suggestion);
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <span style={{ fontSize: '14px', color: 'var(--p-color-text)' }}>
                    {suggestion}
                  </span>
                </div>
              ))}

              {/* ADD NEW TAG OPTION */}
              {isNewTag && (
                <div
                  style={{
                    padding: '10px 12px',
                    cursor: 'pointer',
                    backgroundColor: selectedIndex === suggestions.length ? 'var(--p-color-bg-surface-hover)' : 'transparent',
                    minHeight: '40px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault(); // Prevent input blur
                    simpleInputSubmit();
                  }}
                  onMouseEnter={() => setSelectedIndex(suggestions.length)}
                >
                  <span style={{ 
                    fontSize: '14px', 
                    color: 'var(--p-color-text-secondary)',
                    fontWeight: '500'
                  }}>
                    + Add "{inputValue.trim()}"
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}