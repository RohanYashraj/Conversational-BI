'use client'
import Sidebar from '@/components/chat/Sidebar/Sidebar'
import { ChatArea } from '@/components/chat/ChatArea'
import { Suspense } from 'react'

export default function Home() {
  const hasEnvToken = !!process.env.NEXT_PUBLIC_OS_SECURITY_KEY
  const envToken = process.env.NEXT_PUBLIC_OS_SECURITY_KEY || ''
  return (
    <Suspense
      fallback={
        <div
          className="flex min-h-screen items-center justify-center font-sans text-muted-foreground"
          aria-live="polite"
          aria-busy="true"
        >
          Loading…
        </div>
      }
    >
      <div className="box-border flex h-dvh min-h-0 flex-row overflow-hidden md:gap-2 md:p-2">
        <Sidebar hasEnvToken={hasEnvToken} envToken={envToken} />
        <ChatArea />
      </div>
    </Suspense>
  )
}
