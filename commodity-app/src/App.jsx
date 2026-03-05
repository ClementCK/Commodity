import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { ToastProvider } from './components/Toast'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'

// Lazy-loaded pages for code splitting
const Login = lazy(() => import('./pages/Login'))
const Signup = lazy(() => import('./pages/Signup'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Kanban = lazy(() => import('./pages/Kanban'))
const DealForm = lazy(() => import('./pages/DealForm'))
const DealDetail = lazy(() => import('./pages/DealDetail'))
const DealAnalysis = lazy(() => import('./pages/DealAnalysis'))
const Assistant = lazy(() => import('./pages/Assistant'))
const Settings = lazy(() => import('./pages/Settings'))

function PageLoader() {
  return (
    <div className="loading-spinner">
      <div className="spinner" />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Public routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />

                {/* Protected routes with layout */}
                <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/kanban" element={<Kanban />} />
                  <Route path="/assistant" element={<Assistant />} />
                  <Route path="/deals/new" element={<DealForm />} />
                  <Route path="/deals/:id" element={<DealDetail />} />
                  <Route path="/deals/:id/edit" element={<DealForm />} />
                  <Route path="/deals/:id/analysis" element={<DealAnalysis />} />
                  <Route
                    path="/settings"
                    element={
                      <ProtectedRoute adminOnly>
                        <Settings />
                      </ProtectedRoute>
                    }
                  />
                </Route>
              </Routes>
            </Suspense>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
