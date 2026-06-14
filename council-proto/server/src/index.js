require('dotenv/config');

const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const agentsRouter = require('./routes/agents');
const projectsRouter = require('./routes/projects');
const roundsRouter = require('./routes/rounds');
const setupSocket = require('./socket');
const { emitToProject } = require('./socket');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

app.use('/api/agents', agentsRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/projects', roundsRouter);

app.post('/api/orchestrator/events', (req, res) => {
  const { event, data } = req.body || {};
  if (event && data?.projectId) {
    emitToProject(io, data.projectId, event, data);
  }
  res.json({ ok: true });
});

setupSocket(io);

app.use((err, req, res, next) => {
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Not found' });
  }
  if (err.code === 'P2002') {
    return res.status(409).json({ error: 'Duplicate entry' });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.API_PORT || 3001;
server.listen(PORT, () => {
  console.log(`API running on :${PORT}`);
});
