const { Router } = require('express');
const prisma = require('../lib/prisma');

const router = Router();

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://localhost:8001';

router.post('/:id/rounds/start', async (req, res, next) => {
  try {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.status !== 'RUNNING') {
      return res.status(400).json({ error: 'Project is not RUNNING' });
    }

    if (!project.currentStageId) {
      return res.status(400).json({ error: 'Project has no active stage' });
    }

    const activeStage = await prisma.stage.findUnique({
      where: { id: project.currentStageId },
    });
    if (!activeStage) return res.status(404).json({ error: 'No active stage' });

    const orchestratorRes = await fetch(`${ORCHESTRATOR_URL}/execute-round`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: project.id }),
    });

    if (!orchestratorRes.ok) {
      const errBody = await orchestratorRes.text();
      return res.status(502).json({ error: `Orchestrator error: ${errBody}` });
    }

    const result = await orchestratorRes.json();
    res.status(201).json(result);
  } catch (err) { next(err); }
});

router.get('/:id/rounds/:rid', async (req, res, next) => {
  try {
    const round = await prisma.round.findUnique({
      where: { id: req.params.rid },
      include: {
        responses: {
          include: { agent: { select: { id: true, name: true, model: true } } },
        },
      },
    });
    if (!round) return res.status(404).json({ error: 'Round not found' });
    res.json(round);
  } catch (err) { next(err); }
});

router.post('/:id/spotlight', async (req, res, next) => {
  try {
    const { agentId, query } = req.body;
    if (!agentId || !query) {
      return res.status(400).json({ error: 'agentId and query are required' });
    }

    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const orchestratorRes = await fetch(`${ORCHESTRATOR_URL}/spotlight`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: project.id, agentId, query }),
    });

    if (!orchestratorRes.ok) {
      const errBody = await orchestratorRes.text();
      return res.status(502).json({ error: `Orchestrator error: ${errBody}` });
    }

    const result = await orchestratorRes.json();
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
