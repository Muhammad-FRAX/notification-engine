import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { Spinner } from './components/ui/spinner'

const Dashboard        = lazy(() => import('./pages/Dashboard'))
const NotificationList = lazy(() => import('./pages/Notifications/List'))
const NotificationDetail = lazy(() => import('./pages/Notifications/Detail'))
const Sources          = lazy(() => import('./pages/Sources'))
const UsersPage        = lazy(() => import('./pages/Recipients/Users'))
const ChannelsPage     = lazy(() => import('./pages/Recipients/Channels'))
const GroupsList       = lazy(() => import('./pages/Groups/List'))
const GroupDetail      = lazy(() => import('./pages/Groups/Detail'))
const TemplatesList    = lazy(() => import('./pages/Templates/List'))
const TemplateEditor   = lazy(() => import('./pages/Templates/Editor'))
const Rules            = lazy(() => import('./pages/Rules'))
const Settings         = lazy(() => import('./pages/Settings'))
const Demo             = lazy(() => import('./pages/Demo'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-40">
      <Spinner />
    </div>
  )
}

export function AppRoutes() {
  return (
    <AppShell>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/"                       element={<Dashboard />} />
          <Route path="/notifications"          element={<NotificationList />} />
          <Route path="/notifications/:id"      element={<NotificationDetail />} />
          <Route path="/sources"                element={<Sources />} />
          <Route path="/recipients/users"       element={<UsersPage />} />
          <Route path="/recipients/channels"    element={<ChannelsPage />} />
          <Route path="/groups"                 element={<GroupsList />} />
          <Route path="/groups/:id"             element={<GroupDetail />} />
          <Route path="/templates"              element={<TemplatesList />} />
          <Route path="/templates/:id"          element={<TemplateEditor />} />
          <Route path="/rules"                  element={<Rules />} />
          <Route path="/settings"               element={<Settings />} />
          <Route path="/demo"                   element={<Demo />} />
          <Route path="*"                       element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AppShell>
  )
}
