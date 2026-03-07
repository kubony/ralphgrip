'use client'

import {
  useState,
  useRef,
  useEffect,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Mention from '@tiptap/extension-mention'
import Placeholder from '@tiptap/extension-placeholder'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { PersonRef } from '@/types/database'
import './mention-editor.css'

function toEditorHtml(text: string): string {
  if (!text) return ''
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const withMentions = escaped.replace(
    /@\[([^\]]+)\]\(user_id:([^)]+)\)/g,
    '<span data-type="mention" data-id="$2" data-label="$1" class="mention">@$1</span>'
  )
  return withMentions
    .split('\n')
    .map((line) => `<p>${line || '<br>'}</p>`)
    .join('')
}

interface SuggestionItem {
  id: string
  label: string
  avatar_url: string | null
}

interface MentionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean
}

interface MentionListProps {
  items: SuggestionItem[]
  command: (item: SuggestionItem) => void
  clientRect?: (() => DOMRect | null) | null
}

const MentionList = forwardRef<MentionListRef, MentionListProps>(
  ({ items, command, clientRect }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0)
    const listRef = useRef<HTMLDivElement>(null)
    const safeSelectedIndex = items.length === 0 ? 0 : Math.min(selectedIndex, items.length - 1)

    useEffect(() => {
      const el = listRef.current?.children[safeSelectedIndex] as HTMLElement
      el?.scrollIntoView({ block: 'nearest' })
    }, [safeSelectedIndex])

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((i) => (i - 1 + items.length) % items.length)
          return true
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex((i) => (i + 1) % items.length)
          return true
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          const item = items[safeSelectedIndex]
          if (item) command(item)
          return true
        }
        return false
      },
    }), [command, items, safeSelectedIndex])

    const rect = clientRect?.()
    if (!rect || items.length === 0) return null

    return (
      <div
        ref={listRef}
        role="listbox"
        className="fixed z-50 min-w-[200px] max-w-[300px] max-h-48 overflow-y-auto bg-popover text-popover-foreground rounded-md border shadow-md py-1"
        style={{ top: rect.bottom + 4, left: rect.left }}
      >
        {items.map((item, index) => (
          <div
            key={item.id}
            role="option"
            aria-selected={index === safeSelectedIndex}
            className={cn(
              'flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-accent/50 transition-colors',
              index === safeSelectedIndex && 'bg-accent text-accent-foreground'
            )}
            onClick={() => command(item)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <Avatar className="h-6 w-6 shrink-0">
              <AvatarImage src={item.avatar_url || undefined} />
              <AvatarFallback className="text-[10px]">
                {(item.label || '?')[0]}
              </AvatarFallback>
            </Avatar>
            <span className="flex-1 min-w-0 truncate">{item.label || '이름 없음'}</span>
          </div>
        ))}
      </div>
    )
  }
)
MentionList.displayName = 'MentionList'

interface MentionTextareaProps {
  value: string
  onChange: (value: string) => void
  members: PersonRef[]
  onSubmit?: () => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
}

export function MentionTextarea({
  value,
  onChange,
  members,
  onSubmit,
  placeholder,
  className,
  autoFocus,
}: MentionTextareaProps) {
  const internalValueRef = useRef(value)
  const mentionListRef = useRef<MentionListRef>(null)
  const [suggestionState, setSuggestionState] = useState<{
    items: SuggestionItem[]
    command: (item: SuggestionItem) => void
    clientRect: (() => DOMRect | null) | null
  } | null>(null)

  const extensions = useMemo(() => [
    StarterKit.configure({
      bold: false,
      italic: false,
      strike: false,
      code: false,
      heading: false,
      codeBlock: false,
      blockquote: false,
      bulletList: false,
      orderedList: false,
      listItem: false,
      horizontalRule: false,
    }),
       
      Mention.configure({
      HTMLAttributes: { class: 'mention' },
      renderText: ({ node }) => `@[${node.attrs.label}](user_id:${node.attrs.id})`,
      suggestion: {
        items: ({ query }: { query: string }) => {
          const q = query.toLowerCase()
          return members
            .filter((m) => (m.full_name || '').toLowerCase().includes(q))
            .slice(0, 10)
            .map((m) => ({
              id: m.id,
              label: m.full_name || '',
              avatar_url: m.avatar_url,
            }))
        },
        render: () => ({
          onStart: (props) => {
            setSuggestionState({
              items: props.items as SuggestionItem[],
              command: props.command as unknown as (item: SuggestionItem) => void,
              clientRect: props.clientRect ?? null,
            })
          },
          onUpdate: (props) => {
            setSuggestionState({
              items: props.items as SuggestionItem[],
              command: props.command as unknown as (item: SuggestionItem) => void,
              clientRect: props.clientRect ?? null,
            })
          },
          onKeyDown: (props) => {
            if (props.event.key === 'Escape') {
              setSuggestionState(null)
              return true
            }
            return mentionListRef.current?.onKeyDown(props) ?? false
          },
          onExit: () => setSuggestionState(null),
        }),
      },
    }),
    Placeholder.configure({
      placeholder: placeholder || '',
    }),
  ], [members, placeholder])

  const editor = useEditor({
    immediatelyRender: false,
    content: value ? toEditorHtml(value) : '',
    extensions,
    editorProps: {
      handleKeyDown: (_view: unknown, event: KeyboardEvent) => {
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
          event.preventDefault()
          onSubmit?.()
          return true
        }
        return false
      },
    },
    onUpdate: ({ editor }) => {
      const text = editor.getText({ blockSeparator: '\n' })
      internalValueRef.current = text
      onChange(text)
    },
    autofocus: autoFocus ? 'end' : false,
  }, [extensions, value, onChange, onSubmit, autoFocus])

  useEffect(() => {
    if (!editor) return
    if (value === internalValueRef.current) return
    internalValueRef.current = value
    if (value === '') {
      editor.commands.clearContent()
    } else {
      editor.commands.setContent(toEditorHtml(value))
    }
  }, [value, editor])

  return (
    <div className={cn('relative', className)}>
      <div className="min-h-[88px] rounded-md border border-input bg-background px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
        <EditorContent editor={editor} />
      </div>
      {suggestionState && (
        <MentionList
          ref={mentionListRef}
          items={suggestionState.items}
          command={suggestionState.command}
          clientRect={suggestionState.clientRect}
        />
      )}
    </div>
  )
}
