import Icon from '@/components/ui/icon'
import MarkdownRenderer from '@/components/ui/typography/MarkdownRenderer'
import { useStore } from '@/store'
import type { ChatMessage } from '@/types/os'
import Videos from './Multimedia/Videos'
import Images from './Multimedia/Images'
import Audios from './Multimedia/Audios'
import { memo } from 'react'
import AgentThinkingLoader from './AgentThinkingLoader'

interface MessageProps {
  message: ChatMessage
}

/** Left gutter: fixed width so meta rows + bubbles share one text edge. */
export const MESSAGE_AVATAR_COL = 'flex w-9 shrink-0 justify-center'
export const MESSAGE_THREAD_GAP = 'gap-4'

const AgentMessage = ({ message }: MessageProps) => {
  const { streamingErrorMessage } = useStore()
  let messageContent
  if (message.streamingError) {
    messageContent = (
      <p className="text-destructive">
        Oops! Something went wrong while streaming.{' '}
        {streamingErrorMessage ? (
          <>{streamingErrorMessage}</>
        ) : (
          'Please try refreshing the page or try again later.'
        )}
      </p>
    )
  } else if (message.content) {
    messageContent = (
      <div className="flex min-w-0 flex-col gap-4">
        <MarkdownRenderer>{message.content}</MarkdownRenderer>
        {message.videos && message.videos.length > 0 && (
          <Videos videos={message.videos} />
        )}
        {message.images && message.images.length > 0 && (
          <Images images={message.images} />
        )}
        {message.audio && message.audio.length > 0 && (
          <Audios audio={message.audio} />
        )}
      </div>
    )
  } else if (message.response_audio) {
    if (!message.response_audio.transcript) {
      messageContent = (
        <div className="flex items-start">
          <AgentThinkingLoader />
        </div>
      )
    } else {
      messageContent = (
        <div className="flex w-full min-w-0 flex-col gap-4">
          <MarkdownRenderer>
            {message.response_audio.transcript}
          </MarkdownRenderer>
          {message.response_audio.content && message.response_audio && (
            <Audios audio={[message.response_audio]} />
          )}
        </div>
      )
    }
  } else {
    messageContent = (
      <div>
        <AgentThinkingLoader />
      </div>
    )
  }

  return (
    <div
      className={`flex flex-row items-start font-sans ${MESSAGE_THREAD_GAP}`}
    >
      <div className={`${MESSAGE_AVATAR_COL} pt-0.5`}>
        <Icon
          type="agent"
          size="sm"
          className="text-primary"
          aria-hidden="true"
        />
        <span className="sr-only">Agent</span>
      </div>
      <div className="min-w-0 flex-1">{messageContent}</div>
    </div>
  )
}

const UserMessage = memo(({ message }: MessageProps) => {
  return (
    <div
      className={`flex items-start text-start max-md:break-words ${MESSAGE_THREAD_GAP}`}
    >
      <div className={`${MESSAGE_AVATAR_COL} pt-3`}>
        <Icon
          type="user"
          size="sm"
          className="text-foreground"
          aria-hidden="true"
        />
      </div>
      <div className="min-w-0 max-w-[min(100%,56rem)] rounded-2xl rounded-tl-md border border-border/60 bg-gradient-to-br from-secondary/90 to-muted/80 px-4 py-3 text-sm leading-relaxed text-foreground shadow-sm">
        {message.content && (
          <p className="whitespace-pre-wrap">{message.content}</p>
        )}
        {message.attachments && message.attachments.length > 0 && (
          <div
            className={`flex flex-wrap gap-2 ${message.content ? 'mt-2' : ''}`}
          >
            {message.attachments.map((attachment, index) => (
              <span
                key={`${attachment.name}-${index}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/80 px-2.5 py-1 text-xs text-muted-foreground"
              >
                <Icon type="sheet" size="xxs" aria-hidden="true" />
                {attachment.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
})

AgentMessage.displayName = 'AgentMessage'
UserMessage.displayName = 'UserMessage'
export { AgentMessage, UserMessage }
