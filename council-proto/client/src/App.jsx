import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import AgentLibrary from './components/AgentLibrary'
import RoadmapBuilder from './components/RoadmapBuilder'

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-6xl mx-auto px-4 py-6">
          <Routes>
            <Route path="/" element={<Navigate to="/agents" replace />} />
            <Route path="/agents" element={<AgentLibrary />} />
            <Route path="/roadmap" element={<RoadmapBuilder />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
