export default function StageCard({
  stage,
  index,
  agents,
  allAgents,
  onUpdate,
  onDelete,
  onUnassign,
}) {
  const councilAgents = (stage.stageCouncil || [])
    .filter((sc) => sc.seatType === 'COUNCIL')
    .map((sc) => agents.find((a) => a.id === sc.agentId))
    .filter(Boolean)

  const onDeckAgents = (stage.stageCouncil || [])
    .filter((sc) => sc.seatType === 'ON_DECK')
    .map((sc) => agents.find((a) => a.id === sc.agentId))
    .filter(Boolean)

  const statusColor = {
    PENDING: 'bg-gray-100 text-gray-600',
    ACTIVE: 'bg-blue-100 text-blue-700',
    COMPLETE: 'bg-green-100 text-green-700',
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
              {index + 1}
            </span>
            <h3 className="font-semibold text-gray-900">{stage.name}</h3>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[stage.status] || 'bg-gray-100 text-gray-600'}`}>
              {stage.status}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <label className="text-xs text-gray-500">Rounds:</label>
              <input
                type="number"
                min={1}
                value={stage.roundsTotal}
                onChange={(e) =>
                  onUpdate({ roundsTotal: Math.max(1, parseInt(e.target.value) || 1) })
                }
                className="w-14 border border-gray-300 rounded px-1.5 py-0.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={onDelete}
              className="text-xs px-2 py-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            >
              Remove
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Council</p>
            {councilAgents.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No agents assigned</p>
            ) : (
              <div className="space-y-1.5">
                {councilAgents.map((a) => (
                  <div key={a.id} className="flex items-center justify-between bg-green-50 rounded px-2 py-1">
                    <span className="text-sm text-gray-800">{a.name}</span>
                    <button
                      onClick={() => onUnassign(a.id)}
                      className="text-xs text-gray-400 hover:text-red-500"
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">On-Deck</p>
            {onDeckAgents.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No agents assigned</p>
            ) : (
              <div className="space-y-1.5">
                {onDeckAgents.map((a) => (
                  <div key={a.id} className="flex items-center justify-between bg-yellow-50 rounded px-2 py-1">
                    <span className="text-sm text-gray-800">{a.name}</span>
                    <button
                      onClick={() => onUnassign(a.id)}
                      className="text-xs text-gray-400 hover:text-red-500"
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <p className="text-xs text-gray-400 mt-3">
          {stage.roundsDone} / {stage.roundsTotal} rounds completed
        </p>
      </div>
    </div>
  )
}
