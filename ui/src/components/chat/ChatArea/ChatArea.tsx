'use client'

import { Menu } from 'lucide-react'
import ChatInput from './ChatInput'
import MessageArea from './MessageArea'
import { useStore } from '@/store'

/** Compact top bar shown only on small screens — hamburger opens the sidebar
 * drawer, matching how public LLM apps handle mobile navigation. */
const MobileTopBar = () => {
  const setIsSidebarOpen = useStore((state) => state.setIsSidebarOpen)
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-border/60 px-2 py-2 md:hidden">
      <button
        type="button"
        onClick={() => setIsSidebarOpen(true)}
        aria-label="Open sidebar"
        className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Menu className="size-5" aria-hidden="true" />
      </button>
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        KPI Commentary Tool
      </span>
    </div>
  )
}

const ChatArea = () => {
  return (
    <main
      id="main-content"
      className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-card/80 shadow-sm backdrop-blur-md backdrop-saturate-150 md:rounded-2xl md:border md:border-border/70"
      tabIndex={-1}
    >
      <MobileTopBar />
      <MessageArea />
      <div className="sticky bottom-0 shrink-0 px-2 pb-2 pt-1 md:px-4 md:pb-3">
        <ChatInput />
      </div>
    </main>
  )
}

export default ChatArea
