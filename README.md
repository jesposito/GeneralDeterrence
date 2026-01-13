# General Deterrence

An arcade-style patrol simulation game designed as an informal training tool for New Zealand Police frontline officers. The game teaches the principles of **general deterrence** in road policing through engaging gameplay.

## What is General Deterrence?

General deterrence is a policing strategy based on the premise that **visible, unpredictable police presence** reduces illegal driving behaviors across the entire population—not just for individuals who are directly stopped. The game reinforces that:

- Being seen matters as much as enforcement actions
- Patrol coverage across multiple districts creates area-wide safety benefits
- Every roadside stop is an opportunity to educate, not just enforce

## Gameplay Overview

### Core Loop
1. **Patrol** your district in a police vehicle for a 90-second shift
2. **Maintain Deterrence** by being visible across all districts (Karori North, West, Central, East)
3. **Identify RIDS Offenders** - drivers exhibiting Restraints, Impairment, Distractions, or Speed violations
4. **Intervene** - Choose to Warn (quick, low reward) or Enforce (mini-game, high reward)
5. **Save Lives** - Prioritize pulsing red "Life at Risk" vehicles before their timer expires

### Controls

| Key | Action |
|-----|--------|
| `W A S D` / Arrow Keys | Drive |
| `SHIFT` | Boost (uses energy) |
| `SPACE` | RIDS Check (when near suspect vehicle) |
| `E` | Toggle Siren (drains energy, boosts deterrence, clears traffic) |
| `C` | Colleague Assist (dispatches backup to high-priority event) |
| `M` | Toggle Minimap mode |

### Game Systems

**Deterrence Meters**: Each district has a deterrence level (0-100%). Your presence boosts deterrence; absence causes decay. Keep all districts above 85% to activate the **Vigilance Bonus** (2x points).

**Vigilance**: Your personal alertness meter. Grows through successful interventions and steady patrol speed. Decays when stationary or boosting excessively. Higher vigilance = larger detection aura.

**Patrol Posts**: Stop in a low-deterrence area for 10 seconds to establish a patrol post that maintains presence even after you leave.

**Neglect of Duty**: Idling too long in high-deterrence areas triggers penalties—you should be where you're needed most.

**RIDS Types**:
- 📱 **Distractions** - Erratic speed, phone use
- 🥴 **Impairment** - Swerving behavior (requires breath test mini-game)
- 🔥 **Speed** - Fast vehicles (requires radar mini-game)
- ⚠️ **Restraints** - Seatbelt violations

### Mini-Games

- **Breath Screening Test** (Impairment): Quick-time event - tap/press rapidly
- **Speed Enforcement** (Speed): Precision slider - hit the target zone
- **Driver Intervention** (Restraints/Distractions): Situational judgement - choose the best response based on NZ law

## Scoring

| Category | Points |
|----------|--------|
| Warning issued | 100 |
| Impairment enforcement | 500 |
| Speed enforcement | 400 |
| Restraints/Distractions enforcement | 300 |
| Rural area bonus | +100 |
| Dispatched call bonus | 5,000 |
| Life saved | +5,000 |
| Life lost | -3,000 |
| Final deterrence (per district) | ±50 per % above/below 50% |

## Deployment

### Docker (Recommended for Unraid)

The game includes a Docker setup for easy deployment with persistent leaderboards.

```bash
# Build and run with Docker Compose
docker-compose up -d

# Or build manually
docker build -t general-deterrence .
docker run -d -p 3000:3000 -v ./data:/data general-deterrence
```

The game will be available at `http://localhost:3000`

### Unraid Setup

1. Copy the project to your Unraid server
2. In the Unraid terminal:
   ```bash
   cd /path/to/GeneralDeterrence
   docker-compose up -d
   ```
3. Or use Unraid's Docker UI:
   - Add container from Dockerfile
   - Map port 3000
   - Map `/data` to an appdata folder for persistent leaderboards

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `DATA_FILE` | /data/leaderboard.json | Path to leaderboard data |

### Leaderboard Features

- **Persistent scores**: Stored in JSON file, survives container restarts
- **Email support**: Optional email allows players to update their score if they beat it later
- **Privacy**: Emails are stored but never displayed publicly
- **Fallback**: Works offline with localStorage if API is unavailable

## Development

```bash
# Install dependencies
npm install

# Start development server (frontend only)
npm run dev

# Build for production
npm run build

# Start production server with API
cd server && npm install && npm start
```

## Tech Stack

- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **Vite** for bundling
- **Express.js** for leaderboard API
- **Docker** for containerization
- Custom 2D rendering with CSS transforms
- A* pathfinding for GPS guidance

## Legal Accuracy

The situational judgement scenarios are based on current New Zealand law and Police policy as of 2025/2026:

- **Land Transport Act 1998**
- **Land Transport (Road User) Rule 2004**
- **NZ Police operational policies**

Key legal points reflected in scenarios:
- Drivers are responsible for passengers under 15 wearing restraints
- Passengers 15+ are responsible for their own seatbelt compliance
- Mobile phone laws apply when stationary in traffic
- 111 calls are a legal exception to phone use rules
- Children under 7 must use approved child restraints

## Project Structure

```
GeneralDeterrence/
├── App.tsx              # Main app shell, API integration
├── constants.ts         # All tunable game parameters
├── types.ts             # TypeScript interfaces
├── Dockerfile           # Container build instructions
├── docker-compose.yml   # Container orchestration
├── server/
│   ├── index.js         # Express API server
│   └── package.json     # Server dependencies
├── components/
│   ├── Game.tsx         # Core game loop and physics
│   ├── HUD.tsx          # Heads-up display
│   ├── GameOver.tsx     # Score breakdown with heatmap
│   └── mini-games/      # Enforcement mini-games
└── utils/
    ├── geometry.ts      # Pathfinding, distance calculations
    └── mapData.ts       # Road network graph
```

## Contributing

Suggestions for gameplay balance, educational accuracy, or technical improvements are welcome via pull request.

## License

Internal use - New Zealand Police Road Policing Training
