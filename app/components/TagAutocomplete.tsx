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
} from "@shopify/polaris";

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
}

export function TagAutocomplete({
  availableTags = [],
  selectedTags = [],
  onAddTag,
  onRemoveTag,
  placeholder = "Add tag",
  label = "Add tag",
  labelHidden = true,
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
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

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
    } catch (error) {
      console.error('Error in handleInputSubmit:', error);
    }
  }, [inputValue, onAddTag, selectedTags]);

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
          setShowSuggestions(false);
          setSelectedIndex(-1);
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
    } catch (error) {
      console.error('Error in simpleInputSubmit:', error);
    }
  };

  return (
    <BlockStack gap="200">
      {/* MAIN CONTAINER */}
      <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
        <TextField
          label={label}
          labelHidden={labelHidden}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          onBlur={() => {
            // Delay to allow clicking on suggestions
            setTimeout(() => {
              setIsFocused(false);
              setShowSuggestions(false);
              setSelectedIndex(-1);
              // Only add tag on blur if input has value 
              if (inputValue?.trim()) {
                simpleInputSubmit();
              }
            }, 150);
          }}
          onFocus={() => {
            setIsFocused(true);
            // Suggestions will be shown via useEffect based on focus state
          }}
        />

        {/* SUGGESTIONS DROPDOWN */}
        {showSuggestions && totalItems > 0 && (
          <div
            style={{
              position: 'fixed', // Fixed position to escape parent containers
              top: dropdownPosition.top + 'px',
              left: dropdownPosition.left + 'px',
              width: dropdownPosition.width + 'px',
              zIndex: 10000, // Much higher z-index to appear above all Polaris components
              backgroundColor: 'white',
              border: '1px solid var(--p-color-border)',
              borderRadius: 'var(--p-border-radius-200)',
              boxShadow: 'var(--p-shadow-300)', // Stronger shadow for better visibility
              minHeight: '48px', // Minimum height for better visual appearance
              maxHeight: Math.min(totalItems * 40 + 16, 320) + 'px', // Dynamic height based on items, max 320px
              overflowY: totalItems > 8 ? 'auto' : 'hidden', // Only show scrollbar when needed
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
                  borderTop: suggestions.length > 0 ? '1px solid var(--p-color-border-subdued)' : 'none',
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

      {/* SELECTED TAGS DISPLAY */}
      {selectedTags.length > 0 && (
        <InlineStack gap="100" wrap>
          {selectedTags.map((tag) => (
            <Tag key={tag} onRemove={() => onRemoveTag(tag)}>
              {tag}
            </Tag>
          ))}
        </InlineStack>
      )}
    </BlockStack>
  );
}