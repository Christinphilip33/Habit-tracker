import React, { useState, useRef, useEffect } from 'react';
import api from '../api';
import { todayKey, toDateKey, addDays, formatDateHeader, getDayScore, getCompletionStatus, isHabitDueOnDate, calculateLevel, xpToNextLevel, getLevelTitle, calculateStreak, getWeekDates, XP_PER_LEVEL } from '../utils';
import { Check, X, Minus, Plus, Play, Pause, RotateCcw, Shield, ChevronLeft, ChevronRight, Flame, Sparkles, Leaf } from 'lucide-react';
import PlantWidget from './PlantWidget';

export default function TodayView({ habits, xp, categories, refresh, openHabitForm }) {
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [flyUps, setFlyUps] = useState([]);
  const scrollRef = useRef(null);
  const tk = todayKey();

  const activeHabits = habits.filter(h => !h.archived);
  const todaysHabits = activeHabits.filter(h => isHabitDueOnDate(h, selectedDate));
  const dayScore = getDayScore(activeHabits, selectedDate);
  const level = calculateLevel(xp.total || 0);
  const xpInLevel = xpToNextLevel(xp.total || 0);
  const levelTitle = getLevelTitle(level);

  // Calculate overall streak (longest current among all habits)
  const maxStreak = activeHabits.reduce((max, h) => Math.max(max, calculateStreak(h)), 0);

  // Date picker dates
  const todayDate = new Date();
  const dateStart = addDays(todayDate, -7);
  const dates = Array.from({ length: 28 }, (_, i) => addDays(dateStart, i));

  useEffect(() => {
    if (scrollRef.current) {
      const active = scrollRef.current.querySelector('.date-active');
      if (active) active.scrollIntoView({ inline: 'center', block: 'nearest' });
    }
  }, [selectedDate]);

  const showXPFly = (id) => {
    const flyId = Date.now();
    setFlyUps(prev => [...prev, { id: flyId, habitId: id }]);
    setTimeout(() => setFlyUps(prev => prev.filter(f => f.id !== flyId)), 900);
  };

  const handleToggle = async (habitId) => {
    try {
      const res = await api.post(`/api/habits/${habitId}/toggle`, { dateKey: selectedDate });
      if (res.data.xpDelta > 0) showXPFly(habitId);
      refresh();
    } catch (e) { console.error(e.message); }
  };

  const handleNumeric = async (habitId, delta) => {
    try {
      await api.post(`/api/habits/${habitId}/numeric`, { dateKey: selectedDate, delta });
      if (delta > 0) showXPFly(habitId);
      refresh();
    } catch (e) { console.error(e.message); }
  };

  const handleTimerComplete = async (habitId) => {
    try {
      await api.post(`/api/habits/${habitId}/timer`, { dateKey: selectedDate, action: 'complete' });
      showXPFly(habitId);
      refresh();
    } catch (e) { console.error(e.message); }
  };

  const getCatColor = (catId) => {
    const cat = categories.find(c => c.id === catId);
    return cat?.color || '#C86B53';
  };

  const isFuture = selectedDate > tk;

  // Weekly summary
  const weekDates = getWeekDates(new Date());
  let weekDone = 0, weekTotal = 0, perfectDays = 0;
  weekDates.forEach(d => {
    const key = toDateKey(d);
    if (key > tk) return;
    let dayDone = 0, dayDue = 0;
    activeHabits.forEach(h => {
      if (isHabitDueOnDate(h, key)) {
        dayDue++;
        if (getCompletionStatus(h.completions, key) === 'completed') { dayDone++; weekDone++; }
        weekTotal++;
      }
    });
    if (dayDue > 0 && dayDone === dayDue) perfectDays++;
  });
  const weekRate = weekTotal > 0 ? Math.round((weekDone / weekTotal) * 100) : 0;

  const circumference = 2 * Math.PI * 46;
  const dashOffset = circumference * (1 - dayScore / 100);

  return (
    <div className="space-y-6 animate-fade-in-up" data-testid="today-view">
      {/* Date Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'Outfit' }} data-testid="today-title">
          {selectedDate === tk ? 'Today' : formatDateHeader(selectedDate)}
        </h1>
        <span className="text-sm text-[#5C6B61]">{formatDateHeader(selectedDate)}</span>
      </div>

      {/* Date Picker */}
      <div className="flex items-center gap-2 -mx-5">
        <button onClick={() => scrollRef.current?.scrollBy({ left: -200, behavior: 'smooth' })} className="p-1 text-[#5C6B61] shrink-0">
          <ChevronLeft size={18} />
        </button>
        <div ref={scrollRef} className="flex gap-2 overflow-x-auto py-2 px-1 no-scrollbar flex-1" style={{ scrollbarWidth: 'none' }}>
          {dates.map(d => {
            const key = toDateKey(d);
            const isActive = key === selectedDate;
            const isToday = key === tk;
            const isFut = key > tk;
            const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
            return (
              <button
                key={key}
                data-testid={`date-${key}`}
                onClick={() => setSelectedDate(key)}
                className={`flex flex-col items-center justify-center min-w-[52px] h-[72px] rounded-2xl shrink-0 transition-all duration-200 border ${
                  isActive
                    ? 'bg-[#C86B53] text-white border-[#C86B53] shadow-lg shadow-[#C86B53]/20'
                    : isToday
                    ? 'bg-white border-[#C86B53]/30 text-[#1A2E20]'
                    : isFut
                    ? 'bg-[#F0F4F1] border-[#E6DFD4] text-[#5C6B61] opacity-60'
                    : 'bg-white border-[#E6DFD4] text-[#1A2E20]'
                } ${isActive ? 'date-active' : ''}`}
              >
                <span className={`text-[10px] font-bold tracking-wider ${isActive ? 'text-white/80' : 'text-[#5C6B61]'}`}>{days[d.getDay()]}</span>
                <span className="text-lg font-bold">{d.getDate()}</span>
              </button>
            );
          })}
        </div>
        <button onClick={() => scrollRef.current?.scrollBy({ left: 200, behavior: 'smooth' })} className="p-1 text-[#5C6B61] shrink-0">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Score + Level */}
      <div className="grid grid-cols-2 gap-4">
        {/* Score Gauge */}
        <div className="bg-white rounded-2xl border border-[#E6DFD4] p-5 flex flex-col items-center" data-testid="score-gauge">
          <div className="relative w-[100px] h-[100px]">
            <svg width="100" height="100" className="-rotate-90">
              <circle cx="50" cy="50" r="46" fill="none" stroke="#F0F4F1" strokeWidth="8" />
              <circle cx="50" cy="50" r="46" fill="none" stroke="#6B8E78" strokeWidth="8" strokeLinecap="round"
                strokeDasharray={circumference} strokeDashoffset={dashOffset}
                style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold" style={{ fontFamily: 'Outfit' }}>{dayScore}%</span>
              <span className="text-[10px] text-[#5C6B61] font-semibold uppercase tracking-wider">Done</span>
            </div>
          </div>
        </div>

        {/* Level + Streak */}
        <div className="flex flex-col gap-3">
          <div className="bg-white rounded-2xl border border-[#E6DFD4] p-4 flex-1" data-testid="level-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B8E78]">Level {level}</span>
              <Shield size={14} className="text-[#6B8E78]" />
            </div>
            <p className="text-sm font-bold mb-2" style={{ fontFamily: 'Outfit' }}>{levelTitle}</p>
            <div className="w-full h-1.5 bg-[#F0F4F1] rounded-full overflow-hidden">
              <div className="h-full bg-[#6B8E78] rounded-full transition-all duration-500" style={{ width: `${(xpInLevel / XP_PER_LEVEL) * 100}%` }} />
            </div>
            <p className="text-[10px] text-[#5C6B61] mt-1 text-right">{xpInLevel} / {XP_PER_LEVEL} XP</p>
          </div>
          <div className="bg-white rounded-2xl border border-[#E6DFD4] p-4 flex items-center gap-3" data-testid="streak-card">
            <div className="w-9 h-9 rounded-full bg-[#FFF0ED] flex items-center justify-center">
              <Flame size={18} className="text-[#C86B53]" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#5C6B61]">Streak</span>
              <p className="text-lg font-bold" style={{ fontFamily: 'Outfit' }}>{maxStreak} Days</p>
            </div>
          </div>
        </div>
      </div>

      {/* Weekly Summary */}
      {selectedDate === tk && activeHabits.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#E6DFD4] p-5" data-testid="weekly-summary">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={14} className="text-[#5C6B61]" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#5C6B61]">Weekly Summary</span>
          </div>
          <div className="flex justify-between">
            <div className="text-center flex-1">
              <p className="text-xl font-bold text-[#C86B53]" style={{ fontFamily: 'Outfit' }}>{weekDone}</p>
              <p className="text-[10px] text-[#5C6B61]">Total</p>
            </div>
            <div className="text-center flex-1 border-x border-[#E6DFD4]">
              <p className="text-xl font-bold text-[#6B8E78]" style={{ fontFamily: 'Outfit' }}>{String(perfectDays).padStart(2, '0')}</p>
              <p className="text-[10px] text-[#5C6B61]">Perfect</p>
            </div>
            <div className="text-center flex-1">
              <p className="text-xl font-bold text-[#1A2E20]" style={{ fontFamily: 'Outfit' }}>{weekRate}%</p>
              <p className="text-[10px] text-[#5C6B61]">Success</p>
            </div>
          </div>
        </div>
      )}

      {/* Plant Widget */}
      {selectedDate === tk && <PlantWidget habits={activeHabits} />}

      {/* Habits List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold" style={{ fontFamily: 'Outfit' }}>Identity Pillars</h2>
          <button data-testid="edit-habits-link" onClick={() => {}} className="text-xs font-bold text-[#C86B53]">Edit</button>
        </div>

        {todaysHabits.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-[#E6DFD4]" data-testid="empty-habits">
            <div className="text-4xl mb-3 opacity-50">
              <Leaf size={48} className="mx-auto text-[#6B8E78]" strokeWidth={1} />
            </div>
            <h3 className="text-lg font-bold mb-2" style={{ fontFamily: 'Outfit' }}>No habits yet</h3>
            <p className="text-sm text-[#5C6B61] max-w-[260px] mx-auto">Tap the + button to start building your identity through daily habits</p>
          </div>
        ) : (
          <div className="space-y-3">
            {todaysHabits.map((h, i) => {
              const status = getCompletionStatus(h.completions, selectedDate);
              const catColor = getCatColor(h.category);
              const fly = flyUps.find(f => f.habitId === h.id);

              return (
                <div
                  key={h.id}
                  data-testid={`habit-card-${h.id}`}
                  onClick={() => openHabitForm(h)}
                  className={`bg-white rounded-2xl border border-[#E6DFD4] p-5 flex items-center gap-4 cursor-pointer hover:border-[#C86B53]/20 hover:-translate-y-0.5 transition-all duration-200 animate-fade-in-up relative`}
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  {/* XP Fly Up */}
                  {fly && (
                    <div className="absolute top-2 right-4 text-sm font-bold text-[#6B8E78] animate-xp-fly pointer-events-none">
                      +100 XP
                    </div>
                  )}

                  {/* Category indicator */}
                  <div className="w-1.5 h-10 rounded-full shrink-0" style={{ backgroundColor: catColor }} />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#1A2E20] truncate">{h.name}</p>
                    {h.identity && <p className="text-xs text-[#5C6B61] italic truncate mt-0.5">"{h.identity}"</p>}
                  </div>

                  {/* Action */}
                  <div onClick={(e) => e.stopPropagation()}>
                    {isFuture ? (
                      <span className="text-xs text-[#5C6B61] bg-[#F0F4F1] px-3 py-1.5 rounded-full font-medium">Scheduled</span>
                    ) : h.type === 'numeric' ? (
                      <NumericStepper habit={h} dateKey={selectedDate} onUpdate={handleNumeric} />
                    ) : h.type === 'timer' && status !== 'completed' ? (
                      <TimerButton habit={h} dateKey={selectedDate} onComplete={handleTimerComplete} />
                    ) : (
                      <button
                        data-testid={`toggle-${h.id}`}
                        onClick={() => handleToggle(h.id)}
                        className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 border-2 ${
                          status === 'completed'
                            ? 'bg-[#F0F4F1] border-[#6B8E78]'
                            : status === 'missed'
                            ? 'bg-red-50 border-[#D94F4F]'
                            : status === 'streak_protected'
                            ? 'bg-amber-50 border-amber-400'
                            : 'bg-[#F9F8F6] border-[#E6DFD4] hover:border-[#C86B53]'
                        } active:scale-90`}
                      >
                        {status === 'completed' && <Check size={18} className="text-[#6B8E78] animate-check-bounce" />}
                        {status === 'missed' && <X size={16} className="text-[#D94F4F]" />}
                        {status === 'streak_protected' && <Shield size={16} className="text-amber-500" />}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function NumericStepper({ habit, dateKey, onUpdate }) {
  const comp = habit.completions?.[dateKey];
  const val = comp && typeof comp !== 'string' ? comp.value : 0;
  return (
    <div className="flex items-center gap-2 bg-[#F0F4F1] rounded-full p-1" data-testid={`numeric-${habit.id}`}>
      <button onClick={() => onUpdate(habit.id, -1)} className="w-8 h-8 rounded-full bg-white flex items-center justify-center active:scale-90 transition-transform">
        <Minus size={14} />
      </button>
      <div className="text-center min-w-[50px]">
        <span className="text-sm font-bold">{val}/{habit.targetValue}</span>
        {habit.unit && <span className="text-[10px] text-[#5C6B61] block">{habit.unit}</span>}
      </div>
      <button onClick={() => onUpdate(habit.id, 1)} className="w-8 h-8 rounded-full bg-white flex items-center justify-center active:scale-90 transition-transform">
        <Plus size={14} />
      </button>
    </div>
  );
}

function TimerButton({ habit, dateKey, onComplete }) {
  const [seconds, setSeconds] = useState((habit.duration || 10) * 60);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (running) {
      if (!startedRef.current) {
        api.post(`/api/habits/${habit.id}/timer`, { action: 'start', dateKey }).catch(()=>{});
        startedRef.current = true;
      }
      intervalRef.current = setInterval(() => {
        setSeconds(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current);
            setRunning(false);
            onComplete(habit.id);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [running]);

  const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
  const secs = String(seconds % 60).padStart(2, '0');

  return (
    <div className="flex items-center gap-2">
      <button
        data-testid={`timer-btn-${habit.id}`}
        onClick={() => setRunning(!running)}
        className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
          running ? 'bg-[#C86B53] text-white' : 'bg-[#F0F4F1] text-[#1A2E20]'
        }`}
      >
        {running ? <Pause size={14} /> : <Play size={14} />}
        {`${mins}:${secs}`}
      </button>
      <button onClick={() => { setRunning(false); setSeconds((habit.duration || 10) * 60); }} className="w-8 h-8 rounded-full bg-[#F0F4F1] flex items-center justify-center">
        <RotateCcw size={14} className="text-[#5C6B61]" />
      </button>
    </div>
  );
}
