'use client'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { ModeSelector } from '@/components/chat/Sidebar/ModeSelector'
import { EntitySelector } from '@/components/chat/Sidebar/EntitySelector'
import useChatActions from '@/hooks/useChatActions'
import { useStore } from '@/store'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useState, useEffect, useRef, useCallback } from 'react'
import Icon from '@/components/ui/icon'
import { getProviderIcon } from '@/lib/modelProvider'
import Sessions from './Sessions'
import AuthToken from './AuthToken'
import { isValidUrl } from '@/lib/utils'
import { toast } from 'sonner'
import { useQueryState } from 'nuqs'
import { truncateText } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { useIsMobile } from '@/hooks/useIsMobile'
import { ChevronDown, Settings2 } from 'lucide-react'

const ENDPOINT_PLACEHOLDER = 'NO ENDPOINT ADDED'

/** Single horizontal track: full width of padded aside, respects flex min-width for truncation */
const sidebarTrack = 'w-full min-w-0'

const SIDEBAR_WIDTH_STORAGE_KEY = 'agent-ui-sidebar-width-px'
const SIDEBAR_DEFAULT_WIDTH_PX = 256
const SIDEBAR_MIN_WIDTH_PX = 200
const SIDEBAR_MAX_WIDTH_PX = 520
const SIDEBAR_COLLAPSED_WIDTH_PX = 44

function clampSidebarWidth(
  w: number,
  viewportWidth: number = typeof window !== 'undefined'
    ? window.innerWidth
    : 1200
): number {
  const maxByViewport = Math.max(
    SIDEBAR_MIN_WIDTH_PX,
    Math.min(SIDEBAR_MAX_WIDTH_PX, viewportWidth - 280)
  )
  return Math.min(maxByViewport, Math.max(SIDEBAR_MIN_WIDTH_PX, Math.round(w)))
}

const SidebarHeader = () => (
  <div className={`flex items-center gap-3 pr-9 ${sidebarTrack}`}>
    <Image
      src="/images/logo.png"
      alt="Accenture"
      width={36}
      height={36}
      className="size-9 shrink-0 object-contain"
      priority
    />
    <div className="flex min-w-0 flex-col leading-tight">
      <span className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-foreground">
        Accenture
      </span>
      <span className="text-[0.6rem] font-medium uppercase tracking-wider text-muted-foreground">
        KPI Commentary Tool
      </span>
    </div>
  </div>
)

const NewChatButton = ({
  disabled,
  onClick
}: {
  disabled: boolean
  onClick: () => void
}) => (
  <Button
    onClick={onClick}
    disabled={disabled}
    className={`h-10 rounded-full bg-primary text-xs font-semibold uppercase tracking-wide text-primary-foreground shadow-sm transition-opacity hover:bg-primary/90 disabled:opacity-50 ${sidebarTrack}`}
  >
    <Icon
      type="plus-icon"
      size="xs"
      className="text-primary-foreground"
      aria-hidden="true"
    />
    <span>New Chat</span>
  </Button>
)

const ModelDisplay = ({ model }: { model: string }) => (
  <div
    className={`flex h-9 items-center gap-3 rounded-xl border border-border/80 bg-muted/80 px-3 text-xs font-medium text-muted-foreground ${sidebarTrack}`}
  >
    {(() => {
      const icon = getProviderIcon(model)
      return icon ? (
        <Icon type={icon} className="shrink-0 text-foreground" size="xs" />
      ) : null
    })()}
    <span className="min-w-0 truncate">{model}</span>
  </div>
)

