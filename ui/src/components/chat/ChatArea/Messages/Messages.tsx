import type { ChatMessage } from '@/types/os'

import {
  AgentMessage,
  UserMessage,
  MESSAGE_AVATAR_COL,
  MESSAGE_THREAD_GAP
} from './MessageItem'
import Tooltip from '@/components/ui/tooltip'
import { memo, useState } from 'react'
import { ChevronDown, Database, MessageCirclePlus } from 'lucide-react'
import {
  ToolCallProps,
  ProvenanceQuery,
  ReasoningProps,
  ReasoningSteps,
  ReferenceData,
  Reference
} from '@/types/os'
import React, { type FC } from 'react'

import Icon from '@/components/ui/icon'
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
  <div className="flex flex-col gap-4">
    {references.map((referenceData, index) => (
      <div
        key={`${referenceData.query}-${index}`}
        className="flex flex-col gap-3"
      >
        <div className="flex flex-wrap gap-3">
          {referenceData.references.map((reference, refIndex) => (
            <ReferenceItem
              key={`${reference.name}-${reference.meta_data.chunk}-${refIndex}`}
              reference={reference}
            />
          ))}
        </div>
      </div>
    ))}
  </div>
)

/**
 * Per-answer provenance: the exact SQL executed for this answer, with row
 * counts and timing. Collapsed by default — transparency without exposing
 * code in the answer itself.
 */
