const { Router } = require('express');
const prisma = require('../lib/prisma');

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
      include: { stages: { orderBy: { orderIndex: 'asc' } } },
    });
    res.json(projects);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, query } = req.body;
    if (!name || !query) {
      return res.status(400).json({ error: 'name and query are required' });
    }
    const project = await prisma.project.create({
      data: { name, query },
    });
    await prisma.runningBrief.create({
      data: { projectId: project.id, content: '', roundCount: 0 },
    });
    res.status(201).json(project);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        stages: {
          orderBy: { orderIndex: 'asc' },
          include: {
            stageCouncil: {
              include: { agent: { select: { id: true, name: true, seat: true } } },
            },
          },
        },
        runningBrief: true,
      },
    });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  } catch (err) { next(err); }
});

router.patch('/:id/start', async (req, res, next) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: { stages: { orderBy: { orderIndex: 'asc' }, take: 1 } },
    });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.stages.length === 0) {
      return res.status(400).json({ error: 'Project has no stages' });
    }
    const firstStage = project.stages[0];
    const updated = await prisma.project.update({
      where: { id: req.params.id },
      data: { status: 'RUNNING', currentStageId: firstStage.id },
    });
    await prisma.stage.update({
      where: { id: firstStage.id },
      data: { status: 'ACTIVE' },
    });
    res.json(updated);
  } catch (err) { next(err); }
});

router.post('/:id/stages', async (req, res, next) => {
  try {
    const { name, orderIndex, roundsTotal } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const stage = await prisma.stage.create({
      data: {
        projectId: req.params.id,
        name,
        orderIndex: orderIndex || 1,
        roundsTotal: roundsTotal || 3,
      },
    });
    res.status(201).json(stage);
  } catch (err) { next(err); }
});

router.put('/:id/stages/:sid', async (req, res, next) => {
  try {
    const { name, roundsTotal } = req.body;
    if (!name && roundsTotal === undefined) {
      return res.status(400).json({ error: 'At least one field to update is required' });
    }
    const stage = await prisma.stage.update({
      where: { id: req.params.sid },
      data: { ...(name !== undefined && { name }), ...(roundsTotal !== undefined && { roundsTotal }) },
    });
    res.json(stage);
  } catch (err) { next(err); }
});

router.delete('/:id/stages/:sid', async (req, res, next) => {
  try {
    await prisma.stageCouncil.deleteMany({ where: { stageId: req.params.sid } });
    await prisma.stage.delete({ where: { id: req.params.sid } });
    res.status(204).end();
  } catch (err) { next(err); }
});

router.post('/:id/stages/:sid/council', async (req, res, next) => {
  try {
    const { agentId, seatType } = req.body;
    if (!agentId || !seatType) {
      return res.status(400).json({ error: 'agentId and seatType are required' });
    }
    const record = await prisma.stageCouncil.create({
      data: { stageId: req.params.sid, agentId, seatType },
    });
    res.status(201).json(record);
  } catch (err) { next(err); }
});

router.delete('/:id/stages/:sid/council/:agentId', async (req, res, next) => {
  try {
    await prisma.stageCouncil.deleteMany({
      where: { stageId: req.params.sid, agentId: req.params.agentId },
    });
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;
