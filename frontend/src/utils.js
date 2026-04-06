// Date/XP utility functions shared across components
export function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function toDateKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function parseDate(dateKey) {
  if (!dateKey) return new Date();
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function formatDateHeader(dateKey) {
  const d = parseDate(dateKey);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

export function getWeekDates(centerDate) {
  const center = new Date(centerDate);
  const dayOfWeek = center.getDay();
  const start = addDays(center, -dayOfWeek);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function getLast7Days(from) {
  return Array.from({ length: 7 }, (_, i) => addDays(from || new Date(), -(6 - i)));
}

export function getCompletionStatus(completions, dateKey) {
  const comp = completions?.[dateKey];
  if (!comp) return 'pending';
  if (typeof comp === 'string') return comp;
  return comp?.status || 'pending';
}

export function isHabitDueOnDate(habit, dateKey) {
  const effectiveStart = habit.startDate || habit.createdAt;
  if (effectiveStart && dateKey < effectiveStart) return false;
  const freq = habit.frequency || { type: 'daily' };
  if (freq.type === 'daily') return true;
  if (freq.type === 'specific') {
    const d = parseDate(dateKey);
    return (freq.days || []).includes(d.getDay());
  }
  if (freq.type === 'interval') {
    const start = parseDate(effectiveStart);
    const date = parseDate(dateKey);
    const diffTime = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) -
      Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays % (freq.interval || 2) === 0;
  }
  if (freq.type === 'monthly') {
    const prefix = dateKey.substring(0, 7);
    let count = 0;
    Object.keys(habit.completions || {}).forEach(k => {
      if (k.startsWith(prefix) && getCompletionStatus(habit.completions, k) === 'completed') count++;
    });
    return count < (freq.perMonth || 5);
  }
  return true;
}

export function calculateStreak(habit) {
  let streak = 0;
  const tk = todayKey();
  let check = new Date();
  if (getCompletionStatus(habit.completions, tk) !== 'completed') {
    check = addDays(check, -1);
  }
  for (let i = 0; i < 365; i++) {
    const key = toDateKey(check);
    if (key < (habit.createdAt || '')) break;
    const status = getCompletionStatus(habit.completions, key);
    if (status === 'completed' || status === 'streak_protected') {
      streak++;
      check = addDays(check, -1);
    } else if (!isHabitDueOnDate(habit, key)) {
      check = addDays(check, -1);
    } else {
      break;
    }
  }
  return streak;
}

export function calculateSuccessRate(habit) {
  const start = parseDate(habit.createdAt);
  const end = new Date();
  let due = 0, done = 0;
  let curr = new Date(start);
  while (curr <= end) {
    const key = toDateKey(curr);
    if (isHabitDueOnDate(habit, key)) {
      due++;
      if (getCompletionStatus(habit.completions, key) === 'completed') done++;
    }
    curr = addDays(curr, 1);
  }
  return due === 0 ? 0 : Math.round((done / due) * 100);
}

export const XP_PER_LEVEL = 2000;
export function calculateLevel(totalXP) { return Math.floor(totalXP / XP_PER_LEVEL); }
export function xpToNextLevel(totalXP) { return totalXP % XP_PER_LEVEL; }

export function getLevelTitle(level) {
  if (level >= 50) return 'Zen Master';
  if (level >= 40) return 'Habit Legend';
  if (level >= 30) return 'Identity Architect';
  if (level >= 20) return 'Discipline Warrior';
  if (level >= 15) return 'Warrior of Habit';
  if (level >= 10) return 'Habit Builder';
  if (level >= 5) return 'Rising Star';
  return 'Beginner';
}

export function getDayScore(habits, dateKey) {
  let done = 0, total = 0;
  habits.forEach(h => {
    if (!isHabitDueOnDate(h, dateKey)) return;
    if (h.type === 'numeric') {
      total += h.targetValue;
      const comp = h.completions?.[dateKey];
      const val = comp && typeof comp !== 'string' ? comp.value : 0;
      done += Math.min(val, h.targetValue);
    } else {
      total += 1;
      if (getCompletionStatus(h.completions, dateKey) === 'completed') done += 1;
    }
  });
  return total === 0 ? 0 : Math.round((done / total) * 100);
}
