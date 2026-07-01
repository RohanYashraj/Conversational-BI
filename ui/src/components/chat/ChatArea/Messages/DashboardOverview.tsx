'use client'

import { useEffect, useState } from 'react'

import { useQueryState } from 'nuqs'

import { getDashboardAPI } from '@/api/os'
import { constructEndpointUrl } from '@/lib/constructEndpointUrl'
import useAIChatStreamHandler from '@/hooks/useAIStreamHandler'
import { useStore } from '@/store'
import type { DashboardCut, DashboardData } from '@/types/os'
import VegaLiteChart from '@/components/ui/typography/MarkdownRenderer/VegaLiteChart'

// ---- formatting helpers ---------------------------------------------------
const fmtCurrency = (v: number) => {
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `$${(v / 1_000).toFixed(1)}K`
  return `$${v.toFixed(0)}`
}
const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`
const fmtInt = (v: number) => v.toLocaleString('en-US')

const CURRENCY_COLS = new Set(['premium', 'premium_change', 'total_gwp'])
const PCT_COLS = new Set([
  'wtd_rate_change',
  'avg_loss_ratio',
  'retention',
  'rate_change'
])
const INT_COLS = new Set(['policies', 'policy_count'])

const formatCell = (col: string, value: string | number | null): string => {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'number') {
    if (CURRENCY_COLS.has(col)) return fmtCurrency(value)
    if (PCT_COLS.has(col)) return fmtPct(value)
    if (INT_COLS.has(col)) return fmtInt(value)
    return String(value)
  }
  return String(value)
}

const COL_LABELS: Record<string, string> = {
  segment: 'Segment',
  region: 'Region',
  underwriter: 'Underwriter',
  account_name: 'Account',
  quarter: 'Quarter',
  premium: 'Premium',
  premium_change: 'Prem. Δ',
  wtd_rate_change: 'Rate Δ',
  avg_loss_ratio: 'Loss Ratio',
  policies: 'Policies'
}
const colLabel = (c: string) => COL_LABELS[c] ?? c.replace(/_/g, ' ')

// The first column of each cut is the dimension the user drills into.
const DRILL: Record<
  string,
  { title: string; prompt: (v: string) => string } | undefined
> = {
  by_segment: {
    title: 'By Segment',
    prompt: (v) =>
      `Break down the ${v} segment: premium, weighted rate change, loss ratio and new-vs-renewal mix — and explain what's driving it.`
  },
  by_region: {
    title: 'By Region',
    prompt: (v) =>
      `Focus on ${v}: premium, weighted rate change and loss ratio by segment, and what's driving performance there.`
  },
  by_underwriter: {
    title: 'By Underwriter',
    prompt: (v) =>
      `How is underwriter ${v} performing? Premium, weighted rate change and loss ratio, with a short explanation.`
  },
  top_accounts: {
    title: 'Top Accounts',
    prompt: (v) =>
      `Tell me about the ${v} account: premium, rate change and loss ratio, and whether its book is concentrated.`
  }
}

const HEADLINE: Array<{ key: string; label: string; kind: 'money' | 'pct' | 'int' }> =
  [
    { key: 'total_gwp', label: 'Total GWP', kind: 'money' },
    { key: 'wtd_rate_change', label: 'Weighted Rate Change', kind: 'pct' },
    { key: 'avg_loss_ratio', label: 'Avg Loss Ratio', kind: 'pct' },
    { key: 'retention', label: 'Renewal Retention', kind: 'pct' },
    { key: 'policy_count', label: 'Policies', kind: 'int' }
  ]

// ---- components -----------------------------------------------------------
const KpiCard = ({ label, value }: { label: string; value: string }) => (
  <div className="flex min-w-[140px] flex-1 flex-col gap-1 rounded-lg border border-border bg-card/60 px-4 py-3">
    <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
      {label}
    </p>
    <p className="font-display text-xl font-semibold text-foreground">{value}</p>
  </div>
)

