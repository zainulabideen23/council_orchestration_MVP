const BASE = import.meta.env.VITE_API_URL || '/api'

async function request(url, options = {}) {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(body || `HTTP ${res.status}`)
  }
  if (res.status === 204) return null
  return res.json()
}

export function getAgents() {
  return request('/agents')
}

export function createAgent(data) {
  return request('/agents', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateAgent(id, data) {
  return request(`/agents/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function deleteAgent(id) {
  return request(`/agents/${id}`, { method: 'DELETE' })
}

export function updateAgentSeat(id, seat) {
  return request(`/agents/${id}/seat`, {
    method: 'PATCH',
    body: JSON.stringify({ seat }),
  })
}

export function getProjects() {
  return request('/projects')
}

export function getProject(id) {
  return request(`/projects/${id}`)
}

export function createProject(data) {
  return request('/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function startProject(id) {
  return request(`/projects/${id}/start`, { method: 'PATCH' })
}

export function createStage(projectId, data) {
  return request(`/projects/${projectId}/stages`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateStage(projectId, sid, data) {
  return request(`/projects/${projectId}/stages/${sid}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function deleteStage(projectId, sid) {
  return request(`/projects/${projectId}/stages/${sid}`, {
    method: 'DELETE',
  })
}

export function assignCouncil(projectId, sid, data) {
  return request(`/projects/${projectId}/stages/${sid}/council`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function startRound(projectId) {
  return request(`/projects/${projectId}/rounds/start`, { method: 'POST' })
}

export function getRound(projectId, rid) {
  return request(`/projects/${projectId}/rounds/${rid}`)
}

export function unassignCouncil(projectId, stageId, agentId) {
  return request(`/projects/${projectId}/stages/${stageId}/council/${agentId}`, {
    method: 'DELETE',
  })
}

export function triggerSpotlight(projectId, agentId, query) {
  return request(`/projects/${projectId}/spotlight`, {
    method: 'POST',
    body: JSON.stringify({ agentId, query }),
  })
}
