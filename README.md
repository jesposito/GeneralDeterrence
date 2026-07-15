# 🚔 General Deterrence

An arcade-style patrol game about road policing in Aotearoa. It teaches the principles of **general deterrence** through engaging gameplay — educational, but first and foremost a game. Not affiliated with NZ Police.

---

### ⚡ Quick Start (TL;DR)
If you're already a pro and just want to get moving:
1. **Docker**: `docker run -d -p 3000:3000 -v general-deterrence-data:/data ghcr.io/jesposito/generaldeterrence:latest`
2. **Local Dev**: `npm install && npm run dev` (frontend; `/api` proxies to the server on port 3001)
3. **URL**: [http://localhost:3000](http://localhost:3000)

---

## 🧐 What is General Deterrence?

General deterrence is a policing strategy based on the premise that **visible, unpredictable police presence** reduces illegal driving behaviors across the entire population—not just for individuals who are directly stopped. The game reinforces that:

- **Being seen matters** as much as enforcement actions.
- **Patrol coverage** across multiple districts creates area-wide safety benefits.
- **Every roadside stop** is an opportunity to educate, not just enforce.

---

## 🎮 How to Play (Gameplay Overview)

### The Goal (Core Loop)
1. **Patrol** your district in a police vehicle for a 90-second shift.
2. **Maintain Deterrence** by staying visible across all five map districts.
3. **Identify RIDS Offenders** - drivers exhibiting Restraints, Impairment, Distractions, or Speed violations.
4. **Intervene** - Choose **Standard Enforcement** (quick, low reward) or **Investigate** (mini-game, high reward).
5. **Save Lives** - Prioritize pulsing red "Life at Risk" vehicles before their timer expires!

### ⌨️ Controls

| Key | Action |
|:---:|:---|
| `W A S D` / Arrow Keys | **Drive** the patrol car |
| `SHIFT` | **Boost** (uses energy) |
| `SPACE` | **RIDS Check** (press when near a suspect vehicle) |
| `E` | **Toggle Siren** (boosts deterrence, clears traffic, but drains energy) |
| `C` | **Colleague Assist** (dispatches backup to high-priority events) |
| `M` | **Toggle Minimap** mode |
| `ESC` | **Pause** the shift |

Touch controls and standard gamepads are supported throughout the shift and menus. Controls
can be rebound from the title or pause screen.

### 🛠️ Game Systems

*   **Deterrence Meters**: Each district has a level (0-100%). Your presence boosts it; your absence causes it to drop. Keep all districts above 85% to get the **Vigilance Bonus** (2x points!).
*   **Vigilance**: Your personal alertness. Grows with successful interventions and steady patrol speed. Decays if you sit still. High vigilance = larger detection area.
*   **Patrol Posts**: Stop in a low-deterrence area for 5 seconds to set up a post that stays visible after you leave.
*   **Neglect of Duty**: Don't just sit in "safe" areas! You'll be penalized for idling where you aren't needed.

### 🎯 Mini-Games
*   **Breath Screening Test**: Rapidly tap the key to perform a breathalyzer test.
*   **Speed Enforcement**: A precision slider - try to hit the "target zone" perfectly.
*   **Driver Intervention**: Choose the best educational or enforcement response based on NZ law.

### Community Scores

Daily runs can be submitted to an informal, player-reported community board. Scores are
unverified, so it is not an anti-cheat competitive ladder. The server does not collect email:
public names, optional station codes, scores, and run summaries use a 90-day retention window.
Use **Delete my community scores** on the board to remove the identity stored by that browser.

---

## 🚀 Getting Started (Step-by-Step)

Not a "tech person"? No problem! Follow the guide below to get the game running on your own computer.

### ❓ Which Method Should I Choose?

| If you want... | Use this method | Difficulty |
|:---|:---|:---:|
| To run it on your PC with minimal effort | **Option 1: Docker Desktop** | ⭐ (Easy) |
| To **change the code** or contribute | **Option 2: Development Mode** | ⭐⭐ (Advanced) |

---

### 🐋 Option 1: Docker Desktop (Recommended for most users)

**What is Docker?** Think of Docker like a "shipping container." Inside the container is everything the game needs to run (the engine, the database, the graphics). You don't have to install individual pieces; you just run the container.

#### 1. Download & Install Docker
*   Go to [Docker Desktop](https://www.docker.com/products/docker-desktop/) and click the download button for your computer (Windows or Mac).
*   Install it just like any other program. Once installed, **start Docker Desktop**.

#### 2. Open your "Terminal"
This is the part that looks like a movie hacker screen, but don't be scared! It's just a place to type commands.
*   **Windows**: Click Start, type `cmd`, and press Enter.
*   **Mac**: Press `Command + Space`, type `Terminal`, and press Enter.

#### 3. Run the Game
Copy and paste this exact line into your terminal and press **Enter**:
```bash
docker run -d -p 3000:3000 --name police-game \
  -v general-deterrence-data:/data \
  ghcr.io/jesposito/generaldeterrence:latest
```
*(This tells your computer: "Go get the game, name it 'police-game', and run it in the background.")*

#### 4. Start Playing! ✅
Open your web browser and go to:
### [http://localhost:3000](http://localhost:3000)

---

### 💻 Option 2: Development Mode (For Technical Users)

If you want to modify the game or run it from the source files, follow these steps.

#### 1. Prerequisites
You will need **Node.js 24 LTS** installed.
*   Download it from [nodejs.org](https://nodejs.org/).

#### 2. Download the Code
*   Download this project as a ZIP file and extract it, or use Git:
    ```bash
    git clone https://github.com/jesposito/GeneralDeterrence.git
    cd GeneralDeterrence
    ```

#### 3. Install & Run
Open your terminal inside the project folder and run:
```bash
# Install everything needed
npm install

# Start the frontend with hot reload (API requests proxy to localhost:3001)
npm run dev
```
In a second terminal, start the API:
```bash
cd server
npm install
npm start
```

To run the built production stack from source instead:
```bash
npm run build
cd server
npm install
npm start
```

---

### 🏗️ Unraid Setup (For Home Labbers)

If you use an **Unraid** server, you can host the game permanently for your network.

1.  **Open Unraid** and go to the **Docker** tab.
2.  Click **Add Container** at the bottom.
3.  **Name**: `GeneralDeterrence`
4.  **Repository**: `ghcr.io/jesposito/generaldeterrence:latest`
5.  **Network Type**: `Bridge`
6.  **Fixed Ports**: Add a port mapping. 
    *   Container Port: `3000`
    *   Host Port: `3000` (or whatever you prefer)
7.  **Storage (Critical for Leaderboard)**: Add a Path mapping.
    *   Container Path: `/data`
    *   Host Path: `/mnt/user/appdata/generaldeterrence/data`
    *   Ensure the host directory is writable by UID/GID `1000:1000` before starting.
8.  Click **Apply**.

---

## 🛠️ Troubleshooting

### "The website won't load!" (localhost:3000 doesn't work)
*   **Is Docker running?** Check the little whale icon in your taskbar/menu bar. It must be green or say "Running".
*   **Port Conflict**: Something else might be using port 3000. Try changing the number in the command to `8080:3000` and visit `http://localhost:8080` instead.

### "My score didn't save!"
*   The leaderboard needs the **Backend Server** to be running. If you are using Docker, this happens automatically. If you are in "Development Mode," make sure you ran the steps in the `server` folder.

### "The game is laggy"
*   This game uses modern web features. Use a current Chrome, Edge, Firefox, or Safari release and enable hardware acceleration.

---

## Operations

SQLite data lives under `DATA_DIR` (`/data` in the container). Create a consistent backup with:

```bash
cd server
DATA_DIR=/path/to/data npm run backup -- /path/to/backups/leaderboard-$(date +%F).db
```

Compose now uses a named volume. If upgrading from the older `./data:/data` bind mount,
back up `./data/leaderboard.db`, then copy it once before starting the new service:

```bash
docker compose down
docker compose run --rm -v ./data:/legacy-data:ro general-deterrence \
  sh -c 'test ! -e /data/leaderboard.db && cp -R /legacy-data/. /data/'
docker compose up -d
```

The container entrypoint repairs ownership on `/data` and then runs the server as the
unprivileged `node` user. The one-time copy refuses to overwrite an existing named-volume
database.

Direct Docker deployments should leave `TRUST_PROXY` unset. Behind one trusted reverse-proxy
hop, set `TRUST_PROXY=1`; an explicit proxy address or CIDR list is also accepted. Stable
release tags publish `latest`, while prereleases publish only their versioned image tags.

For a public community board, set a random 32+ character `LEADERBOARD_ADMIN_TOKEN` and remove
an abusive entry with `DELETE /api/leaderboard/<id>` plus
`Authorization: Bearer <token>`. Player names reject control and bidirectional-formatting
characters; browsers can also delete all scores associated with their own private edit token.
Expired rows are pruned hourly and before community-board reads.

---

## ⚖️ Legal Accuracy

The scenarios draw on current New Zealand law, but simplify operational processes for play and are not police guidance:

- **Land Transport Act 1998**
- **Land Transport (Road User) Rule 2004**
- **NZ Police public road-safety guidance**

**Key Legal Facts in the Game:**
- Drivers are responsible for passengers **under 15** wearing seatbelts.
- Passengers **15+** are legally responsible for their own seatbelt compliance.
- Mobile phone laws apply even when you are **stationary in traffic**.
- **111 or \*555 calls** are permitted while driving only when stopping and parking is unsafe or impracticable.
- Children **under 7** must use an approved child restraint.

---

## 📂 Project Structure

For those curious about how the files are organized:

```text
GeneralDeterrence/
├── App.tsx              # Main application window
├── components/          # The building blocks of the game
│   ├── Game.tsx         # The "Brain" of the game loop
│   ├── HUD.tsx          # The on-screen display (speed, etc.)
│   └── mini-games/      # Breath tests, radar, etc.
├── server/              # The Backend (handles the Leaderboard)
├── data/                # Where your high scores are saved
└── Dockerfile           # The "Recipe" for the Docker container
```

---

## 🤝 Contributing & License

**Suggestions welcome!** If you have ideas for gameplay balance, legal updates, or technical fixes, feel free to open a Pull Request.

**License**: MIT
