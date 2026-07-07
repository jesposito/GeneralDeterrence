import React, { useEffect, useMemo, useRef } from 'react';
import { getCodex } from '../utils/codex';

// The Story Codex: every saved-life story collected, one per completed shift-day.
// Same dialog shell/trap pattern as ControlsSettings.

const StoryCodex: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const panelRef = useRef<HTMLDivElement>(null);
    const codex = useMemo(() => getCodex().slice().reverse(), []);

    useEffect(() => {
        const prev = document.activeElement as HTMLElement | null;
        panelRef.current?.focus();
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { onClose(); return; }
            if (e.key !== 'Tab') return;
            const focusables = panelRef.current?.querySelectorAll<HTMLElement>('button');
            if (!focusables || focusables.length === 0) { e.preventDefault(); return; }
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        };
        document.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('keydown', onKey); prev?.focus?.(); };
    }, [onClose]);

    return (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-40 animate-fadeIn p-4" role="dialog" aria-modal="true" aria-labelledby="codex-title">
            <div ref={panelRef} tabIndex={-1} className="bg-gray-900 p-6 rounded-lg shadow-2xl w-full max-w-lg text-left border-4 border-green-500 shadow-green-500/50 focus:outline-none max-h-full overflow-y-auto">
                <h2 id="codex-title" className="text-2xl font-bold text-green-400 mb-1 font-display text-center">Story Codex</h2>
                <p className="text-xs text-gray-400 mb-4 font-sans text-center">One story collected per shift-day. {codex.length} so far.</p>
                {codex.length === 0 ? (
                    <p className="text-gray-300 font-sans text-center py-6">No stories yet. Finish a shift with a life saved to collect your first.</p>
                ) : (
                    <ul className="space-y-2">
                        {codex.map((e, i) => (
                            <li key={i} className="text-sm text-gray-200 font-sans leading-snug border-l-2 border-green-500/40 pl-3">
                                {e.story} <span className="text-xs text-gray-400">({e.date})</span>
                            </li>
                        ))}
                    </ul>
                )}
                <div className="flex justify-end mt-4">
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

export default StoryCodex;