const CutCard = ({
  cut,
  name,
  onDrill
}: {
  cut: DashboardCut
  name: string
  onDrill?: (value: string) => void
}) => {
  const meta = DRILL[name]
  if (!cut || cut.error || cut.rows.length === 0) return null
  const cols = cut.columns
  const dim = cols[0]
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-card/60">
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-2">
        <p className="text-xs font-semibold text-foreground">
          {meta?.title ?? colLabel(dim)}
        </p>
        {meta && onDrill && (
          <span className="text-[0.6rem] uppercase tracking-wide text-muted-foreground">
            Click a row to drill in
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              {cols.map((c) => (
                <th key={c} className="px-3 py-1.5 font-medium">
                  {colLabel(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cut.rows.map((row, i) => {
              const dimVal = String(row[dim] ?? '')
              const clickable = Boolean(meta && onDrill)
              return (
                <tr
                  key={`${dimVal}-${i}`}
                  onClick={clickable ? () => onDrill?.(meta!.prompt(dimVal)) : undefined}
                  className={`border-b border-border/60 last:border-b-0 ${
                    clickable
                      ? 'cursor-pointer transition-colors hover:bg-primary/5'
                      : ''
                  }`}
                >
                  {cols.map((c, ci) => (
                    <td
                      key={c}
                      className={`whitespace-nowrap px-3 py-1.5 ${
                        ci === 0
                          ? 'font-medium text-foreground'
                          : 'tabular-nums text-muted-foreground'
                      }`}
                    >
                      {formatCell(c, row[c])}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const QuarterlyTrend = ({ cut }: { cut: DashboardCut }) => {
  if (!cut || cut.error || cut.rows.length === 0) return null
  const spec = {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    title: 'Weighted Rate Change by Quarter',
    data: { values: cut.rows },
    mark: { type: 'line', point: true },
    encoding: {
      x: { field: 'quarter', type: 'ordinal', title: 'Quarter' },
      y: {
        field: 'wtd_rate_change',
        type: 'quantitative',
        title: 'Rate Change',
        axis: { format: '.1%' }
      }
    }
  }
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card/60 p-3">
      <p className="text-xs font-semibold text-foreground">Quarterly Rate Trend</p>
      <VegaLiteChart source={JSON.stringify(spec)} />
    </div>
  )
}

const DashboardOverview = () => {
  const selectedEndpoint = useStore((s) => s.selectedEndpoint)
  const authToken = useStore((s) => s.authToken)
  const [agentId] = useQueryState('agent')
  const [teamId] = useQueryState('team')
  const { handleStreamResponse } = useAIChatStreamHandler()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    if (!selectedEndpoint) {
      setLoading(false)
      return
    }
    setLoading(true)
    getDashboardAPI(
      constructEndpointUrl(selectedEndpoint),
      authToken || undefined
    ).then((d) => {
      if (!cancelled) {
        setData(d)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [selectedEndpoint, authToken])

  const canDrill = Boolean(agentId || teamId)
  const onDrill = canDrill
    ? (prompt: string) => {
        void handleStreamResponse(prompt)
      }
    : undefined

  if (loading) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Loading portfolio overview…
      </p>
    )
  }
  if (!data || !data.headline) return null

  return (
    <section
      className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-2 pb-8 text-left"
      aria-label="Portfolio overview"
    >
      <div>
        <p className="text-sm font-semibold text-foreground">
          Portfolio overview
        </p>
        <p className="text-xs text-muted-foreground">
          {fmtInt(data.row_count)} policies · every figure is computed from your
          book. Ask a question below, or click a row to drill in.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        {HEADLINE.map(({ key, label, kind }) => {
          const v = data.headline[key]
          if (v === null || v === undefined) return null
          const value =
            kind === 'money' ? fmtCurrency(v) : kind === 'pct' ? fmtPct(v) : fmtInt(v)
          return <KpiCard key={key} label={label} value={value} />
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <CutCard name="by_segment" cut={data.cuts.by_segment} onDrill={onDrill} />
        <CutCard name="by_region" cut={data.cuts.by_region} onDrill={onDrill} />
        <CutCard
          name="by_underwriter"
          cut={data.cuts.by_underwriter}
          onDrill={onDrill}
        />
        <CutCard
          name="top_accounts"
          cut={data.cuts.top_accounts}
          onDrill={onDrill}
        />
      </div>

      <QuarterlyTrend cut={data.cuts.quarterly_trend} />
    </section>
  )
}

export default DashboardOverview
