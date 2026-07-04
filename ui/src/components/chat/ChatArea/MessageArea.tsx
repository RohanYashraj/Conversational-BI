'use client'

import { useStore } from '@/store'
import Messages from './Messages'
import ScrollToBottom from '@/components/chat/ChatArea/ScrollToBottom'
import { StickToBottom, useStickToBottomContext } from 'use-stick-to-bottom'
import { useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'

/** Frosted strip at the top of the scroll region; intensifies as the user scrolls up. */
function ChatScrollTopGlass() {
  const { scrollRef } = useStickToBottomContext()
  const reduceMotion = useReducedMotion()
  const [fade, setFade] = useState(0)

  const updateFade = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const overflow = el.scrollHeight > el.clientHeight + 1
    if (!overflow) {
      setFade(0)
      return
    }
    // Gentle ramp—no hard pop when scrolling.
    setFade(Math.min(1, el.scrollTop / 72))
  }, [scrollRef])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    updateFade()
    el.addEventListener('scroll', updateFade, { passive: true })
    const ro = new ResizeObserver(updateFade)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', updateFade)
      ro.disconnect()
    }
  }, [scrollRef, updateFade])

  const veilOpacity = fade * 0.62

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 z-20 h-8 rounded-t-2xl transition-opacity duration-300 [transition-timing-function:cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none"
      style={{
        opacity: veilOpacity,
        background:
          'linear-gradient(180deg, hsl(var(--card) / 0.16) 0%, hsl(var(--card) / 0.07) 28%, hsl(var(--card) / 0.025) 58%, transparent 100%)',
        maskImage:
          'linear-gradient(180deg, #000 0%, #000 18%, transparent 100%)',
        WebkitMaskImage:
          'linear-gradient(180deg, #000 0%, #000 18%, transparent 100%)',
        ...(reduceMotion || fade === 0
          ? {}
          : {
              backdropFilter: 'blur(5px)',
              WebkitBackdropFilter: 'blur(5px)'
            })
      }}
    />
  )
}

const MessageArea = () => {
  const { messages } = useStore()

  return (
    <StickToBottom
      className="relative mb-4 flex max-h-[calc(100vh-64px)] min-h-0 flex-grow flex-col"
      resize="smooth"
      initial="smooth"
    >
      <StickToBottom.Content className="flex min-h-full flex-col justify-center">
        <div className="mx-auto w-full max-w-4xl space-y-7 px-4 pb-4">
          <Messages messages={messages} />
        </div>
      </StickToBottom.Content>
      <ChatScrollTopGlass />
      <ScrollToBottom />
    </StickToBottom>
  )
}

export default MessageArea
