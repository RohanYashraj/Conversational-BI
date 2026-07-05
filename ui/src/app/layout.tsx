import type { Metadata } from 'next'
import { DM_Mono, Fraunces, Plus_Jakarta_Sans } from 'next/font/google'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'
import { Analytics } from "@vercel/analytics/next"

const fontSans = Plus_Jakarta_Sans({
  variable: '--font-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700']
})

const fontDisplay = Fraunces({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['500', '600', '700']
})

const dmMono = DM_Mono({
  subsets: ['latin'],
  variable: '--font-dm-mono',
  weight: '400'
})

export const metadata: Metadata = {
  title: 'Accenture KPI Commentary Tool',
  description:
    'Conversational analytics for portfolio and underwriting teams—grounded in data, powered by AI.'
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body
        className={`${fontSans.variable} ${fontDisplay.variable} ${dmMono.variable} font-sans antialiased`}
      >
        <a
          href="#main-content"
          className="fixed left-4 top-4 z-[100] -translate-y-24 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground opacity-0 transition-[opacity,transform] duration-200 focus-visible:translate-y-0 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Skip to main content
        </a>
        <NuqsAdapter>{children}</NuqsAdapter>
        <Analytics />
        <Toaster />
      </body>
    </html>
  )
}
