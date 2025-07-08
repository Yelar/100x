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
  Unlink
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
  ({ placeholder, content, onChange, onTextChange, className, autoSuggestion, onKeyDown, minHeight = '8rem' }, ref) => {
    const [linkUrl, setLinkUrl] = React.useState('');
    const [showLinkInput, setShowLinkInput] = React.useState(false);
    const [cursorPosition, setCursorPosition] = React.useState<{ top: number; left: number } | null>(null);

    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          heading: {
            levels: [1, 2, 3],
          },
        }),
        TextStyle,
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
        
        let left = pos.left - editorRect.left;
        const top = pos.top - editorRect.top;
        
        // Adjust position if popup would overflow to the right
        const popupWidth = 200; // max-width of autocomplete popup
        const editorWidth = editorRect.width;
        
        if (left + popupWidth > editorWidth) {
          left = Math.max(0, editorWidth - popupWidth - 10); // 10px margin from right edge
        }
        
        setCursorPosition({ top, left });
      } catch {
        // Ignore positioning errors
        setCursorPosition(null);
      }
    }, [editor]);

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
      <div className="border border-input rounded-md focus-within:ring-2 focus-within:ring-ring bg-background h-full flex flex-col">
        {/* Toolbar */}
        <div className="border-b border-border p-2 flex flex-wrap items-center gap-1 flex-shrink-0">
          {/* Font Family */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8">
                <Type className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {fontFamilies.map((font) => (
                <DropdownMenuItem
                  key={font.value}
                  onClick={() => editor.chain().focus().setFontFamily(font.value).run()}
                  style={{ fontFamily: font.value }}
                >
                  {font.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Font Size */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 text-xs">
                Size
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {fontSizes.map((size) => (
                <DropdownMenuItem
                  key={size}
                  onClick={() => editor.chain().focus().setFontFamily(`inherit`).run()}
                  style={{ fontSize: size }}
                >
                  {size}
                </DropdownMenuItem>
              ))}
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8">
                <Palette className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <div className="grid grid-cols-4 gap-1 p-2">
                {colors.map((color) => (
                  <button
                    key={color}
                    className="w-6 h-6 rounded border border-gray-300 hover:scale-110 transition-transform"
                    style={{ backgroundColor: color }}
                    onClick={() => editor.chain().focus().setColor(color).run()}
                  />
                ))}
              </div>
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
        </div>

        {/* Editor Content */}
        <div className="relative flex-1 flex flex-col" style={{ minHeight: minHeight }}>
          <EditorContent editor={editor} className="flex-1" />
          
          {/* Autocomplete Suggestion */}
          {autoSuggestion && cursorPosition && (
            <div 
              className="pointer-events-none absolute bg-gray-100 dark:bg-gray-800 text-muted-foreground px-2 py-1 rounded shadow-sm text-sm border z-10"
              style={{
                top: cursorPosition.top + 24,
                left: cursorPosition.left,
                maxWidth: '200px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              <span className="opacity-60">{autoSuggestion}</span>
              <span className="text-xs text-muted-foreground/60 ml-2">Tab to accept</span>
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