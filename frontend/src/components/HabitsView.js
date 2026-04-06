import React from 'react';
import { todayKey, toDateKey, getLast7Days, getCompletionStatus, calculateStreak, calculateSuccessRate } from '../utils';
import { Flame, TrendingUp, Check, X, Archive, GripVertical } from 'lucide-react';

export default function HabitsView({ habits, categories, refresh, openHabitForm }) {
  const activeHabits = habits.filter(h => !h.archived);
  const archivedHabits = habits.filter(h => h.archived);
  const tk = todayKey();
  const last7 = getLast7Days(new Date());
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  const getCatIcon = (catId) => {
    const cat = categories.find(c => c.id === catId);
    return cat?.name || '';
  };

  const getCatColor = (catId) => {
    const cat = categories.find(c => c.id === catId);
    return cat?.color || '#C86B53';
  };

  const getFreqText = (freq) => {
    if (!freq) return 'Daily';
    if (freq.type === 'specific') return 'Specific Days';
    if (freq.type === 'interval') return `Every ${freq.interval} days`;
    if (freq.type === 'monthly') return `${freq.perMonth}x / month`;
    return 'Daily';
  };

  return (
    <div className="space-y-6 animate-fade-in-up" data-testid="habits-view">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'Outfit' }}>My Habits</h1>
        <p className="text-sm text-[#5C6B61] mt-1">{activeHabits.length} habits active this week</p>
      </div>

      {activeHabits.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-[#E6DFD4]" data-testid="empty-habits-master">
          <div className="text-5xl mb-4 opacity-40">
            <TrendingUp size={56} className="mx-auto text-[#6B8E78]" strokeWidth={1} />
          </div>
          <h3 className="text-xl font-bold mb-2" style={{ fontFamily: 'Outfit' }}>Build your identity</h3>
          <p className="text-sm text-[#5C6B61] max-w-[280px] mx-auto">Create your first habit and start becoming who you want to be</p>
        </div>
      ) : (
        <div className="space-y-4">
          {activeHabits.map((h, i) => {
            const streak = calculateStreak(h);
            const successRate = calculateSuccessRate(h);
            return (
              <div
                key={h.id}
                data-testid={`habit-master-${h.id}`}
                onClick={() => openHabitForm(h)}
                className="bg-white rounded-2xl border border-[#E6DFD4] p-5 cursor-pointer hover:border-[#C86B53]/20 hover:-translate-y-0.5 transition-all duration-200 animate-fade-in-up"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold" style={{ fontFamily: 'Outfit' }}>{h.name}</h3>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B8E78]">{getFreqText(h.frequency)}</span>
                  </div>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: getCatColor(h.category) + '20' }}>
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getCatColor(h.category) }} />
                  </div>
                </div>

                {/* 7-day dots */}
                <div className="flex justify-between mb-4 px-1">
                  {last7.map((d, di) => {
                    const key = toDateKey(d);
                    const status = getCompletionStatus(h.completions, key);
                    const isFuture = key > tk;
                    return (
                      <div key={key} className="flex flex-col items-center gap-1.5">
                        <span className="text-[9px] font-bold text-[#5C6B61]">{days[di]}</span>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                          status === 'completed' ? 'bg-[#6B8E78]' :
                          status === 'missed' ? 'bg-[#D94F4F]' :
                          status === 'streak_protected' ? 'bg-amber-400' :
                          isFuture ? 'bg-[#F0F4F1] opacity-40' :
                          'bg-[#F0F4F1] border border-[#E6DFD4]'
                        }`}>
                          {status === 'completed' && <Check size={14} className="text-white" strokeWidth={3} />}
                          {status === 'missed' && <X size={12} className="text-white" strokeWidth={3} />}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-5 pt-4 border-t border-[#F0F4F1]">
                  <div className="flex items-center gap-1.5">
                    <Flame size={14} className="text-[#C86B53]" />
                    <span className="text-xs font-bold">{streak} Streak</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <TrendingUp size={14} className="text-[#6B8E78]" />
                    <span className="text-xs font-bold">{successRate}% Success</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Archived */}
      {archivedHabits.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <Archive size={14} className="text-[#5C6B61]" />
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#5C6B61]">Archived</span>
          </div>
          <div className="space-y-3 opacity-60">
            {archivedHabits.map(h => (
              <div key={h.id} onClick={() => openHabitForm(h)} className="bg-white rounded-2xl border border-[#E6DFD4] p-4 cursor-pointer">
                <p className="font-semibold text-sm">{h.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
