const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

const PORT = 3000;


const themes = [
  "Quand je me sens heureux, je vais dans un lieu…",
  "Quand je suis triste, je pense à…",
  "Quand j’ai peur, je cherche…",
  "Quand je suis en colère, je fais…",
  "Quand je me sens calme, j’aime…",
  "Quand je suis excité, je veux…",
  "Quand je me sens seul, je rêve de…",
  "Quand je suis surpris, je ressens…",
  "Quand je suis fatigué, je me réfugie dans…",
  "Quand je suis motivé, je vais vers…",
    "Quand je me sens incompris, j’ai besoin de…",
    "Quand je suis plein d’énergie, je cours vers…",
    "Quand je suis stressé, j’imagine…",
    "Quand je me sens libre, je…",
    "Quand je suis jaloux, j’aimerais…",
    "Quand je ressens de la culpabilité, je pense à…",
    "Quand je suis ému, je réagis en…",
    "Quand je me sens invisible, je voudrais…",
    "Quand je suis nostalgique, je retourne à…",
    "Quand je ressens de la gratitude, je pense à…",
    "Quand je suis fier, j’ai envie de…",
    "Quand je me sens créatif, je crée…",
    "Quand je suis découragé, je me rappelle…",
    "Quand je me sens soutenu, je peux…",
    "Quand je suis perdu, je cherche…",
    "Quand je suis anxieux, j’aimerais…",
    "Quand je me sens important, je…",
    "Quand je suis déçu, je me tourne vers…",
    "Quand je ressens de la tendresse, je pense à…",
    "Quand je me sens entendu, je…"
];

let rooms = {}; 

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

function assignUniqueNumber(usedNumbers) {
  const available = [];
  for (let i = 1; i <= 10; i++) {
    if (!usedNumbers.has(i)) available.push(i);
  }
  if (available.length === 0) return null;
  const index = Math.floor(Math.random() * available.length);
  return available[index];
}


function getRandomTheme(currentTheme) {
  let newTheme;
  do {
    newTheme = themes[Math.floor(Math.random() * themes.length)];
  } while (newThem);
  return newTheme;
}

// Connexion d'un joueur
io.on('connection', (socket) => {
  console.log(`🔌 Nouvelle connexion : ${socket.id}`);

  // Création de salle
  socket.on('createRoom', (nickname, callback) => {
    const roomCode = generateRoomCode();
    const number = Math.floor(Math.random() * 10) + 1;
    const theme = themes[Math.floor(Math.random() * themes.length)];

    rooms[roomCode] = {
      players: {},
      usedNumbers: new Set(),
      theme,
      status: "waiting"
    };

    rooms[roomCode].players[socket.id] = {
      nickname,
      number,
      answer: null,
    };
    rooms[roomCode].usedNumbers.add(number);
    socket.join(roomCode);

    callback({ roomCode, number, theme });
    console.log(`🏠 Salle créée : ${roomCode} par ${nickname} avec thème : ${theme}`);
  });

  // Rejoindre une salle
  socket.on('joinRoom', ({ roomCode, nickname }, callback) => {
    const room = rooms[roomCode];
    if (!room) return callback({ error: "Salle introuvable" });

    const number = assignUniqueNumber(room.usedNumbers);
    if (!number) return callback({ error: "Salle pleine" });

    room.players[socket.id] = { nickname, number, answer: null };
    room.usedNumbers.add(number);
    socket.join(roomCode);

    callback({ roomCode, number, theme: room.theme });
    io.to(roomCode).emit('updatePlayers', Object.values(room.players).map(p => p.nickname));
    console.log(`👤 ${nickname} a rejoint la salle ${roomCode}`);
  });

socket.on('changeTheme', (roomCode) => {
  const room = rooms[roomCode];
  if (!room) return;

  console.log(`🔄 [SERVER] Changement de thème demandé dans la salle ${roomCode}`);

  const newTheme = getRandomTheme(room.theme);
  room.theme = newTheme;

  // Réinitialiser les numéros utilisés
  room.usedNumbers = new Set();

  const playerIds = Object.keys(room.players);

  playerIds.forEach(id => {
    const number = assignUniqueNumber(room.usedNumbers);
    room.players[id].number = number;
    room.usedNumbers.add(number);
    console.log(`🎲 [SERVER] Nouveau chiffre pour ${room.players[id].nickname} : ${number}`);
  });

  // Envoyer le nouveau thème
  io.to(roomCode).emit('roundStarted', { theme: newTheme });

  // Envoyer les nouveaux numéros aux clients
  playerIds.forEach(id => {
    io.to(id).emit('updateNumber', room.players[id].number);
  });
});




  socket.on('startRound', ({ roomCode, theme }) => {
    const room = rooms[roomCode];
    if (!room) return;
    room.theme = theme;
    room.status = "playing";
    for (const id in room.players) {
      room.players[id].answer = null;
    }
    io.to(roomCode).emit('roundStarted', { theme });
  });

  // Réponse d'un joueur
  socket.on('submitAnswer', ({ roomCode, answer }) => {
    const room = rooms[roomCode];
    if (!room || !room.players[socket.id]) return;

    room.players[socket.id].answer = answer;

    const allAnswered = Object.values(room.players).every(p => p.answer !== null);
    if (allAnswered) {
      const answers = Object.entries(room.players).map(([id, p]) => ({
        nickname: p.nickname,
        answer: p.answer,
        socketId: id
      }));
      io.to(roomCode).emit('allAnswers', answers);
    }
  });

  socket.on('disconnect', () => {
    for (const roomCode in rooms) {
      const room = rooms[roomCode];
      if (room.players[socket.id]) {
        console.log(`❌ ${room.players[socket.id].nickname} a quitté la salle ${roomCode}`);
        room.usedNumbers.delete(room.players[socket.id].number);
        delete room.players[socket.id];
        io.to(roomCode).emit('updatePlayers', Object.values(room.players).map(p => p.nickname));

        // Supprimer la salle si vide
        if (Object.keys(room.players).length === 0) {
          delete rooms[roomCode];
          console.log(`🧹 Salle ${roomCode} supprimée`);
        }
      }
    }
  });
});

const os = require('os');

function getLocalIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // ignore ipv6 and internal (loopback) addresses
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

server.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIp();
  console.log(`🎮 Serveur démarré sur :`);
  console.log(`  - Localhost: http://localhost:${PORT}`);
  console.log(`  - Réseau local: http://${localIp}:${PORT}`);
});

