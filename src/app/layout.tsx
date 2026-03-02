import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Playfair_Display, Source_Sans_3 } from 'next/font/google'
import './globals.css'

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Aplikasi UTS | SMK Bintang Sembilan',
  description: 'Aplikasi ujian tengah semester berbasis essay',
}

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="id">
      <body className={`${playfair.variable} ${sourceSans.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  )
}