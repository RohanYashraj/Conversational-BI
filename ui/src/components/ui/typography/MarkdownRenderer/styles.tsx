'use client'

import { FC, ReactNode, useRef, useState } from 'react'
import { Download } from 'lucide-react'

import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils'

import VegaLiteChart from './VegaLiteChart'

import type {
  UnorderedListProps,
  OrderedListProps,
  EmphasizedTextProps,
  ItalicTextProps,
  StrongTextProps,
  BoldTextProps,
  DeletedTextProps,
  UnderlinedTextProps,
  HorizontalRuleProps,
  BlockquoteProps,
  AnchorLinkProps,
  HeadingProps,
  ImgProps,
  ParagraphProps,
  TableHeaderCellProps,
  TableProps,
  TableHeaderProps,
  TableBodyProps,
  TableRowProps,
  TableCellProps,
  PreparedTextProps
} from './types'

import { HEADING_SIZES } from '../Heading/constants'
import { PARAGRAPH_SIZES } from '../Paragraph/constants'

const filterProps = (props: object) => {
  const newProps = { ...props }

  if ('node' in newProps) {
    delete newProps.node
  }

  return newProps
}

const UnorderedList = ({ className, ...props }: UnorderedListProps) => (
  <ul
    className={cn(
      className,
      PARAGRAPH_SIZES.body,
      'flex list-disc flex-col pl-10'
    )}
    {...filterProps(props)}
  />
)

const OrderedList = ({ className, ...props }: OrderedListProps) => (
  <ol
    className={cn(
      className,
      PARAGRAPH_SIZES.body,
      'flex list-decimal flex-col pl-10'
    )}
    {...filterProps(props)}
  />
)

const Paragraph = ({ className, ...props }: ParagraphProps) => (
  <div
    className={cn(className, PARAGRAPH_SIZES.body)}
    {...filterProps(props)}
  />
)

const EmphasizedText = ({ className, ...props }: EmphasizedTextProps) => (
  <em
    className={cn(className, 'text-sm font-semibold')}
    {...filterProps(props)}
  />
)

const ItalicText = ({ className, ...props }: ItalicTextProps) => (
  <i
    className={cn(className, 'italic', PARAGRAPH_SIZES.body)}
    {...filterProps(props)}
  />
)

const StrongText = ({ className, ...props }: StrongTextProps) => (
  <strong
    className={cn(className, 'text-sm font-semibold')}
    {...filterProps(props)}
  />
)

const BoldText = ({ className, ...props }: BoldTextProps) => (
  <b
    className={cn(className, 'text-sm font-semibold')}
    {...filterProps(props)}
  />
)

const UnderlinedText = ({ className, ...props }: UnderlinedTextProps) => (
  <u
    className={cn(className, 'underline', PARAGRAPH_SIZES.body)}
    {...filterProps(props)}
  />
)

const DeletedText = ({ className, ...props }: DeletedTextProps) => (
  <del
    className={cn(
      className,
      'text-muted-foreground line-through',
      PARAGRAPH_SIZES.body
    )}
    {...filterProps(props)}
  />
)

const HorizontalRule = ({ className, ...props }: HorizontalRuleProps) => (
  <hr
    className={cn(className, 'mx-auto w-48 border-b border-border')}
    {...filterProps(props)}
  />
)

const flattenText = (node: ReactNode): string => {
  if (node == null || node === false) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(flattenText).join('')
  if (typeof node === 'object' && 'props' in node) {
    return flattenText(
      (node as { props: { children?: ReactNode } }).props.children
    )
  }
  return ''
}

const Code: FC<{ className?: string; children?: ReactNode }> = ({
  className,
  children,
  ...props
}) => {
  const language = /language-([\w-]+)/.exec(className ?? '')?.[1]

  // A ```vega-lite (or ```vega) fence is a chart spec — render it as a chart,
  // never as raw JSON.
  if (language === 'vega-lite' || language === 'vega') {
    return <VegaLiteChart source={flattenText(children).trim()} />
  }

  return (
    <code
      className={cn(
        className,
        'relative whitespace-pre-wrap rounded-md border border-border/50 bg-muted px-1.5 py-0.5 font-dmmono text-[0.8125rem] text-foreground'
      )}
      {...filterProps(props)}
    >
      {children}
    </code>
  )
}

// Unwrap the default <pre> so a rendered chart isn't nested inside it.
const Pre: FC<PreparedTextProps> = ({ children }) => <>{children}</>

const Blockquote = ({ className, ...props }: BlockquoteProps) => (
  <blockquote
    className={cn(className, 'italic', PARAGRAPH_SIZES.body)}
    {...filterProps(props)}
  />
)

const AnchorLink = ({ className, ...props }: AnchorLinkProps) => (
  <a
    className={cn(
      className,
      'cursor-pointer text-xs font-medium text-primary underline decoration-primary/40 underline-offset-2 transition-colors hover:text-primary/90'
    )}
    target="_blank"
    rel="noopener noreferrer"
    {...filterProps(props)}
  />
)

