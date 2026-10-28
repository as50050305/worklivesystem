import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { AppStateProvider } from './app/AppStateProvider'
import { ThemeProvider } from './lib/ThemeContext'
import { CACHE_BUSTER, CACHE_MAX_AGE, persister } from './data/persist'
import { queryClient } from './data/queryClient'
import { PwaProvider } from './pwa/PwaProvider'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PwaProvider>
      <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: CACHE_MAX_AGE, buster: CACHE_BUSTER }}
        // 快取只是讓畫面先有東西：還原後一律向伺服器重新抓取（離線時會自動等到恢復連線）
        onSuccess={() => void queryClient.invalidateQueries()}
      >
        <AppStateProvider>
          <ThemeProvider>
            <App />
          </ThemeProvider>
        </AppStateProvider>
      </PersistQueryClientProvider>
    </PwaProvider>
  </StrictMode>,
)
