// === BACKEND: server.js ===
// This file should be placed in a Node.js backend environment only.
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

let waitingPlayer = null;
const rooms = {};

function determineWinner(p1, p2) {
  if (p1 === p2) return 'draw';
  if ((p1 === 'rock' && p2 === 'scissors') || (p1 === 'scissors' && p2 === 'paper') || (p1 === 'paper' && p2 === 'rock')) return 'p1';
  return 'p2';
}

io.on('connection', socket => {
  console.log('User connected:', socket.id);

  if (!waitingPlayer) {
    waitingPlayer = socket;
    socket.emit('status', 'Waiting for an opponent...');
  } else {
    const roomId = `room-${socket.id}-${waitingPlayer.id}`;
    rooms[roomId] = {
      players: [waitingPlayer, socket],
      choices: {},
      scores: { [waitingPlayer.id]: 0, [socket.id]: 0 },
      round: 1
    };
    waitingPlayer.join(roomId);
    socket.join(roomId);
    io.to(roomId).emit('start_game', { roomId });
    waitingPlayer = null;
  }

  socket.on('make_choice', ({ roomId, choice }) => {
    const room = rooms[roomId];
    if (!room) return;
    room.choices[socket.id] = choice;

    if (Object.keys(room.choices).length === 2) {
      const [p1, p2] = room.players;
      const c1 = room.choices[p1.id];
      const c2 = room.choices[p2.id];
      const result = determineWinner(c1, c2);

      if (result === 'p1') room.scores[p1.id]++;
      if (result === 'p2') room.scores[p2.id]++;

      io.to(roomId).emit('round_result', {
        choices: { [p1.id]: c1, [p2.id]: c2 },
        scores: room.scores,
        round: room.round++,
        winner: result
      });

      room.choices = {};

      if (room.round > 3) {
        const finalWinner = room.scores[p1.id] > room.scores[p2.id] ? p1.id : (room.scores[p2.id] > room.scores[p1.id] ? p2.id : 'draw');
        io.to(roomId).emit('game_over', { finalWinner });
        delete rooms[roomId];
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Socket server running on http://localhost:${PORT}`));
