# 🚔 General Deterrence

An arcade-style patrol simulation game designed as an informal training tool for New Zealand Police frontline officers. The game teaches the principles of **general deterrence** in road policing through engaging gameplay.

---

### ⚡ Quick Start (TL;DR)
If you're already a pro and just want to get moving:
1. **Docker**: `docker run -d -p 3000:3000 -v ./data:/data ghcr.io/jesposito/generaldeterrence:latest`
2. **Local Dev**: `npm install && npm run dev` (frontend) or `cd server && npm install && node index.js` (full stack)
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
2. **Maintain Deterrence** by being visible across all districts (Karori North, West, Central, East).
3. **Identify RIDS Offenders** - drivers exhibiting Restraints, Impairment, Distractions, or Speed violations.
4. **Intervene** - Choose to **Warn** (quick, low reward) or **Enforce** (mini-game, high reward).
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

### 🛠️ Game Systems

*   **Deterrence Meters**: Each district has a level (0-100%). Your presence boosts it; your absence causes it to drop. Keep all districts above 85% to get the **Vigilance Bonus** (2x points!).
*   **Vigilance**: Your personal alertness. Grows with successful interventions and steady patrol speed. Decays if you sit still. High vigilance = larger detection area.
*   **Patrol Posts**: Stop in a low-deterrence area for 10 seconds to set up a post that stays visible after you leave.
*   **Neglect of Duty**: Don't just sit in "safe" areas! You'll be penalized for idling where you aren't needed.

### 🎯 Mini-Games
*   **Breath Screening Test**: Rapidly tap the key to perform a breathalyzer test.
*   **Speed Enforcement**: A precision slider - try to hit the "target zone" perfectly.
*   **Driver Intervention**: Choose the best educational or enforcement response based on NZ law.

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
docker run -d -p 3000:3000 --name police-game ghcr.io/jesposito/generaldeterrence:latest
```
*(This tells your computer: "Go get the game, name it 'police-game', and run it in the background.")*

#### 4. Start Playing! ✅
Open your web browser and go to:
### [http://localhost:3000](http://localhost:3000)

---

### 💻 Option 2: Development Mode (For Technical Users)

If you want to modify the game or run it from the source files, follow these steps.

#### 1. Prerequisites
You will need **Node.js** (Version 20 or higher) installed.
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

# Start the game for testing
npm run dev
```
> **Note:** `npm run dev` only starts the game screen. If you want the **Leaderboard** to work, you also need to start the backend:
```bash
cd server
npm install
node index.js
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
8.  Click **Apply**.

---

## 🛠️ Troubleshooting

### "The website won't load!" (localhost:3000 doesn't work)
*   **Is Docker running?** Check the little whale icon in your taskbar/menu bar. It must be green or say "Running".
*   **Port Conflict**: Something else might be using port 3000. Try changing the number in the command to `8080:3000` and visit `http://localhost:8080` instead.

### "My score didn't save!"
*   The leaderboard needs the **Backend Server** to be running. If you are using Docker, this happens automatically. If you are in "Development Mode," make sure you ran the steps in the `server` folder.

### "The game is laggy"
*   This game uses modern web features. Try using **Google Chrome** or **Microsoft Edge** for the best experience. Make sure "Hardware Acceleration" is turned on in your browser settings.

---

## ⚖️ Legal Accuracy

The situational judgement scenarios are based on current **New Zealand Law** and Police policy (2025/2026):

- **Land Transport Act 1998**
- **Land Transport (Road User) Rule 2004**
- **NZ Police operational policies**

**Key Legal Facts in the Game:**
- Drivers are responsible for passengers **under 15** wearing seatbelts.
- Passengers **15+** are legally responsible for their own seatbelt compliance.
- Mobile phone laws apply even when you are **stationary in traffic**.
- **111 calls** are a legal exception to phone use rules.
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

**License**: Internal Use - New Zealand Police Road Policing Training.
