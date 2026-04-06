import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, RotateCcw, SkipForward } from 'lucide-react';

const PRESETS = [
  { label: '5 min', value: 5 },
  { label: '15 min', value: 15 },
  { label: '25 min', value: 25 },
  { label: '45 min', value: 45 },
  { label: '60 min', value: 60 },
];

export default function TimerView() {
  const [preset, setPreset] = useState(25);
  const [seconds, setSeconds] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState(0);
  const intervalRef = useRef(null);
  const totalSeconds = preset * 60;

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSeconds(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current);
            setRunning(false);
            setSessions(s => s + 1);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [running]);

  const selectPreset = (val) => {
    setPreset(val);
    setSeconds(val * 60);
    setRunning(false);
    clearInterval(intervalRef.current);
  };

  const reset = () => {
    setSeconds(preset * 60);
    setRunning(false);
    clearInterval(intervalRef.current);
  };

  const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
  const secs = String(seconds % 60).padStart(2, '0');
  const progress = 1 - (seconds / totalSeconds);
  const circumference = 2 * Math.PI * 130;
  const dashOffset = circumference * (1 - progress);

  return (
    <div className="space-y-8 animate-fade-in-up flex flex-col items-center" data-testid="timer-view">
      <div className="text-center">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#5C6B61]">Focus Session</span>
        <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'Outfit' }}>Deep Work Timer</h1>
      </div>

      {/* Timer Ring */}
      <div className="relative w-72 h-72" data-testid="timer-ring">
        <svg width="288" height="288" className="-rotate-90">
          <circle cx="144" cy="144" r="130" fill="none" stroke="#F0F4F1" strokeWidth="8" />
          <circle cx="144" cy="144" r="130" fill="none" stroke="#C86B53" strokeWidth="8" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 1s linear' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-6xl font-bold tracking-tight" style={{ fontFamily: 'Outfit', fontVariantNumeric: 'tabular-nums' }} data-testid="timer-display">
            {mins}:{secs}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B8E78] mt-1">
            {running ? 'Focus' : seconds === 0 ? 'Done!' : 'Ready'}
          </span>
        </div>
      </div>

      {/* Presets */}
      <div className="flex flex-wrap justify-center gap-3" data-testid="timer-presets">
        {PRESETS.map(p => (
          <button key={p.value} data-testid={`preset-${p.value}`} onClick={() => selectPreset(p.value)}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
              preset === p.value ? 'bg-[#C86B53] text-white border-[#C86B53] shadow-md shadow-[#C86B53]/20' : 'bg-white border-[#E6DFD4] text-[#5C6B61]'
            }`}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-10" data-testid="timer-controls">
        <button data-testid="timer-reset" onClick={reset}
          className="w-14 h-14 rounded-full bg-white border border-[#E6DFD4] flex items-center justify-center text-[#5C6B61] hover:bg-[#F0F4F1] active:scale-90 transition-all">
          <RotateCcw size={22} />
        </button>
        <button data-testid="timer-play" onClick={() => seconds > 0 && setRunning(!running)}
          className="w-20 h-20 rounded-full bg-[#C86B53] text-white flex items-center justify-center shadow-lg shadow-[#C86B53]/30 hover:scale-105 active:scale-95 transition-all">
          {running ? <Pause size={32} /> : <Play size={32} />}
        </button>
        <button data-testid="timer-skip" onClick={() => { setSessions(s => s + 1); reset(); }}
          className="w-14 h-14 rounded-full bg-white border border-[#E6DFD4] flex items-center justify-center text-[#5C6B61] hover:bg-[#F0F4F1] active:scale-90 transition-all">
          <SkipForward size={22} />
        </button>
      </div>

      {/* Session dots */}
      <div className="flex flex-col items-center gap-3">
        <div className="flex gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className={`w-3 h-3 rounded-full transition-all ${
              i < sessions ? 'bg-[#6B8E78] shadow-md shadow-[#6B8E78]/30' : 'bg-[#F0F4F1] border border-[#E6DFD4]'
            }`} />
          ))}
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#5C6B61]">{sessions} of 4 sessions</span>
      </div>
    </div>
  );
}
