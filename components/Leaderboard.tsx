import React, { useEffect, useState } from 'react';
import { LeaderboardEntry } from '../types';

const API_BASE = (typeof window !== 'undefined' && (window as unknown as { LEADERBOARD_API?: string }).LEADERBOARD_API) || '/api';

type Scope = 'all' | 'daily' | 'station';

interface LeaderboardProps {
  scores: LeaderboardEntry[]; // initial all-time list from the parent fetch
  refreshKey?: number;
  onDeleteMine?: () => Promise<boolean>;
}

// Which runs this browser has already commended (no auth; honesty-box model).
const clappedIds = (): Set<number> => {
  try { return new Set(JSON.parse(localStorage.getItem('gd-clapped') || '[]')); } catch { return new Set(); }
};

const Leaderboard: React.FC<LeaderboardProps> = ({ scores, refreshKey = 0, onDeleteMine }) => {
  // TODAY is the useful default: those player-reported runs share the same map.
  const [scope, setScope] = useState<Scope>('daily');
  const [rows, setRows] = useState<LeaderboardEntry[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [retryKey, setRetryKey] = useState(0);
  const [rolloverKey, setRolloverKey] = useState(0);
  const [clapped, setClapped] = useState<Set<number>>(clappedIds);
  const [deleting, setDeleting] = useState(false);
  const [privacyMessage, setPrivacyMessage] = useState('');
  const station = (() => {
    try {
      const saved = (localStorage.getItem('gd-station') || '').trim().toUpperCase();
      return /^[A-Z0-9]{2,4}$/.test(saved) ? saved : '';
    } catch { return ''; }
  })();

  useEffect(() => {
    if (scope === 'all' && scores.length) setRows(scores);
  }, [scores, scope]);

  useEffect(() => {
    setRows(scope === 'all' ? scores : []);
  }, [scope]);

  useEffect(() => {
    let cancelled = false;
    setLoadState('loading');
    const q = scope === 'daily' ? 'scope=daily'
      : scope === 'station' ? `station=${encodeURIComponent(station)}` : '';
    fetch(`${API_BASE}/leaderboard?${q}`)
      .then(r => {
        if (!r.ok) throw new Error('Leaderboard unavailable');
        return r.json();
      })
      .then(d => {
        if (!cancelled && Array.isArray(d)) { setRows(d); setLoadState('ready'); }
      })
      .catch(() => { if (!cancelled) setLoadState('error'); });
    return () => { cancelled = true; };
  }, [scope, station, refreshKey, retryKey, rolloverKey]);

  // A results screen left open over NZ midnight must not keep calling yesterday "Today".
  useEffect(() => {
    if (scope !== 'daily') return;
    const timer = window.setInterval(() => setRolloverKey(key => key + 1), 60_000);
    return () => window.clearInterval(timer);
  }, [scope]);

  const clap = async (entry: LeaderboardEntry) => {
    if (!entry.id || clapped.has(entry.id)) return;
    try {
      const response = await fetch(`${API_BASE}/leaderboard/${entry.id}/kudos`, { method: 'POST' });
      if (!response.ok) return;
      const next = new Set(clapped);
      next.add(entry.id);
      setClapped(next);
      try { localStorage.setItem('gd-clapped', JSON.stringify([...next])); } catch { /* ignore */ }
      setRows(rs => rs.map(r => (r.id === entry.id ? { ...r, kudos: (r.kudos || 0) + 1 } : r)));
    } catch { /* leave the local count unchanged */ }
  };

  const deleteMine = async () => {
    if (!onDeleteMine || deleting || !window.confirm('Delete every community score saved by this browser?')) return;
    setDeleting(true);
    const deleted = await onDeleteMine();
    setPrivacyMessage(deleted ? 'Your community scores were deleted.' : 'Scores could not be deleted. Try again when the server is available.');
    if (deleted) setRetryKey(key => key + 1);
    setDeleting(false);
  };

  const tabClass = (active: boolean) =>
    `px-2 py-1 rounded text-xs font-display tracking-wider border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
      active ? 'bg-cyan-700 border-cyan-400 text-white' : 'bg-transparent border-gray-600 text-gray-300 hover:border-cyan-500'
    }`;

  return (
    <div className="w-full flex flex-col">
      <h2 className="text-2xl font-semibold text-yellow-400 mb-1 text-center font-display text-glow-yellow">Community Patrols</h2>
      <p className="text-xs text-gray-400 text-center mb-2 font-sans">Player-reported and unverified</p>
      <p className="text-xs text-gray-500 text-center mb-2 font-sans">Public names, station codes, scores, and run summaries use a 90-day retention window.</p>
      <div className="flex gap-2 justify-center mb-3" role="group" aria-label="Leaderboard scope">
        <button className={tabClass(scope === 'daily')} aria-pressed={scope === 'daily'} onClick={() => setScope('daily')}>TODAY</button>
        <button className={tabClass(scope === 'all')} aria-pressed={scope === 'all'} onClick={() => setScope('all')}>ALL DAILY</button>
        {station && <button className={tabClass(scope === 'station')} aria-pressed={scope === 'station'} onClick={() => setScope('station')}>{station}</button>}
      </div>
      {/* Announce what the scope switch loaded (the rows swap silently otherwise). */}
      <div role="status" aria-live="polite" className="sr-only">
        {scope === 'all' ? 'All-time' : scope === 'daily' ? 'Today' : `Station ${station}`}: {rows.length} {rows.length === 1 ? 'patrol' : 'patrols'}
      </div>
      {loadState === 'loading' && rows.length === 0 ? (
        <p className="text-gray-400 text-center" role="status">Loading community scores…</p>
      ) : loadState === 'error' ? (
        <div className="text-center">
          <p className="text-yellow-300">Community board unavailable.</p>
          <button type="button" onClick={() => setRetryKey(key => key + 1)} className="mt-2 px-3 py-1 border-2 border-cyan-500 text-cyan-300 rounded font-display text-sm">Retry</button>
        </div>
      ) : rows.length === 0 ? (
        <p className="text-gray-400 text-center">No scores here yet. Be the first!</p>
      ) : (
        <ol className="text-left space-y-2 max-h-64 overflow-y-auto pr-1">
          {rows.map((entry, index) => (
            <li key={entry.id ?? index} className="flex justify-between items-center text-base bg-black/30 p-2 rounded gap-2">
              <span className="text-gray-400 w-6 flex-shrink-0">{index + 1}.</span>
              <span className="font-semibold text-cyan-400 flex-grow truncate min-w-0" title={entry.name}>
                {entry.name}
                {entry.station && <span className="ml-1 text-[10px] text-gray-400 font-display align-middle">[{entry.station}]</span>}
                {scope !== 'all' && (entry.attempts ?? 0) > 1 && <span className="ml-1 text-[10px] text-gray-400 font-sans align-middle">· best of {entry.attempts}</span>}
              </span>
              {entry.id && (
                <button
                  onClick={() => clap(entry)}
                  aria-disabled={clapped.has(entry.id)}
                  aria-label={`Commend ${entry.name}'s patrol${entry.kudos ? `, ${entry.kudos} commendations` : ''}${clapped.has(entry.id) ? ', already commended' : ''}`}
                  className={`flex-shrink-0 text-sm px-1.5 py-0.5 rounded border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                    clapped.has(entry.id) ? 'border-green-500 text-green-400' : 'border-gray-600 text-gray-300 hover:border-green-500'
                  }`}
                >
                  <span aria-hidden="true">👏</span>{entry.kudos ? ` ${entry.kudos}` : ''}
                </button>
              )}
              <span className="font-bold text-white flex-shrink-0 tabular-nums">{entry.score.toLocaleString()}</span>
            </li>
          ))}
        </ol>
      )}
      {onDeleteMine && (
        <button type="button" disabled={deleting} onClick={deleteMine} className="mt-3 self-center text-xs text-gray-400 hover:text-red-300 underline disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
          {deleting ? 'Deleting…' : 'Delete my community scores'}
        </button>
      )}
      <p role="status" className="mt-1 min-h-4 text-xs text-gray-400 text-center">{privacyMessage}</p>
    </div>
  );
};

export default Leaderboard;
