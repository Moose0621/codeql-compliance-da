import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";
import "@github/spark/spark"

import App from './App.tsx'
import { ThemeProvider } from 'next-themes';
import { ErrorFallback } from './ErrorFallback.tsx'

import "./main.css"
import "./styles/theme.css"
import "./index.css"

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    {/* Use data-appearance attribute to align with tailwind darkMode selector configuration */}
    <ThemeProvider attribute="data-appearance" defaultTheme="system" enableSystem>
      <App />
    </ThemeProvider>
  </ErrorBoundary>
)
