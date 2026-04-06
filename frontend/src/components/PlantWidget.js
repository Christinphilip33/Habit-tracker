import React from 'react';
import { todayKey, toDateKey, getWeekDates, getCompletionStatus, isHabitDueOnDate } from '../utils';
import { Sprout, TreePine, Flower2, Leaf } from 'lucide-react';

const STAGES = [
  { name: 'Seed', minRate: 0, icon: Leaf, color: '#5C6B61' },
  { name: 'Sprout', minRate: 20, icon: Sprout, color: '#9AE6B4' },
  { name: 'Growing', minRate: 40, icon: Sprout, color: '#68D391' },
  { name: 'Thriving', minRate: 60, icon: TreePine, color: '#48BB78' },
  { name: 'Blooming', minRate: 80, icon: Flower2, color: '#6B8E78' },
];

export default function PlantWidget({ habits }) {
  if (!habits || habits.length === 0) return null;

  const tk = todayKey();
  const weekDates = getWeekDates(new Date());
  let totalDue = 0, totalDone = 0;

  weekDates.forEach(d => {
    const key = toDateKey(d);
    if (key > tk) return;
    habits.forEach(h => {
      if (isHabitDueOnDate(h, key)) {
        totalDue++;
        if (getCompletionStatus(h.completions, key) === 'completed') totalDone++;
      }
    });
  });

  const rate = totalDue === 0 ? 0 : Math.round((totalDone / totalDue) * 100);
  let stage = STAGES[0];
  for (const s of STAGES) {
    if (rate >= s.minRate) stage = s;
  }
  const nextStage = STAGES.find(s => s.minRate > rate);
  const progressToNext = nextStage
    ? Math.round(((rate - stage.minRate) / (nextStage.minRate - stage.minRate)) * 100)
    : 100;

  const Icon = stage.icon;

  return (
    <div className="bg-white rounded-2xl border border-[#E6DFD4] p-5 flex items-center gap-5" data-testid="plant-widget">
      <div className="w-16 h-16 rounded-full flex items-center justify-center relative shrink-0"
        style={{ backgroundColor: stage.color + '20' }}>
        <div className="absolute inset-[-6px] rounded-full opacity-20 blur-lg" style={{ backgroundColor: stage.color }} />
        <Icon size={32} className="relative z-10" style={{ color: stage.color }} strokeWidth={1.5} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-base font-bold" style={{ fontFamily: 'Outfit' }}>{stage.name}</p>
        <p className="text-xs text-[#5C6B61] mb-2">{rate}% this week</p>
        <div className="w-full h-1.5 bg-[#F0F4F1] rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progressToNext}%`, background: `linear-gradient(90deg, ${stage.color}, #C86B53)` }} />
        </div>
        {nextStage ? (
          <p className="text-[10px] text-[#5C6B61] mt-1">Next: {nextStage.name} at {nextStage.minRate}%</p>
        ) : (
          <p className="text-[10px] text-[#6B8E78] font-semibold mt-1">Your plant is fully blooming!</p>
        )}
      </div>
    </div>
  );
}