const SourcesBlock: FC<{ queries: ProvenanceQuery[] }> = ({ queries }) => {
  const [open, setOpen] = useState(false)
  const ok = queries.filter((q) => !q.error)
  return (
    <div className={`flex items-start ${MESSAGE_THREAD_GAP}`}>
      <div className={`${MESSAGE_AVATAR_COL} pt-0.5`}>
        <Tooltip
          delayDuration={0}
          content={<p className="text-popover-foreground">Sources</p>}
          side="top"
          ariaLabel="Data sources"
        >
          <Database
            className="h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
        </Tooltip>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          className="flex w-fit items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
        >
          Sources · {ok.length} {ok.length === 1 ? 'query' : 'queries'}
          <ChevronDown
            className={`h-3 w-3 transition-transform ${open ? '' : '-rotate-90'}`}
            aria-hidden="true"
          />
        </button>
        {open && (
          <div className="flex flex-col gap-2">
            {queries.map((q, index) => (
              <div
                key={`${q.ts}-${index}`}
                className="flex flex-col gap-1 rounded-md border border-border/60 bg-muted/30 p-2"
              >
                <div className="flex flex-wrap items-center gap-2 text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                  <span className="rounded bg-secondary px-1.5 py-0.5 font-medium text-foreground">
                    {q.source}
                  </span>
                  {q.error ? (
                    <span className="text-destructive">rejected</span>
                  ) : (
                    <>
                      <span>
                        {q.rows.toLocaleString()} row{q.rows === 1 ? '' : 's'}
                        {q.truncated ? ' (truncated)' : ''}
                      </span>
                      <span>{q.elapsed_ms} ms</span>
                    </>
                  )}
                </div>
                <pre className="overflow-x-auto whitespace-pre-wrap font-dmmono text-[0.7rem] leading-relaxed text-muted-foreground">
                  {q.sql}
                </pre>
                {q.error && (
                  <p className="text-xs text-destructive">{q.error}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Clickable follow-up suggestion chips (Agno's native followups feature).
 * Shown under the latest answer only, like Claude.ai — clicking one sends it
 * as the next message.
 */
const FollowupChips: FC<{ followups: string[] }> = ({ followups }) => {
  const isStreaming = useStore((state) => state.isStreaming)
  const { handleStreamResponse } = useAIChatStreamHandler()

  if (isStreaming) return null

  return (
    <div className={`flex items-start ${MESSAGE_THREAD_GAP}`}>
      <div className={`${MESSAGE_AVATAR_COL} pt-1`}>
        <MessageCirclePlus
          className="h-4 w-4 text-muted-foreground"
          aria-hidden="true"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap gap-2">
        {followups.map((followup, index) => (
          <button
            key={`${followup}-${index}`}
            type="button"
            onClick={() => void handleStreamResponse(followup)}
            className="rounded-full border border-border/80 bg-card/70 px-3 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-foreground"
          >
            {followup}
          </button>
        ))}
      </div>
    </div>
  )
}

const AgentMessageWrapper = ({ message, isLastMessage }: MessageWrapperProps) => {
  return (
    <div className="flex flex-col gap-y-9">
      {message.extra_data?.reasoning_steps &&
        message.extra_data.reasoning_steps.length > 0 && (
          <ThinkingBlock steps={message.extra_data.reasoning_steps} />
        )}
      {message.extra_data?.references &&
        message.extra_data.references.length > 0 && (
          <div className={`flex items-start ${MESSAGE_THREAD_GAP}`}>
            <div className={`${MESSAGE_AVATAR_COL} pt-0.5`}>
              <Tooltip
                delayDuration={0}
                content={<p className="text-popover-foreground">References</p>}
                side="top"
                ariaLabel="Reference sources"
              >
                <Icon type="references" size="sm" aria-hidden="true" />
              </Tooltip>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <References references={message.extra_data.references} />
            </div>
          </div>
        )}
      {message.tool_calls && message.tool_calls.length > 0 && (
        <div className={`flex items-start ${MESSAGE_THREAD_GAP}`}>
          <div className={`${MESSAGE_AVATAR_COL} pt-0.5`}>
            <Tooltip
              delayDuration={0}
              content={<p className="text-popover-foreground">Tool Calls</p>}
              side="top"
              ariaLabel="Tool calls"
            >
              <Icon
                type="hammer"
                className="rounded-lg bg-muted p-1 text-primary"
                size="sm"
                aria-hidden="true"
              />
            </Tooltip>
          </div>

          <div className="flex min-w-0 flex-1 flex-wrap gap-2">
            {message.tool_calls.map((toolCall, index) => (
              <ToolComponent
                key={
                  toolCall.tool_call_id ||
                  `${toolCall.tool_name}-${toolCall.created_at}-${index}`
                }
                tools={toolCall}
              />
            ))}
          </div>
        </div>
      )}
      <AgentMessage message={message} />
      {message.provenance && message.provenance.length > 0 && (
        <SourcesBlock queries={message.provenance} />
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
const ThinkingStepItem: FC<{ index: number; step: ReasoningSteps }> = ({
  index,
  step
}) => (
  <div className="flex min-w-0 flex-col gap-1">
    <div className="flex items-center gap-2">
      <div className="flex h-[20px] shrink-0 items-center rounded-md border border-border/60 bg-secondary px-2">
        <p className="text-xs font-medium tabular-nums text-foreground">
          Step {index + 1}
        </p>
      </div>
      <p className="min-w-0 text-xs font-medium text-foreground">
        {step.title}
      </p>
    </div>
    {step.reasoning && (
      <p className="whitespace-pre-wrap pl-1 text-xs italic leading-relaxed text-muted-foreground">
        {step.reasoning}
      </p>
    )}
  </div>
)

const Reasonings: FC<ReasoningProps> = ({ reasoning }) => (
  <div className="flex flex-col items-start justify-center gap-3">
    {reasoning.map((step, index) => (
      <ThinkingStepItem
        key={`${step.title}-${step.action}-${index}`}
        step={step}
        index={index}
      />
    ))}
  </div>
)

// Claude-Code-style collapsible "Thinking" panel for the streamed reasoning.
const ThinkingBlock: FC<{ steps: ReasoningSteps[] }> = ({ steps }) => {
  const [open, setOpen] = useState(true)
  return (
    <div className={`flex items-start ${MESSAGE_THREAD_GAP}`}>
      <div className={`${MESSAGE_AVATAR_COL} pt-0.5`}>
        <Tooltip
          delayDuration={0}
          content={<p className="text-popover-foreground">Thinking</p>}
          side="top"
          ariaLabel="Thinking steps"
        >
          <Icon type="reasoning" size="sm" aria-hidden="true" />
        </Tooltip>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          className="flex w-fit items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
        >
          Thinking
          <ChevronDown
            className={`h-3 w-3 transition-transform ${open ? '' : '-rotate-90'}`}
            aria-hidden="true"
          />
        </button>
        {open && <Reasonings reasoning={steps} />}
      </div>
    </div>
  )
}

const ToolComponent = memo(({ tools }: ToolCallProps) => (
  <div className="cursor-default rounded-full border border-border/70 bg-secondary/80 px-3 py-1.5 text-xs">
    <p className="font-dmmono uppercase tracking-wide text-primary">
      {tools.tool_name}
    </p>
  </div>
))
ToolComponent.displayName = 'ToolComponent'
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
