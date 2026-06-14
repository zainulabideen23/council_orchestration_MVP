import { useState } from 'react'

export default function AgentSelectorModal({ availableAgents, assignedIds, onAssign, onClose }) {
  const [selected, setSelected] = useState({})
  const [seatType, setSeatType] = useState('COUNCIL')

  const unassigned = availableAgents.filter((a) => !assignedIds.has(a.id))

  const toggleAgent = (id) => {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handleConfirm = async () => {
    const ids = Object.entries(selected)
      .filter(([, v]) => v)
      .map(([k]) => k)

    if (ids.length === 0) {
      onClose()
      return
    }

    for (const agentId of ids) {
      await onAssign(agentId, seatType)
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Assign Agents</h2>
        </div>
        <div className="px-6 py-4 max-h-80 overflow-y-auto space-y-2">
          {unassigned.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">No unassigned agents available.</p>
          )}
          {unassigned.map((agent) => (
            <label
              key={agent.id}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                selected[agent.id]
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <input
                type="checkbox"
                checked={!!selected[agent.id]}
                onChange={() => toggleAgent(agent.id)}
                className="rounded"
              />
              <div>
                <span className="text-sm font-medium text-gray-900">{agent.name}</span>
                <span className="text-xs text-gray-400 ml-2">{agent.seat}</span>
              </div>
            </label>
          ))}
        </div>
        <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setSeatType('COUNCIL')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                seatType === 'COUNCIL'
                  ? 'bg-green-100 text-green-800 border border-green-300'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Council
            </button>
            <button
              onClick={() => setSeatType('ON_DECK')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                seatType === 'ON_DECK'
                  ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              On-Deck
            </button>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className={`px-4 py-2 text-sm rounded-lg text-white ${
                seatType === 'COUNCIL'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-yellow-600 hover:bg-yellow-700'
              }`}
            >
              Assign as {seatType === 'COUNCIL' ? 'Council' : 'On-Deck'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
