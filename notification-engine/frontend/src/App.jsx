import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from './components/ThemeProvider'
import { ToastProvider } from './components/ui/toast'
import { TooltipProvider } from './components/ui/tooltip'
import { AppRoutes } from './routes'

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <TooltipProvider delayDuration={400}>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
