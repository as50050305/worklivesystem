import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { AppStateProvider } from './app/AppStateProvider'
import { ThemeProvider } from './lib/ThemeContext'
import { queryClient } from './data/queryClient'
import { PwaProvider } from './pwa/PwaProvider'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PwaProvider>
      <QueryClientProvider client={queryClient}>
        <AppStateProvider>
          <ThemeProvider>
            <App />
          </ThemeProvider>
        </AppStateProvider>
      </QueryClientProvider>
    </PwaProvider>
  </StrictMode>,
)
