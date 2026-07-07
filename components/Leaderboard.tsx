import React, { useEffect, useState } from 'react';
import { LeaderboardEntry } from '../types';

const API_BASE = (typeof window !== 'undefined' && (window as unknown as { LEADERBOARD_API?: string }).LEADERBOARD_API) || '/api';

type Scope = 'all' | 'daily' | 'station';

interface LeaderboardProps {
  scores: LeaderboardEntry[]; // initial all-time list from the parent fetch
}

// Which runs this browser has already commended (no auth; honesty-box model).
const clappedIds = (): Set<number> => {
  try { return new Set(JSON.parse(localStorage.getItem('gd-clapped') || '[]')); } catch { return new Set(); }
};

const Leaderboard: React.FC<LeaderboardProps> = ({ scores }) => {
  const [scope, setScope] = useState<Scope>('all');
  const [rows, setRows] = useState<LeaderboardEntry[]>(scores);
  const [clapped, setClapped] = useState<Set<number>>(clappedIds);
  const station = (() => { try { return localStorage.getItem('gd-station') || ''; } catch { return ''; } })();

  useEffect(() => { if (scope === 'all') setRows(scores); }, [scores, scope]);

  useEffect(() => {
    if (scope === 'all') { setRows(scores); return; }
    let cancelled = false;
    const q = scope === 'daily' ? 'scope=daily' : `station=${encodeURIComponent(station)}`;
    fetch(`${API_BASE}/leaderboard?${q}`)
      .then(r => (r.ok ? r.json() : []))
      .then(d => { if (!cancelled && Array.isArray(d)) setRows(d); })
      .catch(() => { /* offline: keep whatever we have */ });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  const clap = async (entry: LeaderboardEntry) => {
    if (!entry.id || clapped.has(entry.id)) return;
    const next = new Set(clapped);
    next.add(entry.id);
    setClapped(next);
    try { localStorage.setItem('gd-clapped', JSON.stringify([...next])); } catch { /* ignore */ }
    setRows(rs => rs.map(r => (r.id === entry.id ? { ...r, kudos: (r.kudos || 0) + 1 } : r)));
    try { await fetch(`${API_BASE}/leaderboard/${entry.id}/kudos`, { method: 'POST' }); } catch { /* offline */ }
  };

  const tabClass = (active: boolean) =>
    `px-2 py-1 rounded text-xs font-display tracking-wider border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
      active ? 'bg-cyan-700 border-cyan-400 text-white' : 'bg-transparent border-gray-600 text-gray-300 hover:border-cyan-500'
    }`;

  return (
    <div className="w-full flex flex-col">
      <h2 className="text-2xl font-semibold text-yellow-400 mb-2 text-center font-display text-glow-yellow">Top Patrols</h2>
      <div className="flex gap-2 justify-center mb-3" role="group" aria-label="Leaderboard scope">
        <button className={tabClass(scope === 'all')} aria-pressed={scope === 'all'} onClick={() => setScope('all')}>ALL-TIME</button>
        <button className={tabClass(scope === 'daily')} aria-pressed={scope === 'daily'} onClick={() => setScope('daily')}>TODAY</button>
        {station && <button className={tabClass(scope === 'station')} aria-pressed={scope === 'station'} onClick={() => setScope('station')}>{station}</button>}
      </div>
      {/* Announce what the scope switch loaded (the rows swap silently otherwise). */}
      <div role="status" aria-live="polite" className="sr-only">
        {scope === 'all' ? 'All-time' : scope === 'daily' ? 'Today' : `Station ${station}`}: {rows.length} {rows.length === 1 ? 'patrol' : 'patrols'}
      </div>
      {rows.length === 0 ? (
        <p className="text-gray-400 text-center">No scores here yet. Be the first!</p>
      ) : (
        <ol className="text-left space-y-2 max-h-64 overflow-y-auto pr-1">
          {rows.map((entry, index) => (
            <li key={entry.id ?? index} className="flex justify-between items-center text-base bg-black/30 p-2 rounded gap-2">
              <span className="text-gray-400 w-6 flex-shrink-0">{index + 1}.</span>
              <span className="font-semibold text-cyan-400 flex-grow truncate min-w-0" title={entry.name}>
                {entry.name}
                {entry.station && <span className="ml-1 text-[10px] text-gray-400 font-display align-middle">[{entry.station}]</span>}
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
    </div>
  );
};

export default Leaderboard;
