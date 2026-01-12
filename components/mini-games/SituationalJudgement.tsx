import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { MiniGameProps, RIDSType } from '../../types';

interface Scenario {
  description: string;
  options: {
    text: string;
    isCorrect: boolean;
  }[];
}

const SCENARIOS: Record<Extract<RIDSType, 'Restraints' | 'Distractions'>, Scenario> = {
  Restraints: {
    description: "You stop a vehicle. The driver is wearing their seatbelt, but a 16-year-old passenger in the back is not. The driver claims they didn't notice.",
    options: [
      { text: "Fine the passenger directly.", isCorrect: false },
      { text: "Educate both on the risks and driver's responsibility. Issue a warning.", isCorrect: true },
      { text: "Ignore it, as the driver was compliant.", isCorrect: false },
    ]
  },
  Distractions: {
    description: "You observe a driver using their phone while stopped at a red light. They put it down as you approach.",
    options: [
      { text: "Issue an immediate infringement notice for illegal phone use.", isCorrect: false },
      { text: "Warn the driver about the dangers, explaining the law applies even when stationary.", isCorrect: true },
      { text: "Let them go since they weren't moving when you approached.", isCorrect: false },
    ]
  }
};

const SituationalJudgement: React.FC<MiniGameProps> = ({ onComplete, ridsType }) => {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [result, setResult] = useState<'correct' | 'incorrect' | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);

  const scenario = useMemo(() => {
      if (ridsType === 'Restraints' || ridsType === 'Distractions') {
          return SCENARIOS[ridsType];
      }
      // Fallback, though should not be reached with current logic
      return SCENARIOS['Distractions'];
  }, [ridsType]);

  const handleSelect = useCallback((option: { text: string; isCorrect: boolean }) => {
    if (result) return;

    setSelectedOption(option.text);
    if (option.isCorrect) {
      setResult('correct');
      setTimeout(() => onComplete(true), 1200);
    } else {
      setResult('incorrect');
      setTimeout(() => onComplete(false), 1200);
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
      <p className="mt-4 text-sm text-gray-400 font-sans">Principle: Every roadside stop is an opportunity to educate.</p>
      <p className="text-sm text-gray-400 mt-2 font-sans">Use <span className="font-bold text-white">↑</span> / <span className="font-bold text-white">↓</span> to select, <span className="font-bold text-white">ENTER</span> / <span className="font-bold text-white">SPACE</span> to confirm.</p>
    </div>
  );
};

export default SituationalJudgement;