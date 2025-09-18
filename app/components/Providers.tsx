'use client'

import { Toaster } from 'sonner'

export function Providers() {
  return (
    <Toaster 
      position="top-right"
      toastOptions={{
        style: {
          background: 'rgba(30, 30, 30, 0.9)',
          color: 'white',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(8px)',
        },
      }}
    />
  )
} 