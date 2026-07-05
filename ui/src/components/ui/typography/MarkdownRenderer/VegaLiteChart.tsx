'use client'

import { useEffect, useRef, useState } from 'react'

import { Download } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useQueryState } from 'nuqs'

import { useStore } from '@/store'
import useAIChatStreamHandler from '@/hooks/useAIStreamHandler'

interface VegaLiteChartProps {
  /** Raw text of the ```vega-lite fenced block (a Vega-Lite JSON spec). */
  source: string
  /** Fill the container (dashboard cards) instead of the ~560px cap used for
   * inline chat charts. */
  fullWidth?: boolean
}

// Datum fields that are chart plumbing, not data the user would drill into.
const DRILL_EXCLUDED_KEYS = new Set(['label', 'kind', 'amount_label', 'order'])

/** Build a drill prompt from a clicked mark's datum, e.g. clicking the Q3
 * point of a trend → "Drill into quarter 3: …". Returns null when the datum
 * has nothing meaningful to drill into (e.g. waterfall plumbing fields). */
const drillPromptFromDatum = (datum: Record<string, unknown>): string | null => {
  const pairs = Object.entries(datum)
    .filter(([key, value]) => {
      if (key.startsWith('_') || DRILL_EXCLUDED_KEYS.has(key)) return false
      if (typeof value === 'string') return true
      // Periods come through as small integers (quarter 1-8, month 1-12).
      return (
        typeof value === 'number' &&
        Number.isInteger(value) &&
        /quarter|month|year|qtr/i.test(key)
      )
    })
    .map(([key, value]) => `${key.replace(/_/g, ' ')} ${value}`)
  if (pairs.length === 0) return null
  return `Drill into ${pairs.join(', ')}: break it down and explain what's driving it.`
}

/**
 * Renders a Vega-Lite spec as an actual chart via vega-embed. The agent emits
 * chart specs inside a ```vega-lite code fence; MarkdownRenderer routes those
 * here so the user sees a visual, never raw JSON. While a response is still
 * streaming the JSON can be incomplete — we show a light placeholder until it
 * parses cleanly. Clicking a mark drills into that datum via chat.
 */
const VegaLiteChart = ({ source, fullWidth = false }: VegaLiteChartProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const { resolvedTheme } = useTheme()
  const [failed, setFailed] = useState(false)

  const { handleStreamResponse } = useAIChatStreamHandler()
  const isStreaming = useStore((state) => state.isStreaming)
  const [agentId] = useQueryState('agent')
  const [teamId] = useQueryState('team')
  const canDrill = Boolean(agentId || teamId)

  // Live vega view, kept for PNG export.
  const viewRef = useRef<{
    toImageURL: (type: string, scaleFactor?: number) => Promise<string>
  } | null>(null)

  const handleDownloadPng = () => {
    viewRef.current
      ?.toImageURL('png', 2)
      .then((url) => {
        const link = document.createElement('a')
        link.href = url
        link.download = 'chart.png'
        link.click()
      })
      .catch(() => {
        /* export is best-effort */
      })
  }

  // Ref so the embed effect always sees the current send function without
  // re-embedding the chart on every streaming-state change.
  const drillRef = useRef<((prompt: string) => void) | null>(null)
  useEffect(() => {
    drillRef.current =
      canDrill && !isStreaming
        ? (prompt: string) => void handleStreamResponse(prompt)
        : null
  }, [canDrill, isStreaming, handleStreamResponse])

  // Parse defensively: mid-stream the JSON is often incomplete.
  let spec: Record<string, unknown> | null = null
  try {
    spec = JSON.parse(source)
  } catch {
    spec = null
  }

  useEffect(() => {
    if (!spec) return
    let cancelled = false
    let view: { finalize: () => void } | undefined

    import('vega-embed')
      .then(({ default: embed }) => {
        if (cancelled || !containerRef.current) return
        // Make the chart fill the container width unless the spec is explicit.
        const responsiveSpec =
          spec && spec.width === undefined
            ? { ...spec, width: 'container' }
            : spec
        return embed(containerRef.current, responsiveSpec as never, {
          actions: false,
          renderer: 'svg',
          theme: resolvedTheme === 'dark' ? 'dark' : undefined
        })
      })
      .then((result) => {
        if (!result) return
        view = result.view
        viewRef.current = result.view as unknown as {
          toImageURL: (type: string, scaleFactor?: number) => Promise<string>
        }
        // Click a mark to drill into that datum via chat.
        result.view.addEventListener('click', (_event, item) => {
          const datum = (item as { datum?: Record<string, unknown> } | null)
            ?.datum
          const drill = drillRef.current
          if (!datum || !drill) return
          const prompt = drillPromptFromDatum(datum)
          if (prompt) drill(prompt)
        })
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
      viewRef.current = null
      view?.finalize()
    }
    // Re-embed when the spec text or theme changes.
  }, [source, resolvedTheme]) // eslint-disable-line react-hooks/exhaustive-deps

  if (failed) {
    return (
      <div className="my-2 rounded-md border border-border/60 bg-muted/40 p-3 text-sm text-muted-foreground">
        Chart could not be rendered.
      </div>
    )
  }

  if (!spec) {
    return (
      <div className="my-2 rounded-md border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
        Rendering chart…
      </div>
    )
  }

  return (
    <div
      className={`group/chart relative my-2 w-full overflow-x-auto rounded-md border border-border bg-background p-3 ${
        fullWidth ? '' : 'max-w-[560px]'
      }`}
    >
      <button
        type="button"
        onClick={handleDownloadPng}
        aria-label="Download chart as PNG"
        title="Download PNG"
        className="absolute right-1.5 top-1.5 z-10 flex items-center gap-1 rounded-md border border-border/60 bg-card/90 px-1.5 py-1 text-[0.65rem] font-medium text-muted-foreground opacity-0 shadow-sm backdrop-blur-sm transition-opacity hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover/chart:opacity-100"
      >
        <Download className="size-3" aria-hidden="true" />
        PNG
      </button>
      <div
        ref={containerRef}
        className={`w-full ${canDrill ? '[&_svg]:cursor-pointer' : ''}`}
      />
    </div>
  )
}

export default VegaLiteChart
