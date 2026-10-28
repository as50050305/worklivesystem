import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAppState } from '@/app/AppStateProvider'
import { Spinner } from '@/components/ui'
import { AppShell, PublicFrame } from '@/layout/AppShell'
import { NAV_ITEMS } from '@/layout/nav'
import { HomePage } from '@/pages/HomePage'
import { ClientDetailPage } from '@/pages/ClientDetailPage'
import { ClientsPage } from '@/pages/ClientsPage'
import { CollectionsPage } from '@/pages/CollectionsPage'
import { ContactsPage } from '@/pages/ContactsPage'
import { PlaceholderPage } from '@/pages/PlaceholderPage'
import { ProjectDetailPage } from '@/pages/ProjectDetailPage'
import { ProjectsPage } from '@/pages/ProjectsPage'
import { QuoteEditorPage } from '@/pages/QuoteEditorPage'
import { QuotesPage } from '@/pages/QuotesPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { SetupPage } from '@/pages/SetupPage'
import { TimelinePage } from '@/pages/TimelinePage'

// Style Guide 較大且不常用，拆成獨立 chunk
const StyleGuidePage = lazy(() => import('@/pages/StyleGuidePage').then((m) => ({ default: m.StyleGuidePage })))

function FullScreenLoading() {
  return (
    <div className="grid min-h-dvh place-items-center text-text-2">
      <Spinner size={28} />
    </div>
  )
}

/** 免登入：只要已設定 Supabase 就直接進入 App */
function RequireSetup({ children }: { children: ReactNode }) {
  const { configured, loading } = useAppState()
  if (!configured) return <SetupPage />
  if (loading) return <FullScreenLoading />
  return <AppShell>{children}</AppShell>
}

/** Style Guide：已設定 Supabase 時在 App 內顯示；未設定時也可單獨預覽 */
function StyleGuideRoute() {
  const { configured, loading } = useAppState()
  if (loading) return <FullScreenLoading />
  const page = (
    <Suspense fallback={<FullScreenLoading />}>
      <StyleGuidePage />
    </Suspense>
  )
  return configured ? <AppShell>{page}</AppShell> : <PublicFrame>{page}</PublicFrame>
}

export function App() {
  const placeholders = NAV_ITEMS.filter((n) => n.phase)
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/style-guide" element={<StyleGuideRoute />} />
        <Route
          path="/"
          element={
            <RequireSetup>
              <HomePage />
            </RequireSetup>
          }
        />
        <Route
          path="/timeline"
          element={
            <RequireSetup>
              <TimelinePage />
            </RequireSetup>
          }
        />
        <Route
          path="/clients"
          element={
            <RequireSetup>
              <ClientsPage />
            </RequireSetup>
          }
        />
        <Route
          path="/clients/:id"
          element={
            <RequireSetup>
              <ClientDetailPage />
            </RequireSetup>
          }
        />
        <Route
          path="/contacts"
          element={
            <RequireSetup>
              <ContactsPage />
            </RequireSetup>
          }
        />
        <Route
          path="/collections"
          element={
            <RequireSetup>
              <CollectionsPage />
            </RequireSetup>
          }
        />
        <Route
          path="/projects"
          element={
            <RequireSetup>
              <ProjectsPage />
            </RequireSetup>
          }
        />
        <Route
          path="/projects/:id"
          element={
            <RequireSetup>
              <ProjectDetailPage />
            </RequireSetup>
          }
        />
        <Route
          path="/quotes"
          element={
            <RequireSetup>
              <QuotesPage />
            </RequireSetup>
          }
        />
        <Route
          path="/quotes/:id"
          element={
            <RequireSetup>
              <QuoteEditorPage />
            </RequireSetup>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireSetup>
              <SettingsPage />
            </RequireSetup>
          }
        />
        {placeholders.map((n) => (
          <Route
            key={n.to}
            path={n.to}
            element={
              <RequireSetup>
                <PlaceholderPage title={n.label} phase={n.phase} />
              </RequireSetup>
            }
          />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
