const { Router } = require('express');
const prisma = require('../lib/prisma');

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const agents = await prisma.agent.findMany({ orderBy: { name: 'asc' } });
    res.json(agents);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, personaPrompt, model, seat } = req.body;
    if (!name || !personaPrompt) {
      return res.status(400).json({ error: 'name and personaPrompt are required' });
    }
    const agent = await prisma.agent.create({
      data: { name, personaPrompt, model: model || undefined, seat: seat || undefined },
    });
    res.status(201).json(agent);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { name, personaPrompt, model } = req.body;
    if (!name && !personaPrompt && !model) {
      return res.status(400).json({ error: 'At least one field to update is required' });
    }
    const agent = await prisma.agent.update({
      where: { id: req.params.id },
      data: { ...(name !== undefined && { name }), ...(personaPrompt !== undefined && { personaPrompt }), ...(model !== undefined && { model }) },
    });
    res.json(agent);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.agent.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) { next(err); }
});

router.patch('/:id/seat', async (req, res, next) => {
  try {
    const { seat } = req.body;
    const valid = ['COUNCIL', 'ON_DECK', 'BUNKHOUSE', 'RETIRED'];
    if (!valid.includes(seat)) {
      return res.status(400).json({ error: `Invalid seat. Must be one of: ${valid.join(', ')}` });
    }
    const agent = await prisma.agent.update({
      where: { id: req.params.id },
      data: { seat },
    });
    res.json(agent);
  } catch (err) { next(err); }
});

module.exports = router;
