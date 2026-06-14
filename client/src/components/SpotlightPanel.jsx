import { useState } from 'react'
import * as api from '../api'

const SEAT_ORDER = { COUNCIL: 0, ON_DECK: 1, BUNKHOUSE: 2, RETIRED: 3 }
const STATUS_BG = {
  idle: 'border-gray-200 bg-white',
  thinking: 'border-blue-400 bg-blue-50',
  complete: 'border-green-400 bg-green-50',
  error: 'border-red-400 bg-red-50',
}

export default function SpotlightPanel({ agents, projectId, runningBrief }) {
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const sorted = [...agents].sort((a, b) => SEAT_ORDER[a.seat] - SEAT_ORDER[b.seat]);

  const handleSubmit = async () => {
    if (!selectedAgentId || !query.trim()) return;
    setLoading(true);
    setError(null);
    setResponse(null);
    try {
      const result = await api.triggerSpotlight(projectId, selectedAgentId, query);
      setResponse(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
        <h3 className="font-semibold text-gray-900 text-sm">Spotlight</h3>
        <p className="text-xs text-gray-500 mt-0.5">Directly address any agent — bypasses the Leader</p>
      </div>
      <div className="p-4 space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Agent</label>
          <select
            value={selectedAgentId}
            onChange={(e) => { setSelectedAgentId(e.target.value); setResponse(null); }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Select an agent...</option>
            {sorted.map((a) => (
              <option key={a.id} value={a.id}>{a.name} ({a.seat})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Question</label>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Ask a direct follow-up..."
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={loading || !selectedAgentId || !query.trim()}
          className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium transition-colors"
        >
          {loading ? 'Calling agent...' : 'Send Spotlight'}
        </button>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
        )}

        {response && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-purple-700">Response from {response.agentName}</span>
            </div>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{response.response}</p>
          </div>
        )}
      </div>
    </div>
  )
}
