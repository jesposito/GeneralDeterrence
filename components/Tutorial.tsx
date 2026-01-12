import React from 'react';

interface TutorialProps {
  onComplete: () => void;
}

const TutorialInfoCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-black/60 p-4 rounded-lg border-2 border-cyan-500/30 flex-1 min-w-[300px]">
        <h3 className="text-xl font-bold font-display text-yellow-400 text-glow-yellow mb-3 tracking-wider">{title}</h3>
        <div className="text-gray-300 space-y-2 font-sans text-base">{children}</div>
    </div>
);

const KeyDisplay: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <span className="bg-gray-200 text-black font-bold px-2 py-1 rounded-md mx-1">{children}</span>
);

const Tutorial: React.FC<TutorialProps> = ({ onComplete }) => {
  return (
    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-30 p-8 animate-fadeIn">
        <div className="w-full max-w-6xl">
            <h1 className="text-5xl font-bold font-display text-cyan-400 text-glow-cyan mb-2 text-center">PRE-SHIFT BRIEFING</h1>
            <p className="text-xl text-pink-400 mb-8 text-center font-display">Your patrol objectives and vehicle controls.</p>

            <div className="flex flex-wrap gap-6 justify-center">
                <TutorialInfoCard title="OBJECTIVE">
                    <p>Your goal is to maintain high <span className="text-white font-bold">DETERRENCE</span> across all districts.</p>
                    <p>Your patrol car has a deterrence aura. Grow this aura by increasing your <span className="text-purple-400 font-bold">VIGILANCE</span> through successful warnings and enforcements.</p>
                    <p>A larger aura helps deter crime over a wider area. Keep all districts above 85% to activate a <span className="text-yellow-300 font-bold">VIGILANCE BONUS</span> for 2x points.</p>
                </TutorialInfoCard>

                <TutorialInfoCard title="CORE PATROL">
                     <p>Identify drivers with icons (e.g., <span className="text-xl">📱, 🔥</span>). These are RIDS offenders.</p>
                     <p>Get close and press <KeyDisplay>SPACE</KeyDisplay> or tap the <span className="text-yellow-300 font-bold">RIDS CHECK</span> button to intervene.</p>
                     <p className="text-red-400 font-bold">Red pulsing vehicles are high-priority <span className="text-white">LIFE AT RISK</span> events. Intervene before the timer runs out!</p>
                </TutorialInfoCard>

                <TutorialInfoCard title="CONTROLS">
                    <ul className="list-inside space-y-1">
                        <li><KeyDisplay>W A S D</KeyDisplay> / <KeyDisplay>Arrows</KeyDisplay> - Drive</li>
                        <li><KeyDisplay>SHIFT</KeyDisplay> - Boost <span className="text-cyan-400">(uses energy)</span></li>
                        <li><KeyDisplay>E</KeyDisplay> - Siren <span className="text-pink-400">(drains energy, boosts deterrence)</span></li>
                        <li><KeyDisplay>C</KeyDisplay> - Colleague Assist <span className="text-yellow-400">(handles a high-priority event)</span></li>
                        <li><KeyDisplay>M</KeyDisplay> - Toggle Minimap</li>
                    </ul>
                </TutorialInfoCard>
            </div>
            
            <div className="text-center mt-10">
                <button
                    onClick={onComplete}
                    className="bg-pink-600 hover:bg-pink-500 border-2 border-pink-400 text-white font-bold py-4 px-12 rounded-lg text-2xl transition-transform transform hover:scale-110 font-display tracking-wider animate-button-pulse-glow"
                >
                    Start Patrol
                </button>
            </div>
        </div>
    </div>
  );
};

export default Tutorial;