const Heading1 = ({ className, ...props }: HeadingProps) => (
  <h1 className={cn(className, HEADING_SIZES[3])} {...filterProps(props)} />
)

const Heading2 = ({ className, ...props }: HeadingProps) => (
  <h2 className={cn(className, HEADING_SIZES[3])} {...filterProps(props)} />
)

const Heading3 = ({ className, ...props }: HeadingProps) => (
  <h3 className={cn(className, PARAGRAPH_SIZES.lead)} {...filterProps(props)} />
)

const Heading4 = ({ className, ...props }: HeadingProps) => (
  <h4 className={cn(className, PARAGRAPH_SIZES.lead)} {...filterProps(props)} />
)

const Heading5 = ({ className, ...props }: HeadingProps) => (
  <h5
    className={cn(className, PARAGRAPH_SIZES.title)}
    {...filterProps(props)}
  />
)

const Heading6 = ({ className, ...props }: HeadingProps) => (
  <h6
    className={cn(className, PARAGRAPH_SIZES.title)}
    {...filterProps(props)}
  />
)

const Img = ({ src, alt }: ImgProps) => {
  const [error, setError] = useState(false)

  if (!src || typeof src !== 'string') return null

  return (
    <div className="w-full max-w-xl">
      {error ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-md border border-border/60 bg-muted/50 text-muted-foreground">
          <Paragraph className="text-foreground">Image unavailable</Paragraph>
          <Link
            href={src}
            target="_blank"
            className="max-w-md truncate underline"
          >
            {src}
          </Link>
        </div>
      ) : (
        <Image
          src={src}
          width={1280}
          height={720}
          alt={alt ?? 'Rendered image'}
          className="size-full rounded-md object-cover"
          onError={() => setError(true)}
          unoptimized
        />
      )}
    </div>
  )
}

/** Serialize a rendered table to CSV, quoting cells that need it. */
const tableToCsv = (table: HTMLTableElement): string => {
  const escapeCell = (value: string) =>
    /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
  return Array.from(table.rows)
    .map((row) =>
      Array.from(row.cells)
        .map((cell) => escapeCell((cell.textContent ?? '').trim()))
        .join(',')
    )
    .join('\n')
}

const Table = ({ className, ...props }: TableProps) => {
  const wrapRef = useRef<HTMLDivElement>(null)

  const handleDownloadCsv = () => {
    const table = wrapRef.current?.querySelector('table')
    if (!table) return
    const blob = new Blob([tableToCsv(table)], {
      type: 'text/csv;charset=utf-8;'
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'table.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div
      ref={wrapRef}
      className="group/table relative w-full max-w-[560px] overflow-hidden rounded-md border border-border"
    >
      <button
        type="button"
        onClick={handleDownloadCsv}
        aria-label="Download table as CSV"
        title="Download CSV"
        className="absolute right-1.5 top-1.5 z-10 flex items-center gap-1 rounded-md border border-border/60 bg-card/90 px-1.5 py-1 text-[0.65rem] font-medium text-muted-foreground opacity-0 shadow-sm backdrop-blur-sm transition-opacity hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover/table:opacity-100"
      >
        <Download className="size-3" aria-hidden="true" />
        CSV
      </button>
      <div className="w-full overflow-x-auto">
        <table className={cn(className, 'w-full')} {...filterProps(props)} />
      </div>
    </div>
  )
}

const TableHead = ({ className, ...props }: TableHeaderProps) => (
  <thead
    className={cn(
      className,
      'rounded-md border-b border-border bg-muted/40 p-2 text-left text-sm font-semibold text-foreground'
    )}
    {...filterProps(props)}
  />
)

const TableHeadCell = ({ className, ...props }: TableHeaderCellProps) => (
  <th
    className={cn(className, 'p-2 text-sm font-[600]')}
    {...filterProps(props)}
  />
)

const TableBody = ({ className, ...props }: TableBodyProps) => (
  <tbody className={cn(className, 'text-xs')} {...filterProps(props)} />
)

const TableRow = ({ className, ...props }: TableRowProps) => (
  <tr
    className={cn(className, 'border-b border-border last:border-b-0')}
    {...filterProps(props)}
  />
)

const TableCell = ({ className, ...props }: TableCellProps) => (
  <td
    className={cn(className, 'whitespace-nowrap p-2 font-[400]')}
    {...filterProps(props)}
  />
)

export const components = {
  h1: Heading1,
  h2: Heading2,
  h3: Heading3,
  h4: Heading4,
  h5: Heading5,
  h6: Heading6,
  ul: UnorderedList,
  ol: OrderedList,
  em: EmphasizedText,
  i: ItalicText,
  strong: StrongText,
  b: BoldText,
  u: UnderlinedText,
  del: DeletedText,
  hr: HorizontalRule,
  blockquote: Blockquote,
  code: Code,
  pre: Pre,
  a: AnchorLink,
  img: Img,
  p: Paragraph,
  table: Table,
  thead: TableHead,
  th: TableHeadCell,
  tbody: TableBody,
  tr: TableRow,
  td: TableCell
}
