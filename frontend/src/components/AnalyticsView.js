import React from 'react';
import { todayKey, toDateKey, addDays, getCompletionStatus, isHabitDueOnDate, calculateLevel, getLevelTitle } from '../utils';
import { TrendingUp, Award } from 'lucide-react';

export default function AnalyticsView({ habits, xp, categories }) {
  const activeHabits = habits.filter(h => !h.archived);
  const level = calculateLevel(xp.total || 0);

  let totalCompletions = 0;
  const catCounts = {};
  const dayCounts = {};

  activeHabits.forEach(h => {
    Object.entries(h.completions || {}).forEach(([k, v]) => {
      const status = typeof v === 'string' ? v : v?.status;
      if (status === 'completed') {
        totalCompletions++;
        if (h.category) catCounts[h.category] = (catCounts[h.category] || 0) + 1;
        dayCounts[k] = (dayCounts[k] || 0) + 1;
      }
    });
  });

  // Consistency matrix (last 12 weeks)
  const endDate = new Date();
  const matrixWeeks = 12;
  const matrixStart = addDays(endDate, -(matrixWeeks * 7 - 1));

  const renderMatrix = () => {
    const weeks = [];
    let curr = new Date(matrixStart);
    for (let w = 0; w < matrixWeeks; w++) {
      const days = [];
      for (let d = 0; d < 7; d++) {
        const key = toDateKey(curr);
        let due = 0, done = 0;
        activeHabits.forEach(h => {
          if (isHabitDueOnDate(h, key)) {
            due++;
            if (getCompletionStatus(h.completions, key) === 'completed') done++;
          }
        });
        const score = due > 0 ? done / due : -1;
        let bg = 'bg-[#F0F4F1]';
        if (score > 0 && score <= 0.33) bg = 'bg-[#6B8E78]/30';
        else if (score > 0.33 && score <= 0.66) bg = 'bg-[#6B8E78]/60';
        else if (score > 0.66) bg = 'bg-[#6B8E78]';
        days.push(<div key={key} className={`w-3 h-3 rounded-sm ${bg}`} title={`${key}: ${due > 0 ? Math.round(score * 100) : 0}%`} />);
        curr = addDays(curr, 1);
      }
      weeks.push(<div key={w} className="flex flex-col gap-1">{days}</div>);
    }
    return weeks;
  };

  // Weekly chart
  const last7 = Array.from({ length: 7 }, (_, i) => addDays(new Date(), -(6 - i)));
  const weekData = last7.map(d => ({ date: d, val: dayCounts[toDateKey(d)] || 0 }));
  const maxVal = Math.max(...weekData.map(d => d.val), 1);
  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  // Focus areas
  const topCats = Object.entries(catCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, count]) => ({ cat: categories.find(c => c.id === id), count }))
    .filter(x => x.cat);

  const totalCatCount = topCats.reduce((s, x) => s + x.count, 0);

  return (
    <div className="space-y-8 animate-fade-in-up" data-testid="analytics-view">
      <div>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#5C6B61]">Global Progress</span>
        <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'Outfit' }}>Analytics</h1>
      </div>

      {/* Hero stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-[#E6DFD4] p-6" data-testid="total-completions">
          <p className="text-sm text-[#5C6B61] mb-1">Total Completions</p>
          <p className="text-3xl font-bold" style={{ fontFamily: 'Outfit' }}>{totalCompletions.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#E6DFD4] p-6" data-testid="zen-level">
          <p className="text-sm text-[#5C6B61] mb-1">Level</p>
          <p className="text-3xl font-bold text-[#6B8E78]" style={{ fontFamily: 'Outfit' }}>{getLevelTitle(level)}</p>
        </div>
      </div>

      {/* Consistency Matrix */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold" style={{ fontFamily: 'Outfit' }}>Consistency</h2>
          <span className="text-xs text-[#5C6B61]">Last 12 Weeks</span>
        </div>
        <div className="bg-white rounded-2xl border border-[#E6DFD4] p-5 overflow-x-auto" data-testid="consistency-matrix">
          <div className="flex gap-1">
            {renderMatrix()}
          </div>
          <div className="flex items-center justify-between mt-4">
            <span className="text-[10px] text-[#5C6B61]">Less</span>
            <div className="flex gap-1">
              <div className="w-3 h-3 rounded-sm bg-[#F0F4F1]" />
              <div className="w-3 h-3 rounded-sm bg-[#6B8E78]/30" />
              <div className="w-3 h-3 rounded-sm bg-[#6B8E78]/60" />
              <div className="w-3 h-3 rounded-sm bg-[#6B8E78]" />
            </div>
            <span className="text-[10px] text-[#5C6B61]">More</span>
          </div>
        </div>
      </div>

      {/* Weekly Activity */}
      <div>
        <h2 className="text-xl font-bold mb-4" style={{ fontFamily: 'Outfit' }}>Weekly Activity</h2>
        <div className="bg-white rounded-2xl border border-[#E6DFD4] p-5" data-testid="weekly-chart">
          <div className="flex items-end justify-between h-40 gap-2">
            {weekData.map((d, i) => {
              const height = (d.val / maxVal) * 100;
              return (
                <div key={i} className="flex flex-col items-center gap-2 flex-1 h-full">
                  <div className="flex-1 w-full flex flex-col justify-end">
                    <div className="bg-[#6B8E78] rounded-t-lg transition-all duration-500 w-full" style={{ height: `${Math.max(height, 4)}%` }} />
                  </div>
                  <span className="text-[10px] font-bold text-[#5C6B61]">{dayLabels[i]}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Focus Areas */}
      {topCats.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-4" style={{ fontFamily: 'Outfit' }}>Focus Areas</h2>
          <div className="bg-white rounded-2xl border border-[#E6DFD4] p-5 space-y-4" data-testid="focus-areas">
            {topCats.map((x, i) => {
              const pct = Math.round((x.count / totalCatCount) * 100);
              return (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: x.cat.color }} />
                  <span className="text-sm flex-1">{x.cat.name}</span>
                  <div className="w-24 h-2 bg-[#F0F4F1] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: x.cat.color }} />
                  </div>
                  <span className="text-xs font-bold w-8 text-right">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
