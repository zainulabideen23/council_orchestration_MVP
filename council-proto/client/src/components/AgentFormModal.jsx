import { useState, useEffect } from 'react'

export default function AgentFormModal({ agent, onSave, onClose }) {
  const [name, setName] = useState('')
  const [personaPrompt, setPersonaPrompt] = useState('')
  const [model, setModel] = useState('llama-3.1-8b-instant')
  const [seat, setSeat] = useState('BUNKHOUSE')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (agent) {
      setName(agent.name)
      setPersonaPrompt(agent.personaPrompt)
      setModel(agent.model)
      setSeat(agent.seat)
    }
  }, [agent])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim() || !personaPrompt.trim()) return
    setSaving(true)
    try {
      await onSave({ name: name.trim(), personaPrompt: personaPrompt.trim(), model: model.trim(), seat })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {agent ? 'Edit Agent' : 'New Agent'}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g. Strategic Advisor"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Persona Prompt</label>
            <textarea
              value={personaPrompt}
              onChange={(e) => setPersonaPrompt(e.target.value)}
              required
              rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Describe the agent's role, personality, and constraints..."
            />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="w-40">
              <label className="block text-sm font-medium text-gray-700 mb-1">Seat</label>
              <select
                value={seat}
                onChange={(e) => setSeat(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="COUNCIL">Council</option>
                <option value="ON_DECK">On-Deck</option>
                <option value="BUNKHOUSE">Bunkhouse</option>
                <option value="RETIRED">Retired</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim() || !personaPrompt.trim()}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving...' : agent ? 'Save Changes' : 'Create Agent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
