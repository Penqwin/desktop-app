import { StrictMode } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import DashboardLayout from '@/layouts/DashboardLayout'
import EditorPage from '@/pages/EditorPage'
import SettingsPage from '@/pages/SettingsPage'
import CreateOrgPage from '@/pages/CreateOrgPage'
import './App.css'

import { UserProvider } from '@/core/auth/UserContext'
import { ErrorBoundary } from './ErrorBoundary'

import { Toaster } from 'sonner'

const router = createBrowserRouter([
  {
    path: "/",
    element: <DashboardLayout />,
    children: [
      { index: true, element: <EditorPage /> },
    ],
  },
  {
    path: "/settings",
    element: <SettingsPage />
  },
  {
    path: "/create-org",
    element: <CreateOrgPage />
  }
])

function App() {
  return (
    <ErrorBoundary>
      <UserProvider>
        <Toaster />
        <RouterProvider router={router} />
      </UserProvider>
    </ErrorBoundary>
  )
}

export default App
