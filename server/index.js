const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_FILE = process.env.DATA_FILE || '/data/leaderboard.json';

app.use(cors());
app.use(express.json());

// Serve static files from the built frontend
app.use(express.static(path.join(__dirname, '../dist')));

// Ensure data directory exists
const dataDir = path.dirname(DATA_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize leaderboard file if it doesn't exist
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify([]));
}

// Read leaderboard
const readLeaderboard = () => {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading leaderboard:', error);
    return [];
  }
};

// Write leaderboard
const writeLeaderboard = (leaderboard) => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(leaderboard, null, 2));
  } catch (error) {
    console.error('Error writing leaderboard:', error);
  }
};

// GET /api/leaderboard - Fetch all scores
app.get('/api/leaderboard', (req, res) => {
  const leaderboard = readLeaderboard();
  // Return without email addresses for privacy
  const publicLeaderboard = leaderboard.map(({ name, score, timestamp }) => ({ 
    name, 
    score, 
    timestamp 
  }));
  res.json(publicLeaderboard);
});

// POST /api/leaderboard - Submit a new score
app.post('/api/leaderboard', (req, res) => {
  const { name, score, email, timestamp } = req.body;
  
  if (!name || typeof score !== 'number') {
    return res.status(400).json({ error: 'Name and score are required' });
  }

  let leaderboard = readLeaderboard();
  
  // If email is provided, check if this user already has an entry
  if (email) {
    const existingIndex = leaderboard.findIndex(entry => 
      entry.email && entry.email.toLowerCase() === email.toLowerCase()
    );
    
    if (existingIndex !== -1) {
      // Only update if new score is higher
      if (score > leaderboard[existingIndex].score) {
        leaderboard[existingIndex] = {
          name,
          score,
          email,
          timestamp: timestamp || Date.now()
        };
      }
      // If score isn't higher, we still keep the old entry
    } else {
      // New user with email
      leaderboard.push({
        name,
        score,
        email,
        timestamp: timestamp || Date.now()
      });
    }
  } else {
    // No email - just add as new entry
    leaderboard.push({
      name,
      score,
      timestamp: timestamp || Date.now()
    });
  }
  
  // Sort by score descending and keep top 100
  leaderboard = leaderboard
    .sort((a, b) => b.score - a.score)
    .slice(0, 100);
  
  writeLeaderboard(leaderboard);
  
  // Return public leaderboard (top 10 for display)
  const publicLeaderboard = leaderboard
    .slice(0, 10)
    .map(({ name, score, timestamp }) => ({ name, score, timestamp }));
  
  res.json(publicLeaderboard);
});

// Catch-all route to serve the frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`General Deterrence server running on port ${PORT}`);
});
