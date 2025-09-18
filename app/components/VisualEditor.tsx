'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Edit3, 
  Image, 
  Palette, 
  Move, 
  Plus, 
  Trash2, 
  Save, 
  X,
  Eye,
  EyeOff,
  Layers,
  Settings,
  Upload,
  RotateCcw,
  Check,
  AlertCircle,
  Loader2,
  Search,
  Filter,
  Layout,
  Type as TypographyIcon
} from 'lucide-react';
import { toast } from 'sonner';

// Helper function to make CSS classes user-friendly
const makeUserFriendly = (content: string, type: string) => {
  if (type !== 'styling') return content;
  
  const classes = content.split(' ').filter(c => c.trim());
  const descriptions = [];
  
  // Color classes
  const colors = classes.filter(c => /^(bg-|text-|border-|ring-)/.test(c));
  if (colors.length > 0) {
    const colorDescriptions = colors.map(c => {
      if (c.startsWith('bg-')) {
        const color = c.replace('bg-', '').replace('-', ' ');
        return `Background: ${color === 'white' ? 'White' : color === 'black' ? 'Black' : 
                color.includes('gray') ? 'Gray' : color.includes('blue') ? 'Blue' :
                color.includes('red') ? 'Red' : color.includes('green') ? 'Green' :
                color.includes('yellow') ? 'Yellow' : color.includes('purple') ? 'Purple' :
                color.includes('pink') ? 'Pink' : color.charAt(0).toUpperCase() + color.slice(1)}`;
      }
      if (c.startsWith('text-')) {
        const color = c.replace('text-', '').replace('-', ' ');
        // Skip text size classes
        if (/^(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)$/.test(color)) return null;
        return `Text color: ${color === 'white' ? 'White' : color === 'black' ? 'Black' : 
                color.includes('gray') ? 'Gray' : color.includes('blue') ? 'Blue' :
                color.charAt(0).toUpperCase() + color.slice(1)}`;
      }
      if (c.startsWith('border-')) return `Border color: ${c.replace('border-', '').replace('-', ' ')}`;
      return c;
    }).filter(Boolean);
    descriptions.push(...colorDescriptions);
  }
  
  // Size classes
  const sizes = classes.filter(c => /^(w-|h-|max-w-|max-h-|min-w-|min-h-)/.test(c));
  if (sizes.length > 0) {
    const sizeDescriptions = sizes.map(c => {
      if (c.startsWith('w-')) return `Width: ${c.replace('w-', '')}`;
      if (c.startsWith('h-')) return `Height: ${c.replace('h-', '')}`;
      if (c.startsWith('max-w-')) return `Max width: ${c.replace('max-w-', '')}`;
      if (c.startsWith('max-h-')) return `Max height: ${c.replace('max-h-', '')}`;
      return c;
    });
    descriptions.push(...sizeDescriptions);
  }
  
  // Typography classes
  const typography = classes.filter(c => /^(text-|font-|leading-|tracking-)/.test(c));
  if (typography.length > 0) {
    const typoDescriptions = typography.map(c => {
      if (c.match(/^text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)$/)) {
        return `Font size: ${c.replace('text-', '')}`;
      }
      if (c.startsWith('font-')) return `Font weight: ${c.replace('font-', '')}`;
      if (c.startsWith('leading-')) return `Line height: ${c.replace('leading-', '')}`;
      if (c.startsWith('tracking-')) return `Letter spacing: ${c.replace('tracking-', '')}`;
      return c;
    });
    descriptions.push(...typoDescriptions);
  }
  
  // Spacing classes
  const spacing = classes.filter(c => /^(p-|px-|py-|pt-|pb-|pl-|pr-|m-|mx-|my-|mt-|mb-|ml-|mr-|gap-|space-)/.test(c));
  if (spacing.length > 0) {
    const spaceDescriptions = spacing.map(c => {
      if (c.startsWith('p-')) return `Padding: ${c.replace('p-', '')}`;
      if (c.startsWith('m-')) return `Margin: ${c.replace('m-', '')}`;
      if (c.startsWith('gap-')) return `Gap: ${c.replace('gap-', '')}`;
      return c;
    });
    descriptions.push(...spaceDescriptions.slice(0, 2)); // Limit to avoid clutter
  }
  
  // Layout classes
  const layout = classes.filter(c => /^(flex|grid|block|inline|hidden|visible|md:|lg:|xl:|2xl:)/.test(c));
  if (layout.length > 0) {
    const layoutDescriptions = layout.map(c => {
      if (c === 'flex') return 'Flexible layout';
      if (c.startsWith('grid')) {
        if (c.includes('cols')) {
          const cols = c.match(/cols-(\d+)/)?.[1];
          return cols ? `${cols} column grid` : 'Grid layout';
        }
        return 'Grid layout';
      }
      if (c === 'block') return 'Block element';
      if (c === 'inline') return 'Inline element';
      if (c === 'hidden') return 'Hidden element';
      if (c === 'visible') return 'Visible element';
      if (c.includes('md:')) return 'Medium screen styling';
      if (c.includes('lg:')) return 'Large screen styling';
      if (c.includes('xl:')) return 'Extra large screen styling';
      return c;
    });
    descriptions.push(...layoutDescriptions);
  }
  
  // Border and effects
  const effects = classes.filter(c => /^(rounded|border|shadow|opacity|blur)/.test(c));
  if (effects.length > 0) {
    const effectDescriptions = effects.map(c => {
      if (c.startsWith('rounded')) return 'Rounded corners';
      if (c.startsWith('shadow')) return 'Drop shadow';
      if (c.startsWith('border')) return 'Border';
      return c;
    });
    descriptions.push(...effectDescriptions);
  }
  
  // Return user-friendly description or fallback
  if (descriptions.length > 0) {
    return descriptions.slice(0, 3).join(', '); // Limit to 3 descriptions
  }
  
  // Fallback for unrecognized classes
  return `Styling (${classes.length} properties)`;
};

