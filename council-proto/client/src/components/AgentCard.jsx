import { useState } from 'react'

export default function AgentCard({ agent, seatColors, onEdit, onDelete, onSeatChange }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow transition-shadow">
      <div className="p-4">
        <div className="flex items-start justify-between">
          <h3 className="font-semibold text-gray-900">{agent.name}</h3>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${seatColors[agent.seat] || seatColors.BUNKHOUSE}`}>
            {agent.seat}
          </span>
        </div>

        <p className="text-sm text-gray-600 mt-2 line-clamp-2">
          {expanded ? agent.personaPrompt : agent.personaPrompt}
        </p>
        {agent.personaPrompt.length > 120 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-blue-600 hover:underline mt-1"
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}

        <div className="text-xs text-gray-400 mt-2 font-mono">{agent.model}</div>
      </div>

      <div className="border-t border-gray-100 px-4 py-2 flex items-center justify-between bg-gray-50 rounded-b-lg">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Seat:</label>
          <select
            value={agent.seat}
            onChange={(e) => onSeatChange(e.target.value)}
            className="text-xs border border-gray-300 rounded px-1.5 py-0.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="COUNCIL">Council</option>
            <option value="ON_DECK">On-Deck</option>
            <option value="BUNKHOUSE">Bunkhouse</option>
            <option value="RETIRED">Retired</option>
          </select>
        </div>
        <div className="flex gap-1">
          <button onClick={onEdit} className="text-xs px-2 py-1 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
            Edit
          </button>
          <button onClick={onDelete} className="text-xs px-2 py-1 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
