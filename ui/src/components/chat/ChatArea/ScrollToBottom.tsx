'use client'

import type React from 'react'

import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useStickToBottomContext } from 'use-stick-to-bottom'

import { Button } from '@/components/ui/button'
import Icon from '@/components/ui/icon'

const ScrollToBottom: React.FC = () => {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext()
  const reduceMotion = useReducedMotion()

  return (
    <AnimatePresence>
      {!isAtBottom && (
        <motion.div
          initial={{ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 20 }}
          transition={{ duration: reduceMotion ? 0 : 0.3, ease: 'easeInOut' }}
          className="absolute bottom-4 left-1/2 -translate-x-1/2"
        >
          <Button
            onClick={() => scrollToBottom()}
            type="button"
            size="icon"
            variant="secondary"
            aria-label="Scroll to latest messages"
            className="rounded-full border border-border/80 bg-card/95 text-foreground shadow-md transition-colors duration-300 hover:bg-muted"
          >
            <Icon type="arrow-down" size="xs" aria-hidden="true" />
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default ScrollToBottom
