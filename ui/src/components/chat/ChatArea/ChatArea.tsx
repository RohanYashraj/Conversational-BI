'use client'

import ChatInput from './ChatInput'
import MessageArea from './MessageArea'
const ChatArea = () => {
  return (
    <main
      id="main-content"
      className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-sm backdrop-blur-md backdrop-saturate-150"
      tabIndex={-1}
    >
      <MessageArea />
      <div className="sticky bottom-0 shrink-0 px-4 pb-3 pt-1">
        <ChatInput />
      </div>
    </main>
  )
}

export default ChatArea
