import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { MiniGameProps, RIDSType } from '../../types';

interface Scenario {
  description: string;
  options: {
    text: string;
    isCorrect: boolean;
  }[];
  principle: string;
}

// Scenario pools based on NZ law and Police policy as of 2025/2026
// Sources: Land Transport Act 1998, Land Transport (Road User) Rule 2004, NZ Police Policy

const RESTRAINTS_SCENARIOS: Scenario[] = [
  {
    description: "You stop a vehicle. The driver is wearing their seatbelt, but a 14-year-old passenger in the back is not. The driver claims they didn't notice.",
    options: [
      { text: "Fine the passenger directly.", isCorrect: false },
      { text: "Issue an infringement to the driver - they're legally responsible for passengers under 15.", isCorrect: true },
      { text: "Let them go with a verbal reminder since the driver was compliant.", isCorrect: false },
    ],
    principle: "Drivers are legally responsible for ensuring all passengers under 15 are restrained."
  },
  {
    description: "A mother is driving with a 5-year-old in the front seat using only the adult seatbelt. She says the child restraint is broken.",
    options: [
      { text: "Allow them to continue since at least the child is belted.", isCorrect: false },
      { text: "Explain children under 7 must use an approved child restraint - offer to follow them to get it sorted.", isCorrect: true },
      { text: "Issue an immediate infringement and prohibit further travel.", isCorrect: false },
    ],
    principle: "Children under 7 must be in an approved child restraint. Education and compliance first."
  },
  {
    description: "You observe an adult passenger (clearly over 15) in the back seat without a seatbelt. When stopped, the driver says 'That's their choice.'",
    options: [
      { text: "Fine the driver for the passenger's non-compliance.", isCorrect: false },
      { text: "Issue an infringement to the passenger - adults 15+ are responsible for their own restraint.", isCorrect: true },
      { text: "Give both a warning since it's a minor issue.", isCorrect: false },
    ],
    principle: "Passengers 15 and over are legally responsible for their own seatbelt compliance."
  },
  {
    description: "A tradesperson's ute has a 7-year-old in the back seat with no child restraint available, just an adult belt which the child is wearing.",
    options: [
      { text: "This is acceptable - children 7+ can use adult belts if no child restraint is available.", isCorrect: true },
      { text: "Issue an infringement - all children need child restraints.", isCorrect: false },
      { text: "Prohibit the vehicle from continuing.", isCorrect: false },
    ],
    principle: "Children 7+ must use a child restraint if available, otherwise must be restrained as securely as possible."
  },
  {
    description: "You stop a vehicle where a 16-year-old front seat passenger is wearing their seatbelt under their arm instead of across their shoulder.",
    options: [
      { text: "This is fine - at least they're wearing something.", isCorrect: false },
      { text: "Educate them on proper wearing - an incorrectly worn belt can cause serious injury in a crash.", isCorrect: true },
      { text: "Issue an infringement to the driver.", isCorrect: false },
    ],
    principle: "Seatbelts must be worn correctly to provide protection. Education opportunity."
  },
];

const DISTRACTIONS_SCENARIOS: Scenario[] = [
  {
    description: "You observe a driver using their phone while stopped at a red light. They put it down as you approach.",
    options: [
      { text: "Let them go since they weren't moving when you saw them.", isCorrect: false },
      { text: "Explain the law applies even when stationary in traffic - issue a warning or infringement based on manner.", isCorrect: true },
      { text: "Issue maximum penalty - this is always dangerous.", isCorrect: false },
    ],
    principle: "Mobile phone laws apply when stopped in traffic, not just when moving."
  },
  {
    description: "A driver is using their phone in a cradle mounted to the windshield, tapping it repeatedly to navigate.",
    options: [
      { text: "This is legal - the phone is mounted.", isCorrect: false },
      { text: "Explain that even mounted phones should only be touched 'infrequently and briefly'.", isCorrect: true },
      { text: "Issue an infringement for any phone touching.", isCorrect: false },
    ],
    principle: "Mounted phones may only be touched infrequently and briefly while driving."
  },
  {
    description: "You stop a driver who was seen holding their phone. They claim they were making an emergency 111 call and couldn't safely stop.",
    options: [
      { text: "This is a valid legal exception - verify and let them continue.", isCorrect: true },
      { text: "There are no exceptions - issue the infringement.", isCorrect: false },
      { text: "They should have pulled over regardless.", isCorrect: false },
    ],
    principle: "111 calls are permitted when it's not safe or practical to stop - this is a legal exception."
  },
  {
    description: "A driver is eating a burger and coffee while driving erratically. No phone involved.",
    options: [
      { text: "No law against eating - let them go.", isCorrect: false },
      { text: "While not specifically illegal, if driving is affected, consider careless driving. Educate on distraction risks.", isCorrect: true },
      { text: "Issue a mobile phone infringement.", isCorrect: false },
    ],
    principle: "Distracted driving from any source can constitute careless driving if it affects vehicle control."
  },
  {
    description: "You observe a driver looking down repeatedly at something in their lap. When stopped, they show you a mounted GPS that fell.",
    options: [
      { text: "Understandable - no action needed.", isCorrect: false },
      { text: "Explain the risks of trying to fix devices while driving. Advise pulling over safely next time.", isCorrect: true },
      { text: "Issue an infringement for distracted driving.", isCorrect: false },
    ],
    principle: "Every stop is an education opportunity - help drivers understand safer choices."
  },
];

