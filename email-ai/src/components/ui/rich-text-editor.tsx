'use client';

import React, { useCallback, useEffect, useImperativeHandle, forwardRef } from 'react';
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextStyle from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';
import Color from '@tiptap/extension-color';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { Button } from './button';
import { Input } from './input';
import { Switch } from './switch';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Link as LinkIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Type,
  Palette,
  Unlink,
  Sparkles
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu';

export interface RichTextEditorHandle {
  focus: () => void;
  getHTML: () => string;
  getText: () => string;
  setContent: (content: string) => void;
  insertText: (text: string) => void;
}

interface RichTextEditorProps {
  placeholder?: string;
  content?: string;
  onChange?: (content: string) => void;
  onTextChange?: (text: string) => void;
  className?: string;
  autoSuggestion?: string;
  onKeyDown?: (event: React.KeyboardEvent) => void;
  minHeight?: string;
  /** Whether AI autocomplete is active. If undefined, the toggle is hidden */
  isAutocompleteEnabled?: boolean;
  /** Handler to toggle AI autocomplete */
  onToggleAutocomplete?: (checked: boolean) => void;
  /** Tone options for email composition */
  toneOptions?: Array<{ value: string; label: string; emoji: string }>;
  /** Currently selected tone */
  selectedTone?: string;
  /** Handler to change tone */
  onToneChange?: (tone: string) => void;
  /** Whether to show tone dropdown */
  showToneDropdown?: boolean;
  /** Handler to toggle tone dropdown */
  onToggleToneDropdown?: (show: boolean) => void;
  /** Handler to generate content */
  onGenerateContent?: () => void;
  /** Whether content is being generated */
  isGenerating?: boolean;
}

