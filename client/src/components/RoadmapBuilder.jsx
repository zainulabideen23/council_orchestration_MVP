import { useState, useEffect, useCallback, useRef } from 'react'
import * as api from '../api'
import StageCard from './StageCard'
import AgentSelectorModal from './AgentSelectorModal'
import SpotlightPanel from './SpotlightPanel'
import Toast from './Toast'
import useSocket from '../hooks/useSocket'

const STATUS_COLORS = {
  DRAFT: 'bg-gray-100 text-gray-600 border-gray-300',
  RUNNING: 'bg-blue-100 text-blue-700 border-blue-300',
  PAUSED: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  COMPLETE: 'bg-green-100 text-green-700 border-green-300',
}

export default function RoadmapBuilder() {
  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState(null)
  const [agents, setAgents] = useState([])
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [error, setError] = useState(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showStageForm, setShowStageForm] = useState(false)
  const [newStageName, setNewStageName] = useState('')
  const [newStageRounds, setNewStageRounds] = useState(3)
  const [showAgentSelector, setShowAgentSelector] = useState(null)
  const [toast, setToast] = useState(null)

  const [roundState, setRoundState] = useState({ loading: false, result: null, error: null })
  const [agentStatus, setAgentStatus] = useState({})
  const [runningPhase, setRunningPhase] = useState(null)
  const [showSpotlight, setShowSpotlight] = useState(false)
  const [runningAll, setRunningAll] = useState(false)
  const runningAllRef = useRef(false)
  const [transitionBanner, setTransitionBanner] = useState(null)
  const [debugEvents, setDebugEvents] = useState([])
  const [showDebug, setShowDebug] = useState(false)
  const debugRef = useRef([])

  const showToast = useCallback((msg, type = 'success') => setToast({ message: msg, type }), [])

  const fetchProjects = useCallback(async () => {
    setLoadingProjects(true)
    try {
      const data = await api.getProjects()
      setProjects(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingProjects(false)
    }
  }, [])

  const fetchAgents = useCallback(async () => {
    try {
      const data = await api.getAgents()
      setAgents(data)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchProjects(); fetchAgents() }, [fetchProjects, fetchAgents])

  const { emit } = useSocket(selectedProject?.id, {
    onAgentThinking: (data) => {
      setAgentStatus((prev) => ({ ...prev, [data.agentId]: 'thinking' }))
    },
    onAgentComplete: (data) => {
      setAgentStatus((prev) => ({ ...prev, [data.agentId]: data.error ? 'error' : 'complete' }))
    },
    onSummarizerRunning: () => setRunningPhase('summarizer'),
    onSummarizerComplete: () => setRunningPhase('brief_done'),
    onLeaderRunning: () => setRunningPhase('leader'),
    onLeaderComplete: () => {
      setRunningPhase(null)
      setAgentStatus({})
    },
    onStageTransition: (data) => {
      setTransitionBanner(data)
      setTimeout(() => setTransitionBanner(null), 5000)
      selectProject(selectedProject?.id)
    },
    onProjectComplete: () => { selectProject(selectedProject?.id) },
    onRoundFailed: () => { setRunningPhase(null); setAgentStatus({}) },
    onRawEvent: (event, data) => {
      const entry = { event, data, ts: new Date().toLocaleTimeString() }
      debugRef.current = [...debugRef.current.slice(-49), entry]
      setDebugEvents(debugRef.current)
    },
  })

  const selectProject = async (id) => {
    setLoadingDetail(true)
    setError(null)
    setRoundState({ loading: false, result: null, error: null })
    try {
      const project = await api.getProject(id)
      setSelectedProject(project)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleCreateProject = async (e) => {
    e.preventDefault()
    const form = e.target
    const name = form.name.value.trim()
    const query = form.query.value.trim()
    if (!name || !query) return
    try {
      const p = await api.createProject({ name, query })
      await fetchProjects()
      selectProject(p.id)
      setShowCreateForm(false)
      showToast('Project created')
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const handleStartProject = async () => {
    try {
      await api.startProject(selectedProject.id)
      await selectProject(selectedProject.id)
      showToast('Project started')
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const activeStage = (selectedProject?.stages || []).find((s) => s.status === 'ACTIVE')
  const roundsExhausted = activeStage ? activeStage.roundsDone >= activeStage.roundsTotal : false

  const handleRunRound = async () => {
    setRoundState({ loading: true, result: null, error: null })
    setAgentStatus({})
    setRunningPhase(null)
    try {
      const result = await api.startRound(selectedProject.id)
      setRoundState({ loading: false, result, error: null })
      await selectProject(selectedProject.id)
      showToast(`Round ${result.roundNumber} ${result.status}`)
      if (runningAllRef.current && result.status === 'COMPLETE' && !result.stageComplete) {
        setTimeout(() => handleRunRound(), 1500)
      } else if (runningAllRef.current) {
        setRunningAll(false)
        runningAllRef.current = false
      }
    } catch (err) {
      setRoundState({ loading: false, result: null, error: err.message })
      showToast(err.message, 'error')
      setRunningAll(false)
      runningAllRef.current = false
    }
  }

  const handleRunAll = () => {
    if (roundsExhausted) return
    setRunningAll(true)
    runningAllRef.current = true
    handleRunRound()
  }

  const handleAddStage = async () => {
    if (!newStageName.trim()) return
    try {
      await api.createStage(selectedProject.id, {
        name: newStageName.trim(),
        orderIndex: (selectedProject.stages || []).length + 1,
        roundsTotal: newStageRounds,
      })
      await selectProject(selectedProject.id)
      setNewStageName('')
      setNewStageRounds(3)
      setShowStageForm(false)
      showToast('Stage added')
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const handleUpdateStage = async (sid, data) => {
    try {
      await api.updateStage(selectedProject.id, sid, data)
      await selectProject(selectedProject.id)
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const handleDeleteStage = async (sid) => {
    if (!window.confirm('Remove this stage?')) return
    try {
      await api.deleteStage(selectedProject.id, sid)
      await selectProject(selectedProject.id)
      showToast('Stage removed')
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const handleAssignAgent = async (agentId, seatType) => {
    if (!showAgentSelector) return
    try {
      await api.assignCouncil(selectedProject.id, showAgentSelector, {
        agentId,
        seatType,
      })
      await selectProject(selectedProject.id)
      showToast('Agent assigned')
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const handleUnassign = async (stageId, agentId) => {
    try {
      await api.unassignCouncil(selectedProject.id, stageId, agentId)
      await selectProject(selectedProject.id)
      showToast('Agent unassigned')
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const assignedIdsForStage = (stageId) => {
    const stage = (selectedProject?.stages || []).find((s) => s.id === stageId)
    return new Set((stage?.stageCouncil || []).map((sc) => sc.agentId))
  }

  const handleCreateAgentFromRoadmap = async () => {
    const name = window.prompt('Agent name:')
    if (!name) return
    const persona = window.prompt('Persona prompt:')
    if (!persona) return
    try {
      await api.createAgent({ name, personaPrompt: persona, model: 'llama-3.1-8b-instant', seat: 'BUNKHOUSE' })
      await fetchAgents()
      showToast('Agent created')
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  if (loadingProjects) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error && projects.length === 0) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <p className="font-medium">Failed to load projects</p>
        <p className="text-sm mt-1">{error}</p>
        <button onClick={fetchProjects} className="mt-2 text-sm underline">Retry</button>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Roadmap Builder</h1>
        {!selectedProject && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            + New Project
          </button>
        )}
        {selectedProject && (
          <button
            onClick={() => setSelectedProject(null)}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-300"
          >
            &larr; All Projects
          </button>
        )}
      </div>

      {!selectedProject && projects.length === 0 && (
        <div className="text-center py-16 bg-white rounded-lg border border-dashed border-gray-300">
          <p className="text-gray-500 mb-4">No projects yet. Start by defining a roadmap.</p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            + New Project
          </button>
        </div>
      )}

      {!selectedProject && projects.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => selectProject(p.id)}
              className="bg-white border border-gray-200 rounded-lg p-4 text-left shadow-sm hover:shadow-md hover:border-blue-300 transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-gray-900">{p.name}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[p.status] || ''}`}>
                  {p.status}
                </span>
              </div>
              <p className="text-sm text-gray-600 line-clamp-2">{p.query}</p>
              <p className="text-xs text-gray-400 mt-2">
                {(p.stages || []).length} stage{(p.stages || []).length !== 1 ? 's' : ''}
              </p>
            </button>
          ))}
        </div>
      )}

      {selectedProject && loadingDetail && (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      )}

      {selectedProject && !loadingDetail && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selectedProject.name}</h2>
                <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[selectedProject.status] || ''}`}>
                  {selectedProject.status}
                </span>
              </div>
              <div className="flex gap-2">
                {selectedProject.status === 'DRAFT' && (selectedProject.stages || []).length > 0 && (
                  <button
                    onClick={handleStartProject}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                  >
                    Start Project
                  </button>
                )}
                {(selectedProject.status === 'RUNNING' || selectedProject.status === 'PAUSED') && (
                  <>
                    <button
                      onClick={handleRunRound}
                      disabled={roundState.loading || roundsExhausted}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                      title={roundsExhausted ? 'All rounds completed for this stage' : ''}
                    >
                      {roundState.loading ? 'Running...' : roundsExhausted ? 'Stage Complete' : 'Run Round'}
                    </button>
                    <button
                      onClick={handleRunAll}
                      disabled={roundState.loading || roundsExhausted}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
                      title={roundsExhausted ? 'All rounds completed for this stage' : ''}
                    >
                      {runningAll ? 'Running All...' : roundsExhausted ? 'Stage Complete' : 'Run All'}
                    </button>
                  </>
                )}
                <button
                  onClick={() => setShowSpotlight(!showSpotlight)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    showSpotlight
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'text-purple-700 border-purple-300 hover:bg-purple-50'
                  }`}
                >
                  Spotlight
                </button>
                <button
                  onClick={() => setShowDebug(!showDebug)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    showDebug
                      ? 'bg-gray-700 text-white border-gray-700'
                      : 'text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Debug
                </button>
              </div>
            </div>
            <p className="text-sm text-gray-600 bg-gray-50 rounded p-3 border border-gray-100">
              {selectedProject.query}
            </p>
          </div>

          {(Object.keys(agentStatus).length > 0 || runningPhase) && (
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
                <h3 className="font-semibold text-gray-900 text-sm">Live Round Status</h3>
              </div>
              <div className="p-4 space-y-2">
                {Array.from(
                  new Map(
                    (selectedProject.stages || []).flatMap((s) => s.stageCouncil || [])
                      .filter((sc) => agentStatus[sc.agentId])
                      .map((sc) => [sc.agentId, sc])
                  ).values()
                ).map((sc) => {
                    const agent = agents.find((a) => a.id === sc.agentId)
                    const status = agentStatus[sc.agentId]
                    return (
                      <div key={sc.agentId} className="flex items-center gap-3 text-sm">
                        <span className={`w-2 h-2 rounded-full ${
                          status === 'thinking' ? 'bg-blue-500 animate-pulse' :
                          status === 'complete' ? 'bg-green-500' : 'bg-red-500'
                        }`} />
                        <span className="text-gray-800">{agent?.name || sc.agentId}</span>
                        <span className="text-xs text-gray-400">
                          {status === 'thinking' ? 'Thinking...' :
                           status === 'complete' ? 'Done' : 'Failed'}
                        </span>
                      </div>
                    )
                  })}
                {runningPhase === 'summarizer' && (
                  <div className="flex items-center gap-3 text-sm text-purple-700">
                    <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                    <span>Summarizer updating brief...</span>
                  </div>
                )}
                {runningPhase === 'leader' && (
                  <div className="flex items-center gap-3 text-sm text-amber-700">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    <span>Leader synthesizing results...</span>
                  </div>
                )}
                {roundState.loading && !runningPhase && Object.keys(agentStatus).length === 0 && (
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <span className="w-2 h-2 rounded-full bg-gray-400 animate-pulse" />
                    <span>Starting round...</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {transitionBanner && (
            <div className="bg-amber-50 border-2 border-amber-400 rounded-lg shadow-lg overflow-hidden animate-pulse">
              <div className="bg-amber-500 px-4 py-2">
                <p className="text-white font-bold text-sm">STAGE TRANSITION</p>
              </div>
              <div className="p-4 space-y-2">
                <p className="text-sm text-amber-900 font-medium">
                  {transitionBanner.fromStageName} → {transitionBanner.toStageName}
                </p>
                <div className="flex gap-4 text-xs text-amber-800 flex-wrap">
                  {transitionBanner.promotedOnDeck?.length > 0 && (
                    <span className="bg-amber-100 px-2 py-1 rounded font-medium">
                      ON_DECK promoted: {transitionBanner.promotedOnDeck.join(', ')}
                    </span>
                  )}
                  {transitionBanner.promotedBunkhouse?.length > 0 && (
                    <span className="bg-green-100 px-2 py-1 rounded font-medium text-green-800">
                      BUNKHOUSE activated: {transitionBanner.promotedBunkhouse.join(', ')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-amber-600">Council roster has been updated. Next round will use the new lineup.</p>
              </div>
            </div>
          )}

          {showDebug && (
            <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-lg overflow-hidden">
              <div className="bg-gray-800 px-4 py-2 flex items-center justify-between">
                <p className="text-gray-200 font-bold text-xs uppercase tracking-wider">Socket Event Log</p>
                <button onClick={() => { debugRef.current = []; setDebugEvents([]) }} className="text-xs text-gray-400 hover:text-white">
                  Clear
                </button>
              </div>
              <div className="p-2 max-h-64 overflow-y-auto font-mono text-xs space-y-0.5">
                {debugEvents.length === 0 && (
                  <p className="text-gray-500 italic p-2">No events yet. Run a round to see socket traffic.</p>
                )}
                {debugEvents.map((e, i) => (
                  <div key={i} className="flex gap-2 text-gray-300 hover:bg-gray-800 px-2 py-0.5 rounded">
                    <span className="text-gray-500 shrink-0 w-16">{e.ts}</span>
                    <span className="text-cyan-400 shrink-0 w-36 font-semibold">{e.event}</span>
                    <span className="text-gray-400 truncate">{JSON.stringify(e.data)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {roundState.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
              <p className="font-medium">Round failed</p>
              <p className="text-sm mt-1">{roundState.error}</p>
            </div>
          )}

          {roundState.result && roundState.result.agentResponses && (
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
                <h3 className="font-semibold text-gray-900 text-sm">
                  Round {roundState.result.roundNumber} — {roundState.result.status}
                </h3>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid gap-2">
                  {roundState.result.agentResponses.map((r, i) => (
                    <div key={i} className={`rounded-lg p-3 border ${r.error ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900">{r.agentName}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.error ? 'bg-red-200 text-red-800' : 'bg-green-200 text-green-800'}`}>
                          {r.error ? 'FAILED' : 'OK'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-3">{r.response}</p>
                      {r.latencyMs > 0 && (
                        <p className="text-xs text-gray-400 mt-1">{r.latencyMs}ms | {r.tokensUsed || '?'} tokens</p>
                      )}
                    </div>
                  ))}
                </div>

                {roundState.result.updatedBrief && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-xs font-medium text-blue-700 mb-1">Updated Brief</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-3">{roundState.result.updatedBrief}</p>
                  </div>
                )}

                {roundState.result.leaderSynthesis && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <p className="text-xs font-medium text-purple-700 mb-1">Leader Synthesis</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-4">{roundState.result.leaderSynthesis}</p>
                  </div>
                )}

                {roundState.result.stageComplete && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                    Stage complete!{roundState.result.nextStageName ? ` Moving to: ${roundState.result.nextStageName}` : ''}
                  </div>
                )}

                {roundState.result.projectComplete && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800 font-medium">
                    Project complete!
                  </div>
                )}
              </div>
            </div>
          )}

          {showSpotlight && selectedProject && (
            <SpotlightPanel
              agents={agents}
              projectId={selectedProject.id}
              runningBrief={selectedProject.runningBrief?.content || ''}
            />
          )}

          {selectedProject.status === 'COMPLETE' && (
            <div className="bg-green-50 border border-green-200 rounded-lg shadow-sm">
              <div className="px-5 py-4 border-b border-green-200 bg-green-100/50 rounded-t-lg">
                <h3 className="text-lg font-bold text-green-900">Final Project Report</h3>
                <p className="text-sm text-green-700 mt-1">
                  The council has concluded all stages and generated the final comprehensive brief below.
                </p>
              </div>
              <div className="p-5">
                {selectedProject.runningBrief?.content ? (
                  <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                    {selectedProject.runningBrief.content}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">No final report was generated.</p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">Stages</h3>
              <div className="flex gap-2">
                <button
                  onClick={handleCreateAgentFromRoadmap}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
                >
                  + Quick Agent
                </button>
                {!showStageForm && (
                  <button
                    onClick={() => setShowStageForm(true)}
                    className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200 transition-colors"
                  >
                    + Add Stage
                  </button>
                )}
              </div>
            </div>

            {showStageForm && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-end gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Stage Name</label>
                  <input
                    type="text"
                    value={newStageName}
                    onChange={(e) => setNewStageName(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="e.g. Problem Framing"
                    autoFocus
                  />
                </div>
                <div className="w-24">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Rounds</label>
                  <input
                    type="number"
                    min={1}
                    value={newStageRounds}
                    onChange={(e) => setNewStageRounds(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={handleAddStage}
                  disabled={!newStageName.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50"
                >
                  Add
                </button>
                <button
                  onClick={() => { setShowStageForm(false); setNewStageName('') }}
                  className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            )}

            {(!selectedProject.stages || selectedProject.stages.length === 0) && (
              <div className="text-center py-8 bg-white rounded-lg border border-dashed border-gray-300">
                <p className="text-sm text-gray-500">No stages yet. Add your first stage.</p>
              </div>
            )}

            {(selectedProject.stages || []).map((stage, i) => (
              <div key={stage.id} className="relative">
                <StageCard
                  stage={stage}
                  index={i}
                  agents={agents}
                  allAgents={agents}
                  onUpdate={(data) => handleUpdateStage(stage.id, data)}
                  onDelete={() => handleDeleteStage(stage.id)}
                  onUnassign={(agentId) => handleUnassign(stage.id, agentId)}
                />
                <div className="mt-2 flex justify-end">
                  <button
                    onClick={() => setShowAgentSelector(stage.id)}
                    className="text-xs px-3 py-1 text-blue-600 hover:bg-blue-50 rounded border border-blue-200 transition-colors"
                  >
                    + Assign Agents
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showCreateForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowCreateForm(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">New Project</h2>
            </div>
            <form onSubmit={handleCreateProject} className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
                <input
                  name="name"
                  type="text"
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. SE Asia Expansion"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Query</label>
                <textarea
                  name="query"
                  required
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="The main question driving all rounds..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAgentSelector && (
        <AgentSelectorModal
          availableAgents={agents}
          assignedIds={assignedIdsForStage(showAgentSelector)}
          onAssign={handleAssignAgent}
          onClose={() => setShowAgentSelector(null)}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