// Get appropriate icon for styling elements
const getStylingIcon = (content: string) => {
  // Temporarily return null to fix the undefined component error
  return null;
};

// Styling Editor Component
interface StylingEditorProps {
  element: any;
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  isUpdating: boolean;
}

const StylingEditor: React.FC<StylingEditorProps> = ({ 
  element, 
  value, 
  onChange, 
  onSave, 
  onCancel, 
  isUpdating 
}) => {
  const [editMode, setEditMode] = useState<'visual' | 'raw'>('visual');
  const [parsedClasses, setParsedClasses] = useState<{[key: string]: string[]}>({});

  useEffect(() => {
    // Parse classes into categories
    const classes = value.split(' ').filter(c => c.trim());
    const categorized: {[key: string]: string[]} = {
      colors: [],
      sizing: [],
      spacing: [],
      typography: [],
      layout: [],
      borders: [],
      effects: [],
      other: []
    };

    classes.forEach(cls => {
      if (/\b(bg-|text-|border-|ring-)/.test(cls)) categorized.colors.push(cls);
      else if (/\b(w-|h-|max-w-|max-h-|min-w-|min-h-)/.test(cls)) categorized.sizing.push(cls);
      else if (/\b(p-|px-|py-|pt-|pb-|pl-|pr-|m-|mx-|my-|mt-|mb-|ml-|mr-|gap-|space-)/.test(cls)) categorized.spacing.push(cls);
      else if (/\b(text-|font-|leading-|tracking-|antialiased)/.test(cls)) categorized.typography.push(cls);
      else if (/\b(flex|grid|block|inline|hidden|visible)/.test(cls)) categorized.layout.push(cls);
      else if (/\b(rounded|border)/.test(cls)) categorized.borders.push(cls);
      else if (/\b(shadow|opacity|blur)/.test(cls)) categorized.effects.push(cls);
      else categorized.other.push(cls);
    });

    setParsedClasses(categorized);
  }, [value]);

  const updateClasses = (category: string, newClasses: string[]) => {
    const updated = { ...parsedClasses, [category]: newClasses };
    const allClasses = Object.values(updated).flat().filter(c => c.trim()).join(' ');
    onChange(allClasses);
  };

  const removeClass = (category: string, classToRemove: string) => {
    const updated = parsedClasses[category].filter(c => c !== classToRemove);
    updateClasses(category, updated);
  };

  return (
    <div className="p-4">
      {/* Mode Toggle */}
      <div className="flex gap-1 mb-4">
        <button
          onClick={() => setEditMode('visual')}
          className={`px-3 py-1 text-xs rounded transition-all ${
            editMode === 'visual' ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-white/60'
          }`}
        >
          Visual
        </button>
        <button
          onClick={() => setEditMode('raw')}
          className={`px-3 py-1 text-xs rounded transition-all ${
            editMode === 'raw' ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-white/60'
          }`}
        >
          Raw
        </button>
      </div>

      {editMode === 'visual' ? (
        <div className="space-y-3 max-h-60 overflow-y-auto">
          {Object.entries(parsedClasses).map(([category, classes]) => 
            classes.length > 0 && (
              <div key={category} className="space-y-2">
                <div className="text-xs text-white/60 capitalize font-medium">{category}</div>
                <div className="flex flex-wrap gap-1">
                  {classes.map((cls, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-1 px-2 py-1 text-xs rounded"
                      style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.1)'
                      }}
                    >
                      <span className="text-white/80">{cls}</span>
                      <button
                        onClick={() => removeClass(category, cls)}
                        className="text-red-400 hover:text-red-300 ml-1"
                      >
                        <X className="w-2 h-2" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full p-3 text-sm rounded-lg resize-none focus:outline-none font-mono"
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#ffffff',
            minHeight: '120px'
          }}
          placeholder="Edit CSS classes..."
        />
      )}
      
      <div className="flex gap-2 mt-4">
        <button
          onClick={onSave}
          disabled={isUpdating || !value.trim()}
          className="flex-1 px-4 py-2 text-sm rounded-lg transition-all hover:bg-blue-600 disabled:opacity-50"
          style={{
            background: 'rgba(59, 130, 246, 0.8)',
            color: '#ffffff'
          }}
        >
          {isUpdating ? 'Updating...' : 'Update Styles'}
        </button>
        
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm rounded-lg transition-all hover:bg-white/10"
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#ffffff'
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

interface VisualEditorProps {
  projectId: string;
  iframeRef: React.RefObject<HTMLIFrameElement>;
  isActive: boolean;
  onToggle: () => void;
  onFileUpdate: (filePath: string, content: string) => void;
}

interface EditableElement {
  id: string;
  type: 'text' | 'image' | 'background' | 'component' | 'styling';
  element: HTMLElement;
  originalContent: string;
  filePath: string;
  lineNumber?: number;
  selector: string;
}

interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
}

export default function VisualEditor({ 
  projectId, 
  iframeRef, 
  isActive, 
  onToggle, 
  onFileUpdate 
}: VisualEditorProps) {
  const [editableElements, setEditableElements] = useState<EditableElement[]>([]);
  const [selectedElement, setSelectedElement] = useState<EditableElement | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [colorPalette, setColorPalette] = useState<ColorPalette>({
    primary: '#3b82f6',
    secondary: '#64748b',
    accent: '#10b981',
    background: '#ffffff',
    text: '#1f2937'
  });
  const [isScanning, setIsScanning] = useState(false);
  const [hoveredElement, setHoveredElement] = useState<HTMLElement | null>(null);
  const [scannedElements, setScannedElements] = useState<any[]>([]);
  const [elementFilter, setElementFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isUpdating, setIsUpdating] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  
  const overlayRef = useRef<HTMLDivElement>(null);
  const editorPanelRef = useRef<HTMLDivElement>(null);
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  // Inject visual editor overlay into iframe using postMessage
  const injectEditorOverlay = useCallback(() => {
    if (!iframeRef.current || !isActive) return;

    try {
      const iframe = iframeRef.current;
      
      // Use postMessage to communicate with iframe
      const message = {
        type: 'INJECT_VISUAL_EDITOR',
        payload: {
          isActive: true
        }
      };
      
      iframe.contentWindow?.postMessage(message, '*');
      
    } catch (error) {
      console.error('Failed to inject editor overlay:', error);
      // Fallback: inject script into iframe
      injectEditorScript();
    }
  }, [iframeRef, isActive]);

  // Fallback: inject script directly into iframe
  const injectEditorScript = useCallback(() => {
    if (!iframeRef.current || !isActive) return;

    try {
      const iframe = iframeRef.current;
      
      // Create and inject script
      const script = document.createElement('script');
      script.textContent = `
        (function() {
          // Visual editor overlay injection script
          if (window.visualEditorInjected) return;
          window.visualEditorInjected = true;
          
          console.log('🎨 Visual Editor: Injecting overlay into iframe');
          
          // Remove existing overlay
          const existingOverlay = document.getElementById('visual-editor-overlay');
          if (existingOverlay) {
            existingOverlay.remove();
          }

          // Create overlay container
          const overlay = document.createElement('div');
          overlay.id = 'visual-editor-overlay';
          overlay.style.cssText = \`
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          \`;

          // Create hover indicator
          const hoverIndicator = document.createElement('div');
          hoverIndicator.id = 'hover-indicator';
          hoverIndicator.style.cssText = \`
            position: absolute;
            border: 2px solid #3b82f6;
            background: rgba(59, 130, 246, 0.1);
            pointer-events: none;
            display: none;
            border-radius: 4px;
            transition: all 0.15s ease;
          \`;
          overlay.appendChild(hoverIndicator);

          // Create selection indicator
          const selectionIndicator = document.createElement('div');
          selectionIndicator.id = 'selection-indicator';
          selectionIndicator.style.cssText = \`
            position: absolute;
            border: 2px solid #10b981;
            background: rgba(16, 185, 129, 0.1);
            pointer-events: none;
            display: none;
            border-radius: 4px;
          \`;
          overlay.appendChild(selectionIndicator);

          // Create edit tooltip
          const editTooltip = document.createElement('div');
          editTooltip.id = 'edit-tooltip';
          editTooltip.style.cssText = \`
            position: absolute;
            background: #1f2937;
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 500;
            pointer-events: none;
            display: none;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            z-index: 1000000;
          \`;
          overlay.appendChild(editTooltip);

          document.body.appendChild(overlay);

          // Helper functions
          const isTextElement = (element) => {
            const textTags = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'SPAN', 'A', 'BUTTON', 'LABEL'];
            return textTags.includes(element.tagName) && element.textContent?.trim() !== '';
          };

          const findEditableElement = (element) => {
            let current = element;
            while (current && current !== document.body) {
              if (isTextElement(current)) return current;
              if (current.tagName === 'IMG') return current;
              current = current.parentElement;
            }
            return null;
          };

          const showHoverIndicator = (element) => {
            const rect = element.getBoundingClientRect();
            const scrollTop = document.documentElement.scrollTop;
            const scrollLeft = document.documentElement.scrollLeft;

            hoverIndicator.style.display = 'block';
            hoverIndicator.style.top = \`\${rect.top + scrollTop - 2}px\`;
            hoverIndicator.style.left = \`\${rect.left + scrollLeft - 2}px\`;
            hoverIndicator.style.width = \`\${rect.width + 4}px\`;
            hoverIndicator.style.height = \`\${rect.height + 4}px\`;

            editTooltip.style.display = 'block';
            editTooltip.style.top = \`\${rect.top + scrollTop - 35}px\`;
            editTooltip.style.left = \`\${rect.left + scrollLeft}px\`;
            editTooltip.textContent = \`Click to edit \${element.tagName.toLowerCase()}\`;
          };

          const hideHoverIndicator = () => {
            hoverIndicator.style.display = 'none';
            editTooltip.style.display = 'none';
          };

          // Event listeners
          const handleMouseMove = (e) => {
            const target = e.target;
            if (target.closest('#visual-editor-overlay')) return;

            const editableElement = findEditableElement(target);
            if (editableElement) {
              showHoverIndicator(editableElement);
            } else {
              hideHoverIndicator();
            }
          };

          const handleClick = (e) => {
            const target = e.target;
            if (target.closest('#visual-editor-overlay')) return;

            const editableElement = findEditableElement(target);
            if (editableElement) {
              e.preventDefault();
              e.stopPropagation();
              
              // Send message to parent about element selection
              window.parent.postMessage({
                type: 'ELEMENT_SELECTED',
                payload: {
                  tagName: editableElement.tagName,
                  textContent: editableElement.textContent,
                  src: editableElement.src || null,
                  selector: generateSelector(editableElement)
                }
              }, '*');
            }
          };

          const generateSelector = (element) => {
            const path = [];
            let current = element;
            
            while (current && current !== document.body) {
              let selector = current.tagName.toLowerCase();
              
              if (current.id) {
                selector += \`#\${current.id}\`;
                path.unshift(selector);
                break;
              }
              
              if (current.className) {
                const classes = current.className.split(' ').filter(c => c.trim());
                if (classes.length > 0) {
                  selector += \`.\${classes.join('.')}\`;
                }
              }
              
              path.unshift(selector);
              current = current.parentElement;
            }
            
            return path.join(' > ');
          };

          document.addEventListener('mousemove', handleMouseMove);
          document.addEventListener('click', handleClick);

          // Listen for messages from parent
          window.addEventListener('message', (event) => {
            if (event.data.type === 'REMOVE_VISUAL_EDITOR') {
              document.removeEventListener('mousemove', handleMouseMove);
              document.removeEventListener('click', handleClick);
              const overlay = document.getElementById('visual-editor-overlay');
              if (overlay) overlay.remove();
              window.visualEditorInjected = false;
            }
          });

          console.log('✅ Visual Editor: Overlay injected successfully');
        })();
      `;
      
      // Try to inject into iframe
      if (iframe.contentDocument) {
        iframe.contentDocument.head.appendChild(script);
      }
      
    } catch (error) {
      console.error('Failed to inject editor script:', error);
    }
  }, [iframeRef, isActive]);

  // Listen for messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'ELEMENT_SELECTED') {
        const { tagName, textContent, src, selector } = event.data.payload;
        
        // Create editable element object
        const editableElement: EditableElement = {
          id: `${tagName.toLowerCase()}-${Date.now()}`,
          type: tagName === 'IMG' ? 'image' : 'text',
          element: null as any, // We don't have direct access to the element
          originalContent: textContent || src || '',
          filePath: findSourceFileFromSelector(selector),
          selector
        };

        setSelectedElement(editableElement);
        
        if (editableElement.type === 'text') {
          setIsEditing(true);
          setEditValue(editableElement.originalContent);
        }
        
        toast.success(`Selected ${tagName.toLowerCase()} element`);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Helper function to determine source file from selector
  const findSourceFileFromSelector = (selector: string): string => {
    // Simple heuristic based on selector
    if (selector.includes('header')) return 'src/components/Header.tsx';
    if (selector.includes('footer')) return 'src/components/Footer.tsx';
    if (selector.includes('nav')) return 'src/components/Navigation.tsx';
    if (selector.includes('hero')) return 'src/components/Hero.tsx';
    return 'src/App.tsx';
  };

  // Remove visual editor from iframe
  const removeEditorFromIframe = useCallback(() => {
    if (!iframeRef.current) return;

    try {
      const iframe = iframeRef.current;
      iframe.contentWindow?.postMessage({
        type: 'REMOVE_VISUAL_EDITOR'
      }, '*');
    } catch (error) {
      console.error('Failed to remove editor from iframe:', error);
    }
  }, [iframeRef]);

  // Save changes directly to file
  const saveTextChanges = async () => {
    if (!selectedElement || !editValue.trim()) return;

    try {
      setIsUpdating(true);
      
      // Update the file directly via API
      const response = await fetch('/api/visual-editor/update-file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          filePath: selectedElement.filePath,
          lineNumber: selectedElement.lineNumber,
          oldContent: selectedElement.originalContent,
          newContent: editValue.trim(),
          elementType: selectedElement.type
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update file');
      }

      const result = await response.json();
      
      if (result.success) {
        // Update WebContainer file for instant hot reload
        if (onFileUpdate) {
          onFileUpdate(selectedElement.filePath, result.updatedContent);
        }
        
        setIsEditing(false);
        setSelectedElement(null);
        
        // Show updating state for 3 seconds to indicate hot reload is happening
        setTimeout(() => {
          setIsUpdating(false);
        }, 3000);
        
        toast.success(`Updated ${selectedElement.filePath.split('/').pop()} - preview updating...`);
      } else {
        throw new Error(result.error || 'Update failed');
      }
      
    } catch (error: any) {
      console.error('Failed to save changes:', error);
      
      if (error.response?.status === 429) {
        toast.error('Too many edit requests. Please wait before making more changes.');
      } else {
        toast.error('Failed to save changes');
      }
      setIsUpdating(false);
    }
  };

  // Cancel text editing
  const cancelTextEditing = () => {
    setIsEditing(false);
    setSelectedElement(null);
    setEditValue('');
  };

  // Update source code
  const updateSourceCode = async (editableElement: EditableElement, newContent: string) => {
    // This is where we'd use AI to intelligently update the source code
    // For now, we'll use a simplified approach
    
    try {
      const response = await fetch('/api/visual-editor/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          filePath: editableElement.filePath,
          selector: editableElement.selector,
          elementType: editableElement.type,
          oldContent: editableElement.originalContent,
          newContent,
          action: 'update_text'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update source code');
      }

      const data = await response.json();
      
      // Trigger file update
      onFileUpdate(editableElement.filePath, data.updatedContent);
      
    } catch (error) {
      console.error('Failed to update source code:', error);
      throw error;
    }
  };

  // Handle image upload
  const handleImageUpload = async (file: File) => {
    if (!selectedElement || selectedElement.type !== 'image') return;

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('projectId', projectId);

      const response = await fetch('/api/visual-editor/upload-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload image');
      }

      const data = await response.json();
      
      // Update the image element
      (selectedElement.element as HTMLImageElement).src = data.imageUrl;
      
      // Update source code
      await updateSourceCode(selectedElement, data.imageUrl);
      
      toast.success('Image updated successfully!');
    } catch (error) {
      console.error('Failed to upload image:', error);
      toast.error('Failed to update image');
    }
  };

  // Scan for editable elements using API
  const scanForEditableElements = useCallback(async () => {
    if (!projectId || !isActive) return;

    setIsScanning(true);
    
    try {
      const response = await fetch('/api/visual-editor/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to scan elements');
      }

      const data = await response.json();
      
      if (data.success) {
        // Convert API response to EditableElement format
        const elements: EditableElement[] = data.elements.map((el: any) => ({
          id: `${el.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: el.type,
          element: null as any,
          originalContent: el.content || el.src || '',
          filePath: el.filePath,
          selector: `${el.tag || 'element'}:contains("${el.content || ''}")`
        }));

        setEditableElements(elements);
        setScannedElements(data.elements || []);
        toast.success(`Found ${elements.length} editable elements across ${data.totalFiles} files`);
      } else {
        throw new Error('Scan failed');
      }
    } catch (error: any) {
      console.error('Failed to scan for editable elements:', error);
      
      if (error.response?.status === 429) {
        toast.error('Too many scan requests. Please wait before scanning again.');
      } else {
        toast.error('Failed to scan for editable elements');
      }
    } finally {
      setIsScanning(false);
    }
  }, [projectId, isActive]);

  // Initialize editor when activated
  useEffect(() => {
    if (isActive) {
      // Small delay to ensure iframe is ready
      const timer = setTimeout(() => {
        injectEditorOverlay();
        scanForEditableElements();
      }, 500);
      
      return () => clearTimeout(timer);
    } else {
      // Clean up when deactivated
      removeEditorFromIframe();
      setSelectedElement(null);
      setIsEditing(false);
      setEditableElements([]);
    }
  }, [isActive, injectEditorOverlay, scanForEditableElements]);

  // Close filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setShowFilterDropdown(false);
      }
    };

    if (showFilterDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showFilterDropdown]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isActive) return;

      if (e.key === 'Escape') {
        if (isEditing) {
          cancelTextEditing();
        } else {
          onToggle();
        }
      }

      if (e.key === 'Enter' && isEditing) {
        e.preventDefault();
        saveTextChanges();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isActive, isEditing, onToggle]);

  if (!isActive) return null;

  return (
    <div className="fixed top-4 right-4 bottom-4 z-50 w-80 flex flex-col"
      style={{
        background: 'rgba(0, 0, 0, 0.95)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        maxHeight: 'calc(100vh - 2rem)'
      }}
    >
      {/* Header with Scan Button */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
            <span className="text-sm font-medium text-white">Visual Editor</span>
          </div>
          
          {/* Scan Button */}
          <button
            onClick={scanForEditableElements}
            disabled={isScanning}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-all disabled:opacity-50"
            style={{
              background: isScanning ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              color: '#60a5fa'
            }}
          >
            {isScanning ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Eye className="w-3 h-3" />
            )}
            {isScanning ? 'Scanning...' : 'Scan'}
          </button>
        </div>
        
        <button
          onClick={onToggle}
          className="p-1 hover:bg-white/10 rounded transition-colors"
        >
          <X className="w-4 h-4 text-white/60 hover:text-white" />
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col min-h-0">
        
        {/* Status Bar */}
        {isUpdating && (
          <div className="px-4 py-2 border-b border-white/5">
            <div className="flex items-center justify-center text-xs">
              <div className="flex items-center gap-1 text-blue-400">
                <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse"></div>
                <span>Updating...</span>
              </div>
            </div>
          </div>
        )}




        {/* Elements List */}
        {scannedElements.length > 0 ? (
          <div className="flex-1 flex flex-col border-t border-white/10 min-h-0">
            
            {/* Fixed Search and Filter Bar */}
            <div className="flex-shrink-0 p-4 border-b border-white/5 bg-black/20">
              <div className="flex gap-2">
                {/* Search Input with Filter Button */}
                <div className="relative flex-1" ref={filterDropdownRef}>
                  <input
                    type="text"
                    placeholder="Search elements..."
                    value={elementFilter}
                    onChange={(e) => setElementFilter(e.target.value)}
                    className="w-full px-3 py-2 pr-8 text-xs rounded-lg focus:outline-none"
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#ffffff'
                    }}
                  />
                  
                  {/* Filter Button inside search bar */}
                  <button
                    onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                    className="absolute right-2 top-2 p-0.5 rounded hover:bg-white/10 transition-all"
                    style={{
                      color: categoryFilter !== 'all' ? '#60a5fa' : 'rgba(255, 255, 255, 0.4)'
                    }}
                    title="Filter elements"
                  >
                    <Filter className="w-3 h-3" />
                  </button>
                  
                  {/* Filter Dropdown */}
                  {showFilterDropdown && (
                    <div className="absolute right-0 top-full mt-1 z-50 min-w-[120px] rounded-lg shadow-lg"
                         style={{
                           background: 'rgba(0, 0, 0, 0.95)',
                           border: '1px solid rgba(255, 255, 255, 0.1)',
                           backdropFilter: 'blur(10px)'
                         }}>
                      {[
                        { value: 'all', label: 'All Elements' },
                        { value: 'text', label: 'Text' },
                        { value: 'image', label: 'Images' },
                        { value: 'styling', label: 'Styling' },
                        { value: 'background', label: 'Backgrounds' },
                        { value: 'string-literal', label: 'Strings' }
                      ].map((option) => (
                        <button
                          key={option.value}
                          onClick={() => {
                            setCategoryFilter(option.value);
                            setShowFilterDropdown(false);
                          }}
                          className={`w-full px-3 py-2 text-xs text-left hover:bg-white/10 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                            categoryFilter === option.value ? 'bg-blue-500/20 text-blue-400' : 'text-white/80'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Clear Filters */}
                {(categoryFilter !== 'all' || elementFilter) && (
                  <button
                    onClick={() => {
                      setCategoryFilter('all');
                      setElementFilter('');
                    }}
                    className="px-2 py-2 text-xs rounded-lg transition-all hover:bg-white/10"
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#f87171'
                    }}
                    title="Clear filters"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Editing Panel - Positioned after filters */}
            {isEditing && selectedElement && (
              <div className="flex-shrink-0 border-b border-white/5 bg-black/30">
                <div className="p-4 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-green-400"></div>
                    <span className="text-xs text-white/80">
                      {selectedElement.type} • {selectedElement.filePath.split('/').pop()}
                      {selectedElement.lineNumber && ` • line ${selectedElement.lineNumber}`}
                    </span>
                  </div>
                </div>
                
                {selectedElement.type === 'styling' ? (
                  <StylingEditor 
                    element={selectedElement}
                    value={editValue}
                    onChange={setEditValue}
                    onSave={saveTextChanges}
                    onCancel={cancelTextEditing}
                    isUpdating={isUpdating}
                  />
                ) : (
                  <>
                    <div className="p-4">
                      <textarea
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-full p-3 text-sm rounded-lg resize-none focus:outline-none font-mono"
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          color: '#ffffff',
                          minHeight: '80px'
                        }}
                        placeholder="Edit content..."
                      />
                    </div>
                    
                    <div className="p-4 border-t border-white/5 flex gap-2">
                      <button
                        onClick={saveTextChanges}
                        disabled={!editValue.trim()}
                        className="flex-1 px-3 py-2 text-xs font-medium rounded transition-all disabled:opacity-50"
                        style={{
                          background: !editValue.trim() ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.2)',
                          border: '1px solid rgba(34, 197, 94, 0.3)',
                          color: '#4ade80'
                        }}
                      >
                        Update
                      </button>
                      <button
                        onClick={cancelTextEditing}
                        className="px-3 py-2 text-xs font-medium rounded transition-all"
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          color: '#ffffff'
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            
            {/* Elements */}
            <div className="flex-1 overflow-y-auto scrollbar-thin"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(255,255,255,0.2) transparent',
                minHeight: '200px'
              }}
            >
                            {scannedElements
                .filter(element => {
                  // Category filter
                  if (categoryFilter !== 'all') {
                    if (categoryFilter === 'string-literal') {
                      if (element.selector !== 'string-literal') return false;
                    } else {
                      if (element.type !== categoryFilter) return false;
                    }
                  }
                  
                  // Text search filter
                  if (elementFilter) {
                    const searchTerm = elementFilter.toLowerCase();
                    return (
                      (element.content && element.content.toLowerCase().includes(searchTerm)) ||
                      (element.filePath && element.filePath.toLowerCase().includes(searchTerm)) ||
                      (element.type && element.type.toLowerCase().includes(searchTerm)) ||
                      (element.element && element.element.toLowerCase().includes(searchTerm)) ||
                      (element.selector && element.selector.toLowerCase().includes(searchTerm))
                    );
                  }
                  
                  return true;
                })
                .map((element, index) => (
                  <div
                    key={index}
                    className="px-4 py-3 border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors"
                    onClick={() => {
                      const mockElement: EditableElement = {
                        id: `element-${index}`,
                        type: element.type === 'image' ? 'image' : 'text',
                        element: null as any,
                        originalContent: element.content || element.src || '',
                        filePath: element.filePath,
                        lineNumber: element.line,
                        selector: element.selector || element.element || 'unknown'
                      };
                      setSelectedElement(mockElement);
                      setEditValue(element.content || element.src || '');
                      setIsEditing(true);
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-1 h-1 rounded-full ${
                        element.type === 'text' ? 'bg-blue-400' : 
                        element.type === 'image' ? 'bg-green-400' : 
                        element.type === 'styling' ? 'bg-pink-400' :
                        element.type === 'background' ? 'bg-purple-400' :
                        element.selector === 'string-literal' ? 'bg-yellow-400' :
                        'bg-gray-400'
                      }`}></div>
                      <span className="text-xs text-white/60 capitalize">
                        {element.selector === 'string-literal' ? 'string' : 
                         element.type === 'styling' ? 'styles' : element.type}
                      </span>
                                              {element.element && (
                          <span className="text-xs text-white/40">
                            • {element.element}
                          </span>
                        )}
                        {element.type === 'styling' && (
                          <div className="ml-1">
                            {getStylingIcon(element.content)}
                          </div>
                        )}
                    </div>
                    <div className="text-xs text-white truncate mb-1">
                      {makeUserFriendly(element.content || element.src || 'No content', element.type)}
                    </div>
                    <div className="text-xs text-white/40">
                      {element.filePath.split('/').pop()}
                    </div>
                  </div>
                ))}

            </div>
          </div>
        ) : (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center border-t border-white/10">
            <div className="text-center text-white/40 p-8">
              <Eye className="w-8 h-8 mx-auto mb-3 opacity-50" />
              <p className="text-sm mb-2">No elements scanned yet</p>
              <p className="text-xs">Click "Scan" to find editable elements</p>
            </div>
          </div>
        )}
        
      </div>
    </div>
  );
} 