const SCENARIO_POOLS: Record<Extract<RIDSType, 'Restraints' | 'Distractions'>, Scenario[]> = {
  Restraints: RESTRAINTS_SCENARIOS,
  Distractions: DISTRACTIONS_SCENARIOS,
};

const SituationalJudgement: React.FC<MiniGameProps> = ({ onComplete, ridsType }) => {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [result, setResult] = useState<'correct' | 'incorrect' | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);

  const scenario = useMemo(() => {
      if (ridsType === 'Restraints' || ridsType === 'Distractions') {
          const pool = SCENARIO_POOLS[ridsType];
          return pool[Math.floor(Math.random() * pool.length)];
      }
      // Fallback
      return SCENARIO_POOLS['Distractions'][0];
  }, [ridsType]);

  const handleSelect = useCallback((option: { text: string; isCorrect: boolean }) => {
    if (result) return;

    setSelectedOption(option.text);
    if (option.isCorrect) {
      setResult('correct');
      setTimeout(() => onComplete(true), 1500);
    } else {
      setResult('incorrect');
      setTimeout(() => onComplete(false), 1500);
    }
  }, [result, onComplete]);
  
  useEffect(() => {
    if (result) return;

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setFocusedIndex(prev => (prev > 0 ? prev - 1 : scenario.options.length - 1));
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setFocusedIndex(prev => (prev < scenario.options.length - 1 ? prev + 1 : 0));
        } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleSelect(scenario.options[focusedIndex]);
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedIndex, scenario.options, handleSelect, result]);


  return (
    <div>
      <div className="bg-black/50 p-4 rounded-lg mb-6 text-center border-2 border-cyan-500/50 min-h-[100px]">
        <p className="text-lg text-gray-300 font-sans">{scenario.description}</p>
      </div>

      <div className="space-y-3">
        {scenario.options.map((option, index) => {
          const isSelected = selectedOption === option.text;
          const isFocused = !result && index === focusedIndex;
          let buttonClass = 'bg-cyan-700 hover:bg-cyan-600 border-cyan-500';
          if (isSelected) {
            buttonClass = result === 'correct' ? 'bg-green-600 border-green-400' : 'bg-red-600 border-red-400';
          }
          if (isFocused) {
            buttonClass += ' ring-4 ring-yellow-400 shadow-[0_0_20px_theme("colors.yellow.400")]';
          }

          return (
            <button
              key={option.text}
              onClick={() => handleSelect(option)}
              onMouseEnter={() => !result && setFocusedIndex(index)}
              disabled={!!result}
              className={`w-full text-white font-bold py-3 px-4 rounded-lg text-lg transition border-2 ${buttonClass} text-left font-sans focus:outline-none`}
            >
              {option.text}
            </button>
          );
        })}
      </div>
      <p className="mt-4 text-sm text-gray-400 font-sans">{scenario.principle}</p>
      <p className="text-sm text-gray-400 mt-2 font-sans">Use <span className="font-bold text-white">↑</span> / <span className="font-bold text-white">↓</span> to select, <span className="font-bold text-white">ENTER</span> / <span className="font-bold text-white">SPACE</span> to confirm.</p>
    </div>
  );
};

export default SituationalJudgement;
