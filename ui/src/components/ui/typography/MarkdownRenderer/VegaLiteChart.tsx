'use client'

import { useEffect, useRef, useState } from 'react'

import { useTheme } from 'next-themes'

interface VegaLiteChartProps {
  /** Raw text of the ```vega-lite fenced block (a Vega-Lite JSON spec). */
  source: string
}

/**
 * Renders a Vega-Lite spec as an actual chart via vega-embed. The agent emits
 * chart specs inside a ```vega-lite code fence; MarkdownRenderer routes those
 * here so the user sees a visual, never raw JSON. While a response is still
 * streaming the JSON can be incomplete — we show a light placeholder until it
 * parses cleanly.
 */
const VegaLiteChart = ({ source }: VegaLiteChartProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const { resolvedTheme } = useTheme()
  const [failed, setFailed] = useState(false)

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
          spec && spec.width === undefined ? { ...spec, width: 'container' } : spec
        return embed(containerRef.current, responsiveSpec as never, {
          actions: false,
          renderer: 'svg',
          theme: resolvedTheme === 'dark' ? 'dark' : undefined
        })
      })
      .then((result) => {
        if (result) view = result.view
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
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
    <div className="my-2 w-full max-w-[560px] overflow-x-auto rounded-md border border-border bg-background p-3">
      <div ref={containerRef} className="w-full" />
    </div>
  )
}

export default VegaLiteChart
