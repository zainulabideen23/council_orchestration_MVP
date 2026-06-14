module.exports = function setupSocket(io) {
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on('join:project', ({ projectId }) => {
      if (projectId) {
        socket.join(projectId);
        console.log(`${socket.id} joined project ${projectId}`);
      }
    });

    socket.on('round:start', ({ projectId }) => {
      if (projectId) {
        socket.to(projectId).emit('round:started', { projectId });
      }
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
};

function emitToProject(io, projectId, event, data) {
  io.to(projectId).emit(event, data);
}

module.exports.emitToProject = emitToProject;
