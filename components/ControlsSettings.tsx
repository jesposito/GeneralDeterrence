import React, { useEffect, useRef, useState } from 'react';
import {
    ACTION_LABELS, displayKey, loadBindings, normalizeBindingKey,
    resetBindings, saveBindings, type Bindings, type GameAction,
} from '../utils/keybindings';
import { useGamepadNavigation } from './useGamepadNavigation';
import { loadChallengeAssist, saveChallengeAssist } from '../utils/preferences';

const ACTIONS = Object.keys(ACTION_LABELS) as GameAction[];

export const rebind = (bindings: Bindings, action: GameAction, key: string): { bindings: Bindings; blockedOwner?: GameAction } => {
    const blockedOwner = ACTIONS.find(owner => owner !== action && bindings[owner].includes(key) && bindings[owner].length === 1);
    if (blockedOwner) return { bindings, blockedOwner };
    const next = {} as Bindings;
    for (const owner of ACTIONS) next[owner] = owner === action ? [key] : bindings[owner].filter(existing => existing !== key);
    return { bindings: next };
};

const ControlsSettings: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [bindings, setBindings] = useState<Bindings>(() => loadBindings());
    const [capturing, setCapturing] = useState<GameAction | null>(null);
    const [announce, setAnnounce] = useState('');
    const [challengeAssist, setChallengeAssist] = useState(loadChallengeAssist);
    const panelRef = useRef<HTMLDivElement>(null);

    useGamepadNavigation(panelRef, { active: capturing === null, onBack: onClose });

    // Dialog focus in/trap/restore (same pattern as MiniGameModal).
    useEffect(() => {
        const prev = document.activeElement as HTMLElement | null;
        panelRef.current?.focus();
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Tab') return;
            const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
                'input:not(:disabled), button:not(:disabled)',
            );
            if (!focusables || focusables.length === 0) { e.preventDefault(); return; }
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        };
        document.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('keydown', onKey); prev?.focus?.(); };
    }, []);

    // Escape closes the panel — unless a capture is in flight (that Escape cancels the capture).
    useEffect(() => {
        if (capturing) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [capturing, onClose]);

    // Capture mode: the next keydown becomes the binding. Capture phase so nothing else reacts.
    useEffect(() => {
        if (!capturing) return;
        const onKey = (e: KeyboardEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.key === 'Escape') {
                setCapturing(null);
                setAnnounce('Rebinding cancelled.');
                return;
            }
            if (e.key === 'Tab') return; // Tab stays reserved for focus navigation
            const k = normalizeBindingKey(e.key);
            const result = rebind(bindings, capturing, k);
            const { blockedOwner } = result;
            if (blockedOwner) {
                setAnnounce(`${displayKey(k)} is the only key for ${ACTION_LABELS[blockedOwner]}. Choose another key or reset the controls.`);
                setCapturing(null);
                return;
            }
            saveBindings(result.bindings);
            setBindings(result.bindings);
            setAnnounce(`${ACTION_LABELS[capturing]} is now ${displayKey(k)}.`);
            setCapturing(null);
        };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, [bindings, capturing]);

    return (
        <div className="absolute inset-0 bg-black/90 flex items-start justify-center z-40 animate-fadeIn p-2 sm:p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="controls-title">
            <div ref={panelRef} tabIndex={-1} className="bg-gray-900 p-4 sm:p-6 rounded-lg shadow-2xl w-full max-w-md text-left border-4 border-cyan-500 shadow-cyan-500/50 focus:outline-none my-auto">
                <h2 id="controls-title" className="text-2xl font-bold text-cyan-400 mb-1 font-display text-glow-cyan text-center">Controls</h2>
                <p className="text-xs text-gray-400 mb-3 font-sans text-center">Changes apply from your next shift. Every action keeps at least one unique key.</p>
                <label className="mb-3 flex items-center gap-3 rounded border border-gray-700 bg-black/30 p-2 text-left">
                    <input
                        type="checkbox"
                        checked={challengeAssist}
                        onChange={(event) => {
                            const enabled = event.target.checked;
                            setChallengeAssist(enabled);
                            saveChallengeAssist(enabled);
                            setAnnounce(`Decision challenge assist ${enabled ? 'enabled' : 'disabled'} for the next shift.`);
                        }}
                        className="h-5 w-5 accent-cyan-500"
                    />
                    <span className="text-sm text-gray-200 font-sans">Untimed decision challenges</span>
                </label>
                <div role="status" aria-live="polite" className="sr-only">{announce}</div>
                <ul className="space-y-1">
                    {ACTIONS.map(action => (
                        <li key={action} className="flex items-center justify-between gap-2 py-1 border-b border-gray-800">
                            <span className="text-sm text-gray-300 font-sans">{ACTION_LABELS[action]}</span>
                            <span className="flex items-center gap-2">
                                <kbd className="bg-gray-200 text-black font-bold px-2 py-0.5 rounded text-sm min-w-[3rem] text-center">
                                    {bindings[action].length ? bindings[action].map(displayKey).join(' / ') : 'none'}
                                </kbd>
                                <button
                                    onClick={() => { setCapturing(action); setAnnounce(`Press a key for ${ACTION_LABELS[action]}. Escape cancels.`); }}
                                    aria-label={`Change key for ${ACTION_LABELS[action]}, currently ${bindings[action].length ? bindings[action].map(displayKey).join(' or ') : 'unbound'}`}
                                    className="text-xs bg-cyan-800 hover:bg-cyan-700 px-2 py-1 rounded border border-cyan-600 font-sans text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                                >
                                    {capturing === action ? 'Press a key…' : 'Change'}
                                </button>
                            </span>
                        </li>
                    ))}
                </ul>
                <div className="flex justify-between mt-4 gap-2">
                    <button
                        onClick={() => { setBindings(resetBindings()); setAnnounce('Controls reset to defaults.'); }}
                        className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded border border-gray-500 font-sans text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    >
                        Reset to defaults
                    </button>
                    <button
                        onClick={onClose}
                        className="text-sm bg-pink-600 hover:bg-pink-500 px-4 py-2 rounded border border-pink-400 font-bold font-display tracking-wider text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ControlsSettings;
