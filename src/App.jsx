import './App.css'
import Pages from "@/pages/index.jsx"
import { Toaster } from "@/components/ui/toaster"
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ErrorBoundary } from "@/components/common/ErrorBoundary"
import MockAuthProvider from "@/components/auth/MockAuthProvider"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
})

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <MockAuthProvider>
          <Pages />
          <Toaster />
        </MockAuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

export default App 