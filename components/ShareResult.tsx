import React, { useMemo, useState } from 'react';
import { FinalScoreBreakdown } from '../types';
import { buildShareText, buildShareCard, ShareContext } from '../utils/share';

// Share panel: the Wordle-style artifact. Copy always works (textarea fallback);
// the PNG card path only shows where navigator.share can send files.

const ShareResult: React.FC<{ breakdown: FinalScoreBreakdown; ctx: ShareContext }> = ({ breakdown, ctx }) => {
    const [feedback, setFeedback] = useState('');
    const copyBtnRef = React.useRef<HTMLButtonElement>(null);
    const text = useMemo(() => buildShareText(breakdown, ctx), [breakdown, ctx]);
    const canShareFiles = typeof navigator !== 'undefined' && !!navigator.canShare;

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setFeedback('Copied! Paste it anywhere.');
        } catch {
            // Clipboard API blocked (older Safari without user-activation quirks): select-fallback.
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); setFeedback('Copied! Paste it anywhere.'); }
            catch { setFeedback('Copy failed. Long-press the text to copy it.'); }
            document.body.removeChild(ta);
            copyBtnRef.current?.focus(); // the select() moved focus; put it back
        }
        window.setTimeout(() => setFeedback(''), 3000);
    };

    const shareCard = async () => {
        try {
            const blob = await buildShareCard(breakdown, ctx);
            if (!blob) throw new Error('no blob');
            const file = new File([blob], 'general-deterrence-shift.png', { type: 'image/png' });
            if (navigator.canShare?.({ files: [file] })) {
                await navigator.share({ files: [file], text });
                setFeedback('Shared!');
            } else {
                await navigator.share?.({ text });
                setFeedback('Shared!');
            }
        } catch (e) {
            if ((e as Error)?.name !== 'AbortError') setFeedback('Sharing not available here. Copy instead!');
        }
        window.setTimeout(() => setFeedback(''), 3000);
    };

    return (
        <div className="w-full max-w-6xl mb-4 rounded-lg border-2 border-cyan-500/50 bg-black/50 p-3 md:p-4 text-left">
            <h2 className="text-sm md:text-base font-display text-cyan-400 tracking-widest mb-2">SHARE YOUR SHIFT</h2>
            <pre className="whitespace-pre-wrap font-sans text-xs md:text-sm text-gray-200 bg-black/50 rounded p-2 border border-gray-700 select-all">{text}</pre>
            <div className="flex gap-2 mt-2 items-center flex-wrap">
                <button
                    ref={copyBtnRef}
                    onClick={copy}
                    className="bg-cyan-600 hover:bg-cyan-500 border-2 border-cyan-400 text-white font-bold py-2 px-4 rounded font-display tracking-wider text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                    Copy Result
                </button>
                {canShareFiles && (
                    <button
                        onClick={shareCard}
                        className="bg-pink-600 hover:bg-pink-500 border-2 border-pink-400 text-white font-bold py-2 px-4 rounded font-display tracking-wider text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    >
                        Share Card
                    </button>
                )}
                <span role="status" aria-live="polite" className="text-sm text-green-400 font-sans">{feedback}</span>
            </div>
        </div>
    );
};

export default ShareResult;
