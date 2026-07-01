'use client'

import Image from 'next/image'
import { motion, useReducedMotion } from 'framer-motion'

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

  return (
    <section
      className="flex flex-col items-center px-2 text-center font-sans"
      aria-label="Welcome message"
    >
      <div className="flex w-full max-w-xl flex-col items-center gap-y-8">
        <motion.div
          initial={{ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reduceMotion ? 0 : 0.45,
            delay: reduceMotion ? 0 : 0.15
          }}
        >
          <Image
            src="/images/logo.png"
            alt="Accenture"
            width={64}
            height={64}
            className="mx-auto size-16 object-contain"
            priority
          />
        </motion.div>

        <motion.div
          initial={{ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reduceMotion ? 0 : 0.45,
            delay: reduceMotion ? 0 : 0.22
          }}
          className="inline-flex items-center rounded-full bg-gradient-to-r from-brand-badgeFrom to-brand-badgeTo px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-primary-foreground shadow-sm"
        >
          KPI Commentary Tool
        </motion.div>

        <motion.h1
          initial={{ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reduceMotion ? 0 : 0.5,
            delay: reduceMotion ? 0 : 0.28
          }}
          className="font-display text-pretty text-balance text-3xl font-semibold leading-snug tracking-tight text-foreground sm:text-4xl"
        >
          Ask questions about your portfolio data
        </motion.h1>

        <motion.p
          initial={{ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reduceMotion ? 0 : 0.45,
            delay: reduceMotion ? 0 : 0.38
          }}
          className="max-w-md text-sm leading-relaxed text-muted-foreground"
        >
          Get grounded answers, charts, and commentary from your book of
          business. Attach a spreadsheet to explore a new dataset, or upload
          documents for additional context.
        </motion.p>

        <motion.div
          initial={{ opacity: reduceMotion ? 1 : 0 }}
          animate={{ opacity: 1 }}
          transition={{
            duration: reduceMotion ? 0 : 0.6,
            delay: reduceMotion ? 0 : 0.5
          }}
          className="pt-2"
        >
          <NodesMotif />
        </motion.div>
      </div>
    </section>
  )
}

export default ChatBlankState
