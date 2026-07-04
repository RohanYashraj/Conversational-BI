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

/**
 * Assistant reply — full-width plain text at the column's left edge, no
 * bubble and no avatar (the modern public-LLM pattern: ChatGPT, Claude,
 * Gemini all frame the model reply as document text, not a chat bubble).
 */
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
    <div className="min-w-0 font-sans">
      <span className="sr-only">Assistant</span>
      {messageContent}
    </div>
  )
}

/**
 * User message — right-aligned bubble capped at ~75% of the column, the
 * universal sent-message convention in public LLM interfaces.
 */
const UserMessage = memo(({ message }: MessageProps) => {
  return (
    <div className="flex justify-end font-sans max-md:break-words">
      <div className="min-w-0 max-w-[75%] rounded-3xl rounded-br-lg bg-secondary px-4 py-2.5 text-sm leading-relaxed text-foreground">
        <span className="sr-only">You</span>
        {message.content && (
          <p className="whitespace-pre-wrap">{message.content}</p>
        )}
        {message.attachments && message.attachments.length > 0 && (
          <div
            className={`flex flex-wrap justify-end gap-2 ${message.content ? 'mt-2' : ''}`}
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
