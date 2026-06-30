import { type FC } from 'react'

import {
  TooltipProvider,
  Tooltip as BaseTooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip/tooltip'

import type { TooltipProps } from '@/components/ui/tooltip/types'

const Tooltip: FC<TooltipProps> = ({
  className,
  children,
  content,
  side,
  delayDuration,
  contentClassName,
  ariaLabel
}) => (
  <TooltipProvider delayDuration={delayDuration}>
    <BaseTooltip>
      <TooltipTrigger className={className} aria-label={ariaLabel}>
        {children}
      </TooltipTrigger>
      <TooltipContent side={side} className={contentClassName}>
        {content}
      </TooltipContent>
    </BaseTooltip>
  </TooltipProvider>
)

export default Tooltip
