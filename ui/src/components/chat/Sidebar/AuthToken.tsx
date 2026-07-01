'use client'
import { Button } from '@/components/ui/button'
import { useStore } from '@/store'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useState, useEffect } from 'react'
import Icon from '@/components/ui/icon'

const AuthToken = ({
  hasEnvToken,
  envToken
}: {
  hasEnvToken?: boolean
  envToken?: string
}) => {
  const { authToken, setAuthToken } = useStore()
  const [isEditing, setIsEditing] = useState(false)
  const [tokenValue, setTokenValue] = useState('')
  const [isMounted, setIsMounted] = useState(false)
  const [isHovering, setIsHovering] = useState(false)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (hasEnvToken && envToken && !authToken) {
      setAuthToken(envToken)
      setTokenValue(envToken)
    } else {
      setTokenValue(authToken)
    }
    setIsMounted(true)
  }, [authToken, setAuthToken, hasEnvToken, envToken])

  const handleSave = () => {
    const cleanToken = tokenValue.trim()
    setAuthToken(cleanToken)
    setIsEditing(false)
    setIsHovering(false)
  }

  const handleCancel = () => {
    setTokenValue(authToken)
    setIsEditing(false)
    setIsHovering(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  const handleClear = () => {
    setAuthToken('')
    setTokenValue('')
  }

  const displayValue = authToken
    ? `${'*'.repeat(Math.min(authToken.length, 20))}${authToken.length > 20 ? '…' : ''}`
    : 'NO TOKEN SET'

  return (
    <div className="flex w-full min-w-0 flex-col items-stretch gap-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Auth Token
      </div>
      {isEditing ? (
        <div className="flex w-full min-w-0 items-center gap-1">
          <label htmlFor="auth-token-input" className="sr-only">
            Authentication token
          </label>
          <input
            id="auth-token-input"
            name="auth-token"
            type="password"
            value={tokenValue}
            onChange={(e) => setTokenValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Paste token or API key…"
            autoComplete="off"
            spellCheck={false}
            className="flex h-9 min-w-0 flex-1 items-center rounded-xl border border-border bg-secondary px-3 text-xs font-medium text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSave}
            type="button"
            aria-label="Save authentication token"
            className="shrink-0 hover:bg-muted"
          >
            <Icon type="save" size="xs" aria-hidden="true" />
          </Button>
        </div>
      ) : (
        <div className="flex w-full min-w-0 items-center gap-1">
          <motion.div
            className="relative flex h-9 min-w-0 flex-1 cursor-pointer items-center justify-between rounded-xl border border-border bg-secondary px-3 uppercase"
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            onClick={() => setIsEditing(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setIsEditing(true)
              }
            }}
            role="button"
            tabIndex={0}
            aria-label="Edit authentication token"
            transition={
              reduceMotion
                ? { duration: 0 }
                : { type: 'spring', stiffness: 400, damping: 10 }
            }
          >
            <AnimatePresence mode="wait">
              {isHovering ? (
                <motion.div
                  key="token-display-hover"
                  className="absolute inset-0 flex items-center justify-center"
                  initial={{ opacity: reduceMotion ? 1 : 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: reduceMotion ? 1 : 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.2 }}
                >
                  <p className="flex items-center gap-2 whitespace-nowrap text-xs font-medium text-primary">
                    <Icon type="edit" size="xxs" aria-hidden="true" /> EDIT
                    TOKEN
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="token-display"
                  className="absolute inset-0 flex items-center justify-between px-3"
                  initial={{ opacity: reduceMotion ? 1 : 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: reduceMotion ? 1 : 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.2 }}
                >
                  <p className="text-xs font-medium text-muted-foreground">
                    {isMounted ? displayValue : 'NO TOKEN SET'}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          {authToken && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClear}
              type="button"
              aria-label="Clear authentication token"
              className="shrink-0 hover:bg-muted"
            >
              <Icon type="x" size="xs" aria-hidden="true" />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export default AuthToken
