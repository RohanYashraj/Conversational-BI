import type { ChatMessage } from '@/types/os'

import { AgentMessage, UserMessage } from './MessageItem'
import { useEffect, useRef, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import {
  ToolCall,
  ProvenanceQuery,
  ReasoningSteps,
  ReferenceData,
  Reference
} from '@/types/os'
import React, { type FC } from 'react'

import ChatBlankState from './ChatBlankState'
import { useStore } from '@/store'
import useAIChatStreamHandler from '@/hooks/useAIStreamHandler'

interface MessageListProps {
  messages: ChatMessage[]
}

interface MessageWrapperProps {
  message: ChatMessage
  isLastMessage: boolean
}

/** Meta rows sit at the column's left edge, flush with the assistant text
 * (the avatar gutter is gone — public-LLM interfaces frame replies as
 * document text, not chat bubbles). */
const TEXT_EDGE_INDENT = ''

interface ReferenceProps {
  references: ReferenceData[]
}

interface ReferenceItemProps {
  reference: Reference
}

const ReferenceItem: FC<ReferenceItemProps> = ({ reference }) => (
  <div className="relative flex h-[63px] w-[190px] cursor-default flex-col justify-between overflow-hidden rounded-lg border border-border/70 bg-muted/60 p-3 transition-colors duration-200 hover:bg-muted">
    <p className="min-w-0 truncate text-sm font-medium text-foreground">
      {reference.name}
    </p>
    <p className="truncate text-xs text-muted-foreground">
      {reference.content}
    </p>
  </div>
)

const References: FC<ReferenceProps> = ({ references }) => (
  <div className={`flex flex-col gap-3 ${TEXT_EDGE_INDENT}`}>
    {references.map((referenceData, index) => (
      <div
        key={`${referenceData.query}-${index}`}
        className="flex flex-wrap gap-3"
      >
        {referenceData.references.map((reference, refIndex) => (
          <ReferenceItem
            key={`${reference.name}-${reference.meta_data.chunk}-${refIndex}`}
            reference={reference}
          />
        ))}
      </div>
    ))}
  </div>
)

/** Friendly, lowercase tool trail: dedupes consecutive repeats. */
const toolTrail = (tools: ToolCall[]): string[] => {
  const names: string[] = []
  for (const tool of tools) {
    const name = (tool.tool_name || '').replace(/_/g, ' ').trim()
    if (name && names[names.length - 1] !== name) names.push(name)
  }
  return names
}

/**
 * The agent's working notes — thinking steps and tools used — folded into one
 * quiet, collapsible strip above the answer (Claude-style). Expanded while the
 * agent is still working, then collapses on its own once the answer lands;
 * the user can always reopen it.
 */
const ThoughtProcess: FC<{
  steps?: ReasoningSteps[]
  tools?: ToolCall[]
  isLive: boolean
}> = ({ steps = [], tools = [], isLive }) => {
  const [open, setOpen] = useState(isLive)
  const userToggled = useRef(false)
  const wasLive = useRef(isLive)

  // Auto-collapse once when the run finishes, unless the user took over.
  useEffect(() => {
    if (wasLive.current && !isLive && !userToggled.current) {
      setOpen(false)
    }
    wasLive.current = isLive
  }, [isLive])

  const trail = toolTrail(tools)
  if (steps.length === 0 && trail.length === 0) return null

  return (
    <div className={TEXT_EDGE_INDENT}>
      <button
        type="button"
        onClick={() => {
          userToggled.current = true
          setOpen((prev) => !prev)
        }}
        aria-expanded={open}
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground/80 transition-colors hover:text-foreground"
      >
        <ChevronRight
          className={`h-3 w-3 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
          aria-hidden="true"
        />
        {isLive ? (
          <span className="motion-safe:animate-pulse">Thinking…</span>
        ) : (
          <span>Thought process</span>
        )}
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-2.5 border-l-2 border-border/60 pl-4">
          {steps.map((step, index) => (
            <div key={`${step.title}-${index}`} className="flex flex-col gap-0.5">
              <p className="text-xs font-medium text-muted-foreground">
                {step.title}
              </p>
              {step.reasoning && (
                <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground/70">
                  {step.reasoning}
                </p>
              )}
            </div>
          ))}
          {trail.length > 0 && (
            <p className="text-[0.7rem] leading-relaxed text-muted-foreground/60">
              Used {trail.join(' · ')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Quiet per-answer provenance footer: one line that expands into the exact
 * SQL, row counts and timing behind the figures.
 */
const SourcesFooter: FC<{ queries: ProvenanceQuery[] }> = ({ queries }) => {
  const [open, setOpen] = useState(false)
  const ok = queries.filter((q) => !q.error)
  return (
    <div className={TEXT_EDGE_INDENT}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex items-center gap-1 text-[0.7rem] font-medium text-muted-foreground/70 transition-colors hover:text-foreground"
      >
        <ChevronRight
          className={`h-3 w-3 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
          aria-hidden="true"
        />
        Sources · {ok.length} {ok.length === 1 ? 'query' : 'queries'}
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-2 border-l-2 border-border/60 pl-4">
          {queries.map((q, index) => (
            <div key={`${q.ts}-${index}`} className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2 text-[0.65rem] text-muted-foreground/70">
                <span className="font-medium text-muted-foreground">
                  {q.source}
                </span>
                {q.error ? (
                  <span className="text-destructive">rejected</span>
                ) : (
                  <span>
                    {q.rows.toLocaleString()} row{q.rows === 1 ? '' : 's'}
                    {q.truncated ? ' (truncated)' : ''} · {q.elapsed_ms} ms
                  </span>
                )}
              </div>
              <pre className="overflow-x-auto whitespace-pre-wrap font-dmmono text-[0.7rem] leading-relaxed text-muted-foreground/70">
                {q.sql}
              </pre>
              {q.error && <p className="text-xs text-destructive">{q.error}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Follow-up suggestions as quiet ghost chips under the latest answer.
 * Clicking one sends it as the next message.
 */
const FollowupChips: FC<{ followups: string[] }> = ({ followups }) => {
  const isStreaming = useStore((state) => state.isStreaming)
  const { handleStreamResponse } = useAIChatStreamHandler()

  if (isStreaming) return null

  return (
    <div className={`flex flex-wrap gap-1.5 ${TEXT_EDGE_INDENT}`}>
      {followups.map((followup, index) => (
        <button
          key={`${followup}-${index}`}
          type="button"
          onClick={() => void handleStreamResponse(followup)}
          className="rounded-full border border-border/60 px-3 py-1 text-left text-xs text-muted-foreground transition-colors hover:border-border hover:bg-muted/60 hover:text-foreground"
        >
          {followup}
        </button>
      ))}
    </div>
  )
}

const AgentMessageWrapper = ({
  message,
  isLastMessage
}: MessageWrapperProps) => {
  const isStreaming = useStore((state) => state.isStreaming)
  const isLive = isLastMessage && isStreaming

  const hasSteps = (message.extra_data?.reasoning_steps?.length ?? 0) > 0
  const hasTools = (message.tool_calls?.length ?? 0) > 0

  return (
    <div className="flex flex-col gap-y-3">
      {(hasSteps || hasTools) && (
        <ThoughtProcess
          steps={message.extra_data?.reasoning_steps}
          tools={message.tool_calls}
          isLive={isLive}
        />
      )}
      {message.extra_data?.references &&
        message.extra_data.references.length > 0 && (
          <References references={message.extra_data.references} />
        )}
      <AgentMessage message={message} />
      {message.provenance && message.provenance.length > 0 && (
        <SourcesFooter queries={message.provenance} />
      )}
      {isLastMessage &&
        message.followups &&
        message.followups.length > 0 &&
        !message.streamingError && (
          <FollowupChips followups={message.followups} />
        )}
    </div>
  )
}

const Messages = ({ messages }: MessageListProps) => {
  if (messages.length === 0) {
    return <ChatBlankState />
  }

  return (
    <>
      {messages.map((message, index) => {
        const key = `${message.role}-${message.created_at}-${index}`
        const isLastMessage = index === messages.length - 1

        if (message.role === 'agent') {
          return (
            <AgentMessageWrapper
              key={key}
              message={message}
              isLastMessage={isLastMessage}
            />
          )
        }
        return <UserMessage key={key} message={message} />
      })}
    </>
  )
}

export default Messages
