'use client'
import { useRef, useState } from 'react'
import { Paperclip } from 'lucide-react'
import { toast } from 'sonner'
import { TextArea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useStore } from '@/store'
import useAIChatStreamHandler from '@/hooks/useAIStreamHandler'
import { useQueryState } from 'nuqs'
import Icon from '@/components/ui/icon'
import {
  ACCEPTED_FILE_TYPES,
  formatFileSize,
  validateAttachments
} from '@/lib/attachments'

const ChatInput = () => {
  const { chatInputRef } = useStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { handleStreamResponse } = useAIChatStreamHandler()
  const [selectedAgent] = useQueryState('agent')
  const [teamId] = useQueryState('team')
  const [inputMessage, setInputMessage] = useState('')
  const [attachedFiles, setAttachedFiles] = useState<File[]>([])
  const isStreaming = useStore((state) => state.isStreaming)

  const canSend = !!(selectedAgent || teamId)
  const hasContent = inputMessage.trim().length > 0 || attachedFiles.length > 0

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? [])
    event.target.value = ''

    if (selected.length === 0) return

    const combined = [...attachedFiles, ...selected]
    const error = validateAttachments(combined)
    if (error) {
      toast.error(error)
      return
    }

    setAttachedFiles(combined)
  }

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!hasContent) return

    const error = validateAttachments(attachedFiles)
    if (error) {
      toast.error(error)
      return
    }

    const currentMessage = inputMessage
    const currentFiles = [...attachedFiles]
    setInputMessage('')
    setAttachedFiles([])

    const formData = new FormData()
    formData.append('message', currentMessage)
    for (const file of currentFiles) {
      formData.append('attachments', file)
    }

    try {
      await handleStreamResponse(formData)
    } catch (error) {
      toast.error(
        `Error in handleSubmit: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }
  }

  return (
    <div className="relative mx-auto mb-1 flex w-full max-w-4xl flex-col gap-2 font-sans">
      {attachedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1">
          {attachedFiles.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="inline-flex max-w-full items-center gap-2 rounded-full border border-border/80 bg-card/90 px-3 py-1.5 text-xs shadow-sm"
            >
              <span className="truncate font-medium text-foreground">
                {file.name}
              </span>
              <span className="shrink-0 text-muted-foreground">
                {formatFileSize(file.size)}
              </span>
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="shrink-0 rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={`Remove ${file.name}`}
              >
                <Icon type="x" size="xxs" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="relative flex w-full items-end gap-2">
        <label htmlFor="chat-message-input" className="sr-only">
          Message
        </label>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_FILE_TYPES}
          className="hidden"
          onChange={handleFileSelect}
          disabled={!canSend || isStreaming}
        />
        <div className="flex min-h-[3.25rem] flex-1 items-end gap-1 rounded-full border border-border/90 bg-card/90 py-1.5 pl-2 pr-2 shadow-sm backdrop-blur-sm">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={!canSend || isStreaming}
            aria-label="Attach file"
            className="mb-0.5 size-9 shrink-0 rounded-full text-muted-foreground hover:bg-muted hover:text-primary"
          >
            <Paperclip className="size-4" aria-hidden="true" />
          </Button>
          <TextArea
            id="chat-message-input"
            name="message"
            placeholder="Ask anything…"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === 'Enter' &&
                !e.nativeEvent.isComposing &&
                !e.shiftKey &&
                !isStreaming
              ) {
                e.preventDefault()
                handleSubmit()
              }
            }}
            className="max-h-[6rem] min-h-0 flex-1 border-0 bg-transparent px-0 py-2 text-sm text-foreground shadow-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
            disabled={!canSend}
            ref={chatInputRef}
            autoComplete="off"
          />
          <Button
            onClick={handleSubmit}
            disabled={!canSend || !hasContent || isStreaming}
            type="button"
            size="icon"
            aria-label="Send message"
            className="mb-0.5 size-11 shrink-0 rounded-full bg-primary text-primary-foreground shadow-sm transition-opacity hover:bg-primary/90 disabled:opacity-50"
          >
            <Icon
              type="send"
              className="text-primary-foreground"
              size="xs"
              aria-hidden="true"
            />
          </Button>
        </div>
      </div>
    </div>
  )
}

export default ChatInput
