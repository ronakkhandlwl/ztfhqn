import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AccuracyPage } from './features/accuracy/AccuracyPage'
import { DecisionPage } from './features/decision/DecisionPage'
import { ExplorerPage } from './features/explorer/ExplorerPage'
import { MethodologyPage } from './features/method/MethodologyPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DecisionPage />} />
        <Route path="accuracy" element={<AccuracyPage />} />
        <Route path="explorer" element={<ExplorerPage />} />
        <Route path="methodology" element={<MethodologyPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
