import type { ChatMessage } from '@/types/os'

import {
  AgentMessage,
  UserMessage,
  MESSAGE_AVATAR_COL,
  MESSAGE_THREAD_GAP
} from './MessageItem'
import Tooltip from '@/components/ui/tooltip'
import { memo } from 'react'
import {
  ToolCallProps,
  ReasoningStepProps,
  ReasoningProps,
  ReferenceData,
  Reference
} from '@/types/os'
import React, { type FC } from 'react'

import Icon from '@/components/ui/icon'
import ChatBlankState from './ChatBlankState'

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
    <p className="truncate text-xs text-muted-foreground">{reference.content}</p>
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

const AgentMessageWrapper = ({ message }: MessageWrapperProps) => {
  return (
    <div className="flex flex-col gap-y-9">
      {message.extra_data?.reasoning_steps &&
        message.extra_data.reasoning_steps.length > 0 && (
          <div className={`flex items-start ${MESSAGE_THREAD_GAP}`}>
            <div className={`${MESSAGE_AVATAR_COL} pt-0.5`}>
              <Tooltip
                delayDuration={0}
                content={<p className="text-popover-foreground">Reasoning</p>}
                side="top"
                ariaLabel="Reasoning steps"
              >
                <Icon type="reasoning" size="sm" aria-hidden="true" />
              </Tooltip>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Reasoning
              </p>
              <Reasonings reasoning={message.extra_data.reasoning_steps} />
            </div>
          </div>
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
    </div>
  )
}
const Reasoning: FC<ReasoningStepProps> = ({ index, stepTitle }) => (
  <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
    <div className="flex h-[20px] shrink-0 items-center rounded-md border border-border/60 bg-secondary px-2">
      <p className="text-xs font-medium tabular-nums text-foreground">
        Step {index + 1}
      </p>
    </div>
    <p className="min-w-0 text-xs text-foreground">{stepTitle}</p>
  </div>
)
const Reasonings: FC<ReasoningProps> = ({ reasoning }) => (
  <div className="flex flex-col items-start justify-center gap-2">
    {reasoning.map((title, index) => (
      <Reasoning
        key={`${title.title}-${title.action}-${index}`}
        stepTitle={title.title}
        index={index}
      />
    ))}
  </div>
)

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