const fontFamilies = [
  { label: 'Default', value: '' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Helvetica', value: 'Helvetica, sans-serif' },
  { label: 'Times New Roman', value: 'Times New Roman, serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
  { label: 'Courier New', value: 'Courier New, monospace' },
  { label: 'Trebuchet MS', value: 'Trebuchet MS, sans-serif' },
];

const fontSizes = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px'];

const colors = [
  '#000000', '#374151', '#6B7280', '#9CA3AF',
  '#EF4444', '#F97316', '#EAB308', '#22C55E',
  '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6',
];

export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(
  ({ 
    placeholder, 
    content, 
    onChange, 
    onTextChange, 
    className, 
    autoSuggestion, 
    onKeyDown, 
    minHeight = '8rem', 
    isAutocompleteEnabled, 
    onToggleAutocomplete,
    toneOptions,
    selectedTone,
    onToneChange,
    showToneDropdown,
    onToggleToneDropdown,
    onGenerateContent,
    isGenerating
  }, ref) => {
    const [linkUrl, setLinkUrl] = React.useState('');
    const [showLinkInput, setShowLinkInput] = React.useState(false);
    const [cursorPosition, setCursorPosition] = React.useState<{ top: number; left: number; editorWidth: number; wouldOverflow: boolean } | null>(null);

    const editor = useEditor({
      immediatelyRender: false, // Fix SSR hydration mismatch
      extensions: [
        StarterKit.configure({
          heading: {
            levels: [1, 2, 3],
          },
        }),
        TextStyle.extend({
          addAttributes() {
            return {
              ...this.parent?.(),
              style: {
                default: null,
                parseHTML: element => element.getAttribute('style'),
                renderHTML: attributes => {
                  if (!attributes.style) {
                    return {}
                  }
                  return {
                    style: attributes.style,
                  }
                },
              },
              fontSize: {
                default: null,
                parseHTML: element => {
                  const style = element.getAttribute('style');
                  if (style) {
                    const match = style.match(/font-size:\s*([^;]+)/);
                    return match ? match[1] : null;
                  }
                  return null;
                },
                renderHTML: attributes => {
                  if (!attributes.fontSize) {
                    return {}
                  }
                  return {
                    style: `font-size: ${attributes.fontSize}`,
                  }
                },
              },
            }
          },
        }),
        FontFamily.configure({
          types: ['textStyle'],
        }),
        Color.configure({
          types: ['textStyle'],
        }),
        Link.configure({
          openOnClick: false,
          HTMLAttributes: {
            class: 'text-blue-600 underline hover:text-blue-800 cursor-pointer',
          },
        }),
        Underline,
        TextAlign.configure({
          types: ['heading', 'paragraph'],
        }),
      ],
      content: content || '',
      editorProps: {
        attributes: {
          class: `prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none p-3 flex-1 h-full ${className || ''}`,
          style: `min-height: ${minHeight}; height: 100%;`,
          placeholder: placeholder || 'Type here...',
        },
        handleKeyDown: (view, event) => {
          // Handle Tab key for autocomplete
          if (event.key === 'Tab' && autoSuggestion) {
            event.preventDefault();
            editor?.commands.insertContent(autoSuggestion);
            return true;
          }
          onKeyDown?.(event as unknown as React.KeyboardEvent);
          return false;
        },
      },
      onUpdate: ({ editor }) => {
        const html = editor.getHTML();
        const text = editor.getText();
        onChange?.(html);
        onTextChange?.(text);
        
        // Update cursor position for autocomplete
        updateCursorPosition();
      },
      onSelectionUpdate: () => {
        // Update cursor position when selection changes
        updateCursorPosition();
      },
    });

    useImperativeHandle(ref, () => ({
      focus: () => editor?.commands.focus(),
      getHTML: () => editor?.getHTML() || '',
      getText: () => editor?.getText() || '',
      setContent: (content: string) => editor?.commands.setContent(content),
      insertText: (text: string) => editor?.commands.insertContent(text),
    }));

    useEffect(() => {
      if (editor && content !== undefined && content !== editor.getHTML()) {
        editor.commands.setContent(content);
      }
    }, [editor, content]);

    const updateCursorPosition = useCallback(() => {
      if (!editor) return;
      
      try {
        const { view } = editor;
        const { state } = view;
        const { selection } = state;
        const { $anchor } = selection;
        
        const pos = view.coordsAtPos($anchor.pos);
        const editorRect = view.dom.getBoundingClientRect();
        
        const left = pos.left - editorRect.left;
        const top = pos.top - editorRect.top;
        const editorWidth = editorRect.width;
        
        // Estimate if popup would overflow (assuming typical autocomplete length)
        const estimatedPopupWidth = autoSuggestion ? Math.min(autoSuggestion.length * 8 + 100, 400) : 200;
        const wouldOverflow = left + estimatedPopupWidth > editorWidth;
        
        setCursorPosition({ 
          top, 
          left, 
          editorWidth,
          wouldOverflow
        });
      } catch {
        // Ignore positioning errors
        setCursorPosition(null);
      }
    }, [editor, autoSuggestion]);

    const addLink = useCallback(() => {
      if (!linkUrl) return;

      if (editor) {
        editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
        setLinkUrl('');
        setShowLinkInput(false);
      }
    }, [editor, linkUrl]);

    const removeLink = useCallback(() => {
      if (editor) {
        editor.chain().focus().unsetLink().run();
      }
    }, [editor]);

    if (!editor) {
      return null;
    }

    return (
      <div className="border border-input rounded-md focus-within:ring-2 focus-within:ring-ring bg-background h-full flex flex-col relative">
        {/* Toolbar */}
        <div className="border-b border-border p-2 flex flex-wrap items-center gap-1 flex-shrink-0">
          {/* Font Family */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8">
                <Type className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="z-[9999]">
              {fontFamilies.map((font) => (
                <DropdownMenuItem
                  key={font.value}
                  onClick={(e) => {
                    e.preventDefault();
                    if (font.value) {
                      editor.chain().focus().setFontFamily(font.value).run();
                    } else {
                      editor.chain().focus().unsetFontFamily().run();
                    }
                  }}
                  style={{ fontFamily: font.value || 'inherit' }}
                  className={editor.isActive('textStyle', { fontFamily: font.value }) ? 'bg-accent' : ''}
                >
                  {font.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Font Size */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 text-xs">
                Size
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="z-[9999]">
              {fontSizes.map((size) => (
                <DropdownMenuItem
                  key={size}
                  onClick={(e) => {
                    e.preventDefault();
                    // Apply font size using TextStyle mark with fontSize attribute
                    editor.chain()
                      .focus()
                      .setMark('textStyle', { fontSize: size })
                      .run();
                  }}
                  style={{ fontSize: size }}
                  className={editor.isActive('textStyle', { fontSize: size }) ? 'bg-accent' : ''}
                >
                  {size}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  editor.chain().focus().unsetMark('textStyle').run();
                }}
                className="border-t mt-1 pt-1"
              >
                Reset Size
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="w-px h-6 bg-border mx-1" />

          {/* Basic Formatting */}
          <Button
            variant={editor.isActive('bold') ? 'default' : 'ghost'}
            size="sm"
            className="h-8"
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold className="h-4 w-4" />
          </Button>

          <Button
            variant={editor.isActive('italic') ? 'default' : 'ghost'}
            size="sm"
            className="h-8"
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic className="h-4 w-4" />
          </Button>

          <Button
            variant={editor.isActive('underline') ? 'default' : 'ghost'}
            size="sm"
            className="h-8"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <UnderlineIcon className="h-4 w-4" />
          </Button>

          <div className="w-px h-6 bg-border mx-1" />

          {/* Text Color */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8">
                <Palette className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="z-[9999]">
              <div className="grid grid-cols-4 gap-1 p-2">
                {colors.map((color) => (
                  <button
                    key={color}
                    className="w-6 h-6 rounded border border-gray-300 hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ backgroundColor: color }}
                    onClick={(e) => {
                      e.preventDefault();
                      editor.chain().focus().setColor(color).run();
                    }}
                    title={color}
                  />
                ))}
              </div>
              <button
                className="w-full mt-2 p-1 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 rounded"
                onClick={(e) => {
                  e.preventDefault();
                  editor.chain().focus().unsetColor().run();
                }}
              >
                Reset Color
              </button>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="w-px h-6 bg-border mx-1" />

          {/* Alignment */}
          <Button
            variant={editor.isActive({ textAlign: 'left' }) ? 'default' : 'ghost'}
            size="sm"
            className="h-8"
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
          >
            <AlignLeft className="h-4 w-4" />
          </Button>

          <Button
            variant={editor.isActive({ textAlign: 'center' }) ? 'default' : 'ghost'}
            size="sm"
            className="h-8"
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
          >
            <AlignCenter className="h-4 w-4" />
          </Button>

          <Button
            variant={editor.isActive({ textAlign: 'right' }) ? 'default' : 'ghost'}
            size="sm"
            className="h-8"
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
          >
            <AlignRight className="h-4 w-4" />
          </Button>

          <div className="w-px h-6 bg-border mx-1" />

          {/* Lists */}
          <Button
            variant={editor.isActive('bulletList') ? 'default' : 'ghost'}
            size="sm"
            className="h-8"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List className="h-4 w-4" />
          </Button>

          <Button
            variant={editor.isActive('orderedList') ? 'default' : 'ghost'}
            size="sm"
            className="h-8"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered className="h-4 w-4" />
          </Button>

          <div className="w-px h-6 bg-border mx-1" />

          {/* Link */}
          {!showLinkInput ? (
            <Button
              variant={editor.isActive('link') ? 'default' : 'ghost'}
              size="sm"
              className="h-8"
              onClick={() => setShowLinkInput(true)}
            >
              <LinkIcon className="h-4 w-4" />
            </Button>
          ) : (
            <div className="flex items-center gap-1">
              <Input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="Enter URL"
                className="h-8 w-32 text-xs"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addLink();
                  } else if (e.key === 'Escape') {
                    setShowLinkInput(false);
                    setLinkUrl('');
                  }
                }}
              />
              <Button size="sm" className="h-8 text-xs" onClick={addLink}>
                Add
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  setShowLinkInput(false);
                  setLinkUrl('');
                }}
              >
                Cancel
              </Button>
            </div>
          )}

          {editor.isActive('link') && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={removeLink}
            >
              <Unlink className="h-4 w-4" />
            </Button>
          )}

          {/* AI Autocomplete Toggle */}
          {typeof isAutocompleteEnabled === 'boolean' && onToggleAutocomplete && (
            <div className="flex items-center gap-1 pl-2 border-l border-border/50">
              <Switch
                id="autocomplete-rte-toggle"
                checked={isAutocompleteEnabled}
                onCheckedChange={onToggleAutocomplete}
              />
              <label
                htmlFor="autocomplete-rte-toggle"
                className="text-[11px] text-muted-foreground select-none"
              >
                AI
              </label>
            </div>
          )}

          {/* Tone Selection */}
          {toneOptions && selectedTone && onToneChange && onToggleToneDropdown && (
            <div className="flex items-center gap-1 pl-2 border-l border-border/50">
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onToggleToneDropdown(!showToneDropdown)}
                  className="gap-2 border-border/60 hover:bg-gray-50 dark:hover:bg-gray-800 h-8 text-xs"
                >
                  {toneOptions.find(t => t.value === selectedTone)?.emoji}
                  <span className="text-xs">{toneOptions.find(t => t.value === selectedTone)?.label.split(' ')[1]}</span>
                  <span className="text-xs">▼</span>
                </Button>
                {showToneDropdown && (
                  <div className="absolute bottom-full right-0 mb-2 w-48 bg-white dark:bg-gray-800 border border-border rounded-lg shadow-lg z-10 p-1">
                    <div className="text-xs font-medium text-muted-foreground px-2 py-1 border-b border-border/50 mb-1">
                      Email Tone
                    </div>
                    {toneOptions.map((tone) => (
                      <button
                        key={tone.value}
                        onClick={() => {
                          onToneChange(tone.value);
                          onToggleToneDropdown(false);
                        }}
                        className={`w-full text-left px-2 py-1.5 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 ${
                          selectedTone === tone.value ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200' : 'text-foreground'
                        }`}
                      >
                        <span>{tone.emoji}</span>
                        <span>{tone.label.split(' ')[1]}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Generate Button */}
          {onGenerateContent && (
            <div className="flex items-center gap-1 pl-2 border-l border-border/50">
              <Button 
                onClick={onGenerateContent}
                disabled={isGenerating}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-3 shadow-sm transition-all hover:shadow-md h-8 text-xs"
              >
                {isGenerating ? (
                  <>
                    <span className="animate-spin mr-1">⟳</span>
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3 w-3 mr-1" />
                    Generate
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Editor Content */}
        <div className="relative flex-1 flex flex-col" style={{ minHeight: minHeight }}>
          <EditorContent editor={editor} className="flex-1" />
          
          {/* Autocomplete Suggestion */}
          {autoSuggestion && cursorPosition && (
            <div 
              className="pointer-events-none absolute bg-gray-100 dark:bg-gray-800 text-muted-foreground px-3 py-2 rounded shadow-sm text-sm border z-10 whitespace-nowrap"
              style={{
                top: cursorPosition.top + 24,
                ...(cursorPosition.wouldOverflow ? {
                  right: cursorPosition.editorWidth - cursorPosition.left,
                  left: 'auto'
                } : {
                  left: cursorPosition.left
                })
              }}
            >
              <div className="flex items-center gap-2">
                <span className="opacity-80">{autoSuggestion}</span>
                <span className="text-xs text-muted-foreground/60 flex-shrink-0">↹ Tab</span>
              </div>
            </div>
          )}
        </div>

        {/* Bubble Menu for quick formatting */}
        <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }}>
          <div className="bg-background border border-border rounded-md shadow-lg p-1 flex items-center gap-1">
            <Button
              variant={editor.isActive('bold') ? 'default' : 'ghost'}
              size="sm"
              className="h-7"
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              <Bold className="h-3 w-3" />
            </Button>
            <Button
              variant={editor.isActive('italic') ? 'default' : 'ghost'}
              size="sm"
              className="h-7"
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              <Italic className="h-3 w-3" />
            </Button>
            <Button
              variant={editor.isActive('underline') ? 'default' : 'ghost'}
              size="sm"
              className="h-7"
              onClick={() => editor.chain().focus().toggleUnderline().run()}
            >
              <UnderlineIcon className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={() => setShowLinkInput(true)}
            >
              <LinkIcon className="h-3 w-3" />
            </Button>
          </div>
        </BubbleMenu>
      </div>
    );
  }
);

RichTextEditor.displayName = 'RichTextEditor'; 