const Endpoint = () => {
  const {
    selectedEndpoint,
    isEndpointActive,
    setSelectedEndpoint,
    setAgents,
    setSessionsData,
    setMessages
  } = useStore()
  const { initialize } = useChatActions()
  const [isEditing, setIsEditing] = useState(false)
  const [endpointValue, setEndpointValue] = useState('')
  const [isMounted, setIsMounted] = useState(false)
  const [isHovering, setIsHovering] = useState(false)
  const [isRotating, setIsRotating] = useState(false)
  const [, setAgentId] = useQueryState('agent')
  const [, setSessionId] = useQueryState('session')
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    setEndpointValue(selectedEndpoint)
    setIsMounted(true)
  }, [selectedEndpoint])

  const getStatusColor = (isActive: boolean) =>
    isActive ? 'bg-positive' : 'bg-destructive'

  const handleSave = async () => {
    if (!isValidUrl(endpointValue)) {
      toast.error('Please enter a valid URL')
      return
    }
    const cleanEndpoint = endpointValue.replace(/\/$/, '').trim()
    setSelectedEndpoint(cleanEndpoint)
    setAgentId(null)
    setSessionId(null)
    setIsEditing(false)
    setIsHovering(false)
    setAgents([])
    setSessionsData([])
    setMessages([])
  }

  const handleCancel = () => {
    setEndpointValue(selectedEndpoint)
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

  const handleRefresh = async () => {
    setIsRotating(true)
    await initialize()
    setTimeout(() => setIsRotating(false), 500)
  }

  return (
    <div className={`flex flex-col items-stretch gap-2 ${sidebarTrack}`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        AgentOS
      </div>
      {isEditing ? (
        <div className="flex w-full min-w-0 items-center gap-1">
          <label htmlFor="agentos-endpoint" className="sr-only">
            AgentOS endpoint URL
          </label>
          <input
            id="agentos-endpoint"
            name="agentos-endpoint"
            type="url"
            inputMode="url"
            autoComplete="url"
            spellCheck={false}
            value={endpointValue}
            onChange={(e) => setEndpointValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="https://your-agentos.example.com"
            className="flex h-9 min-w-0 flex-1 items-center rounded-xl border border-border bg-secondary px-3 text-xs font-medium text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSave}
            type="button"
            aria-label="Save endpoint URL"
            className="shrink-0 hover:bg-muted"
          >
            <Icon type="save" size="xs" aria-hidden="true" />
          </Button>
        </div>
      ) : (
        <div className="flex w-full min-w-0 items-center gap-1">
          <motion.div
            className="relative flex h-9 min-w-0 flex-1 cursor-pointer items-center justify-between rounded-xl border border-border bg-secondary px-3"
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
            aria-label="Edit AgentOS endpoint"
            transition={
              reduceMotion
                ? { duration: 0 }
                : { type: 'spring', stiffness: 400, damping: 10 }
            }
          >
            <AnimatePresence mode="wait">
              {isHovering ? (
                <motion.div
                  key="endpoint-display-hover"
                  className="absolute inset-0 flex items-center justify-center"
                  initial={{ opacity: reduceMotion ? 1 : 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: reduceMotion ? 1 : 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.2 }}
                >
                  <p className="flex items-center gap-2 whitespace-nowrap text-xs font-medium text-primary">
                    <Icon type="edit" size="xxs" aria-hidden="true" /> EDIT
                    AGENTOS
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="endpoint-display"
                  className="absolute inset-0 flex items-center justify-between px-3"
                  initial={{ opacity: reduceMotion ? 1 : 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: reduceMotion ? 1 : 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.2 }}
                >
                  <p className="min-w-0 truncate text-xs font-medium text-muted-foreground">
                    {isMounted
                      ? truncateText(selectedEndpoint, 21) ||
                        ENDPOINT_PLACEHOLDER
                      : 'http://localhost:7777'}
                  </p>
                  <div
                    className={`size-2 shrink-0 rounded-full ${getStatusColor(isEndpointActive)}`}
                    title={isEndpointActive ? 'Connected' : 'Disconnected'}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            type="button"
            aria-label="Refresh connection"
            className="shrink-0 hover:bg-muted"
          >
            <motion.div
              key={isRotating ? 'rotating' : 'idle'}
              animate={{ rotate: reduceMotion ? 0 : isRotating ? 360 : 0 }}
              transition={{
                duration: reduceMotion ? 0 : 0.5,
                ease: 'easeInOut'
              }}
            >
              <Icon type="refresh" size="xs" aria-hidden="true" />
            </motion.div>
          </Button>
        </div>
      )}
    </div>
  )
}

/**
 * Connection & workspace plumbing (endpoint, auth, mode, model), tucked into
 * a collapsible group at the sidebar's bottom edge — the spot public LLM apps
 * reserve for settings. Collapsed by default so conversations stay the hero;
 * auto-opens when the endpoint is down so the fix is one glance away.
 */
const SidebarSettings = ({
  hasEnvToken,
  envToken
}: {
  hasEnvToken?: boolean
  envToken?: string
}) => {
  const { isEndpointActive, isEndpointLoading, selectedModel } = useStore()
  const [open, setOpen] = useState(false)
  const [agentId] = useQueryState('agent')
  const [teamId] = useQueryState('team')

  // Surface the connection controls whenever the endpoint is unreachable.
  useEffect(() => {
    if (!isEndpointActive) setOpen(true)
  }, [isEndpointActive])

  return (
    <div className={`mt-auto shrink-0 border-t border-border/60 ${sidebarTrack}`}>
      {open && (
        <div className="flex flex-col gap-4 pb-2 pt-3">
          <Endpoint />
          <AuthToken hasEnvToken={hasEnvToken} envToken={envToken} />
          <div className="flex flex-col items-stretch gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Mode
            </div>
            {isEndpointLoading ? (
              <div className="flex w-full flex-col gap-2">
                {Array.from({ length: 2 }).map((_, index) => (
                  <Skeleton key={index} className="h-9 w-full rounded-xl" />
                ))}
              </div>
            ) : (
              <>
                <ModeSelector />
                <EntitySelector />
                {selectedModel && (agentId || teamId) && (
                  <ModelDisplay model={selectedModel} />
                )}
              </>
            )}
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Settings2 className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="flex-1 text-left">Settings</span>
        <span
          className={`size-2 shrink-0 rounded-full ${
            isEndpointActive ? 'bg-positive' : 'bg-destructive'
          }`}
          title={isEndpointActive ? 'Connected' : 'Disconnected'}
        />
        <ChevronDown
          className={`size-3.5 shrink-0 transition-transform duration-200 ${
            open ? '' : 'rotate-180'
          }`}
          aria-hidden="true"
        />
      </button>
    </div>
  )
}

/** Everything inside the sidebar — shared by the desktop rail and the mobile
 * overlay drawer (the pattern ChatGPT/Claude use on small screens). Layout
 * follows public LLM apps: brand + New Chat on top, the conversation list as
 * the dominant scrollable middle, settings pinned to the bottom. */
const SidebarBody = ({
  hasEnvToken,
  envToken
}: {
  hasEnvToken?: boolean
  envToken?: string
}) => {
  const { clearChat, focusChatInput } = useChatActions()
  const { messages, isEndpointActive, setIsSidebarOpen } = useStore()
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const handleNewChat = () => {
    clearChat()
    focusChatInput()
    setIsSidebarOpen(false)
  }

  return (
    <>
      <div className={`shrink-0 space-y-5 ${sidebarTrack}`}>
        <SidebarHeader />
        <NewChatButton
          disabled={messages.length === 0}
          onClick={handleNewChat}
        />
      </div>
      {isMounted && (
        <>
          {isEndpointActive ? (
            <div className={`flex min-h-0 flex-1 flex-col ${sidebarTrack}`}>
              <Sessions />
            </div>
          ) : (
            <div className={`flex min-h-0 flex-1 flex-col ${sidebarTrack}`}>
              <p className="pt-1 text-xs leading-relaxed text-muted-foreground/70">
                Not connected. Check the endpoint under Settings below.
              </p>
            </div>
          )}
          <SidebarSettings hasEnvToken={hasEnvToken} envToken={envToken} />
        </>
      )}
    </>
  )
}

/** Mobile: hidden by default, slides in over the content with a backdrop.
 * Closes on backdrop tap, the close button, or picking a conversation. */
const MobileSidebar = ({
  hasEnvToken,
  envToken
}: {
  hasEnvToken?: boolean
  envToken?: string
}) => {
  const { isSidebarOpen, setIsSidebarOpen } = useStore()
  const reduceMotion = useReducedMotion()

  return (
    <AnimatePresence>
      {isSidebarOpen && (
        <>
          <motion.div
            key="sidebar-backdrop"
            className="fixed inset-0 z-40 bg-black/40"
            initial={{ opacity: reduceMotion ? 1 : 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: reduceMotion ? 1 : 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
            onClick={() => setIsSidebarOpen(false)}
            aria-hidden="true"
          />
          <motion.aside
            key="sidebar-drawer"
            className="fixed inset-y-0 left-0 z-50 flex w-[85vw] max-w-[320px] flex-col overflow-hidden border-r border-border/70 bg-card px-3 py-3 font-sans shadow-xl"
            initial={{ x: reduceMotion ? 0 : '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: reduceMotion ? 0 : '-100%' }}
            transition={{
              type: 'tween',
              duration: reduceMotion ? 0 : 0.25,
              ease: [0.32, 0.72, 0, 1]
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Conversation and settings"
          >
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="absolute right-3 top-3 z-10 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label="Close sidebar"
              type="button"
            >
              <Icon type="x" size="xs" aria-hidden="true" />
            </button>
            <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-5 overflow-y-auto pt-0.5">
              <SidebarBody hasEnvToken={hasEnvToken} envToken={envToken} />
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

const DesktopSidebar = ({
  hasEnvToken,
  envToken
}: {
  hasEnvToken?: boolean
  envToken?: string
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [sidebarWidthPx, setSidebarWidthPx] = useState(SIDEBAR_DEFAULT_WIDTH_PX)
  const [isResizing, setIsResizing] = useState(false)
  const asideRef = useRef<HTMLElement>(null)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)
      if (raw) {
        const n = parseInt(raw, 10)
        if (!Number.isNaN(n)) {
          setSidebarWidthPx(clampSidebarWidth(n))
        }
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (isCollapsed) return
    try {
      localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(sidebarWidthPx))
    } catch {
      /* ignore */
    }
  }, [sidebarWidthPx, isCollapsed])

  useEffect(() => {
    if (!isResizing) return
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing])

  useEffect(() => {
    if (!isResizing) return
    const onMove = (e: PointerEvent) => {
      const el = asideRef.current
      if (!el) return
      const left = el.getBoundingClientRect().left
      setSidebarWidthPx(clampSidebarWidth(e.clientX - left))
    }
    const onUp = () => setIsResizing(false)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [isResizing])

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (isCollapsed) return
      e.preventDefault()
      e.stopPropagation()
      setIsResizing(true)
    },
    [isCollapsed]
  )

  const handleResizeDoubleClick = useCallback(() => {
    if (isCollapsed) return
    setSidebarWidthPx(SIDEBAR_DEFAULT_WIDTH_PX)
  }, [isCollapsed])

  const asideWidthPx = isCollapsed ? SIDEBAR_COLLAPSED_WIDTH_PX : sidebarWidthPx

  return (
    <motion.aside
      ref={asideRef}
      className="relative flex h-full min-h-0 shrink-0 grow-0 flex-col overflow-hidden rounded-2xl border-y border-l border-border/70 bg-card/80 px-3 py-3 font-sans shadow-sm backdrop-blur-md backdrop-saturate-150"
      style={{
        width: asideWidthPx,
        transition:
          isResizing || reduceMotion
            ? 'none'
            : 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1)'
      }}
      aria-label="Conversation and settings"
    >
      <motion.button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute right-3 top-3 z-10 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-expanded={!isCollapsed}
        type="button"
        whileTap={reduceMotion ? undefined : { scale: 0.95 }}
      >
        <Icon
          type="sheet"
          size="xs"
          className={isCollapsed ? 'rotate-180' : 'rotate-0'}
          aria-hidden="true"
        />
      </motion.button>
      <motion.div
        className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-5 overflow-hidden pt-0.5"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: isCollapsed ? 0 : 1, x: isCollapsed ? -20 : 0 }}
        transition={{
          duration: reduceMotion ? 0 : 0.3,
          ease: 'easeInOut'
        }}
        style={{
          pointerEvents: isCollapsed ? 'none' : 'auto'
        }}
      >
        <SidebarBody hasEnvToken={hasEnvToken} envToken={envToken} />
      </motion.div>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        aria-valuemin={SIDEBAR_MIN_WIDTH_PX}
        aria-valuemax={SIDEBAR_MAX_WIDTH_PX}
        aria-valuenow={isCollapsed ? undefined : sidebarWidthPx}
        aria-hidden={isCollapsed}
        tabIndex={isCollapsed ? -1 : 0}
        onPointerDown={handleResizePointerDown}
        onDoubleClick={handleResizeDoubleClick}
        onKeyDown={(e) => {
          if (isCollapsed) return
          const step = e.shiftKey ? 32 : 12
          if (e.key === 'ArrowLeft') {
            e.preventDefault()
            setSidebarWidthPx((w) => clampSidebarWidth(w - step))
          } else if (e.key === 'ArrowRight') {
            e.preventDefault()
            setSidebarWidthPx((w) => clampSidebarWidth(w + step))
          } else if (e.key === 'Home') {
            e.preventDefault()
            setSidebarWidthPx(SIDEBAR_MIN_WIDTH_PX)
          } else if (e.key === 'End') {
            e.preventDefault()
            setSidebarWidthPx(
              clampSidebarWidth(SIDEBAR_MAX_WIDTH_PX, window.innerWidth)
            )
          }
        }}
        className={`absolute -right-1 top-0 z-20 h-full w-3 cursor-col-resize touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${isCollapsed ? 'pointer-events-none opacity-0' : ''}`}
      />
    </motion.aside>
  )
}

const Sidebar = ({
  hasEnvToken,
  envToken
}: {
  hasEnvToken?: boolean
  envToken?: string
}) => {
  const isMobile = useIsMobile()
  const { hydrated, selectedEndpoint, mode, setIsSidebarOpen } = useStore()
  const { initialize } = useChatActions()
  const [sessionId] = useQueryState('session')

  // Lives here (not in a variant) so it runs even while the drawer is closed.
  useEffect(() => {
    if (hydrated) initialize()
  }, [selectedEndpoint, initialize, hydrated, mode])

  // Picking a conversation (or starting one) closes the mobile drawer.
  useEffect(() => {
    setIsSidebarOpen(false)
  }, [sessionId, setIsSidebarOpen])

  if (isMobile) {
    return <MobileSidebar hasEnvToken={hasEnvToken} envToken={envToken} />
  }
  return <DesktopSidebar hasEnvToken={hasEnvToken} envToken={envToken} />
}

export default Sidebar
