'use client'

import { useState } from 'react'

import Image from 'next/image'
import { motion, useReducedMotion } from 'framer-motion'
import { ChevronDown, LayoutDashboard } from 'lucide-react'

import DashboardOverview from './DashboardOverview'

const NodesMotif = () => (
  <svg
    width="120"
    height="36"
    viewBox="0 0 120 36"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="text-primary/50"
    aria-hidden="true"
  >
    <circle cx="22" cy="18" r="10" stroke="currentColor" strokeWidth="1.25" />
    <circle cx="60" cy="18" r="10" stroke="currentColor" strokeWidth="1.25" />
    <circle cx="98" cy="18" r="10" stroke="currentColor" strokeWidth="1.25" />
    <circle cx="22" cy="18" r="2" fill="currentColor" />
    <circle cx="60" cy="18" r="2" fill="currentColor" />
    <circle cx="98" cy="18" r="2" fill="currentColor" />
  </svg>
)

const ChatBlankState = () => {
  const reduceMotion = useReducedMotion()
  const [showDashboard, setShowDashboard] = useState(false)

  return (
    <section
      className="flex w-full flex-col items-center px-2 font-sans"
      aria-label="Welcome message"
    >
      <div className="flex w-full max-w-xl flex-col items-center gap-y-4 text-center">
        <motion.div
          initial={{ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reduceMotion ? 0 : 0.45,
            delay: reduceMotion ? 0 : 0.1
          }}
          className="flex items-center gap-3"
        >
          <Image
            src="/images/logo.png"
            alt="Accenture"
            width={40}
            height={40}
            className="size-10 object-contain"
            priority
          />
          <span className="inline-flex items-center rounded-full bg-gradient-to-r from-brand-badgeFrom to-brand-badgeTo px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-primary-foreground shadow-sm">
            KPI Commentary Tool
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reduceMotion ? 0 : 0.5,
            delay: reduceMotion ? 0 : 0.2
          }}
          className="text-balance text-pretty font-display text-2xl font-semibold leading-snug tracking-tight text-foreground sm:text-3xl"
        >
          Ask questions about your portfolio data
        </motion.h1>

        <motion.p
          initial={{ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reduceMotion ? 0 : 0.45,
            delay: reduceMotion ? 0 : 0.3
          }}
          className="max-w-md text-sm leading-relaxed text-muted-foreground"
        >
          Get grounded answers, charts, and commentary from your book of
          business. Ask a question below, or open the portfolio overview.
        </motion.p>

        <button
          type="button"
          onClick={() => setShowDashboard((prev) => !prev)}
          aria-expanded={showDashboard}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
        >
          <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
          {showDashboard ? 'Hide dashboard' : 'Show dashboard'}
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${
              showDashboard ? '' : '-rotate-90'
            }`}
            aria-hidden="true"
          />
        </button>

        {!showDashboard && (
          <div className="pt-1">
            <NodesMotif />
          </div>
        )}
      </div>

      {showDashboard && (
        <motion.div
          initial={{ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.4 }}
          className="mt-6 w-full"
        >
          <DashboardOverview />
        </motion.div>
      )}
    </section>
  )
}

export default ChatBlankState
