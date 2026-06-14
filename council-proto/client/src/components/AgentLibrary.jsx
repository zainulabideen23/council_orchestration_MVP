import { useState, useEffect, useCallback } from 'react'
import * as api from '../api'
import AgentCard from './AgentCard'
import AgentFormModal from './AgentFormModal'
import Toast from './Toast'

const SEAT_COLORS = {
  COUNCIL: 'bg-green-100 text-green-800 border-green-300',
  ON_DECK: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  BUNKHOUSE: 'bg-gray-100 text-gray-600 border-gray-300',
  RETIRED: 'bg-red-100 text-red-800 border-red-300',
}

export default function AgentLibrary() {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingAgent, setEditingAgent] = useState(null)
  const [toast, setToast] = useState(null)

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
  }, [])

  const fetchAgents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getAgents()
      setAgents(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAgents() }, [fetchAgents])

  const handleCreate = async (data) => {
    try {
      await api.createAgent(data)
      await fetchAgents()
      setModalOpen(false)
      showToast('Agent created')
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const handleEdit = async (data) => {
    try {
      await api.updateAgent(editingAgent.id, data)
      await fetchAgents()
      setEditingAgent(null)
      showToast('Agent updated')
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const handleDelete = async (agent) => {
    if (!window.confirm(`Delete "${agent.name}"?`)) return
    try {
      await api.deleteAgent(agent.id)
      await fetchAgents()
      showToast('Agent deleted')
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const handleSeatChange = async (agentId, seat) => {
    try {
      await api.updateAgentSeat(agentId, seat)
      await fetchAgents()
      showToast(`Seat changed to ${seat}`)
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Agent Library</h1>
        <button
          onClick={() => setModalOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
        >
          + New Agent
        </button>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="font-medium">Failed to load agents</p>
          <p className="text-sm mt-1">{error}</p>
          <button onClick={fetchAgents} className="mt-2 text-sm underline hover:no-underline">
            Retry
          </button>
        </div>
      )}

      {!loading && !error && agents.length === 0 && (
        <div className="text-center py-16 bg-white rounded-lg border border-dashed border-gray-300">
          <p className="text-gray-500 mb-4">No agents yet. Create your first agent.</p>
          <button
            onClick={() => setModalOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            + New Agent
          </button>
        </div>
      )}

      {!loading && !error && agents.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              seatColors={SEAT_COLORS}
              onEdit={() => setEditingAgent(agent)}
              onDelete={() => handleDelete(agent)}
              onSeatChange={(seat) => handleSeatChange(agent.id, seat)}
            />
          ))}
        </div>
      )}

      {modalOpen && (
        <AgentFormModal
          onSave={handleCreate}
          onClose={() => setModalOpen(false)}
        />
      )}

      {editingAgent && (
        <AgentFormModal
          agent={editingAgent}
          onSave={handleEdit}
          onClose={() => setEditingAgent(null)}
        />
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}
