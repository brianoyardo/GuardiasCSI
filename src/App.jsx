import AppRouter from '@/app/Router'
`import { useRealtimeStore } from '@/stores/realtimeStore';

// Exponer el store para el robot de pruebas E2E
if (typeof window !== 'undefined') {
  window.useRealtimeStore = useRealtimeStore;
}`

/**
 * App — root component
 * Renders the role-based router
 */
export default function App() {
  return <AppRouter />
}