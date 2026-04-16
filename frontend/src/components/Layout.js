import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api';
import TodayView from './TodayView';
import HabitsView from './HabitsView';
import TasksView from './TasksView';
import TimerView from './TimerView';
import AnalyticsView from './AnalyticsView';
import SettingsModal from './SettingsModal';
import HabitForm from './HabitForm';
import { CalendarDays, BarChart3, ListChecks, Timer, TrendingUp, Plus, Settings, LogOut, Leaf } from 'lucide-react';

const TABS = [
  { id: 'today', label: 'Today', icon: CalendarDays },
  { id: 'habits', label: 'Habits', icon: BarChart3 },
  { id: 'tasks', label: 'Tasks', icon: ListChecks },
  { id: 'timer', label: 'Timer', icon: Timer },
  { id: 'analytics', label: 'Data', icon: TrendingUp },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState('today');
  const [habits, setHabits] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [xp, setXp] = useState({ total: 0, weekXP: 0, availableXP: 0, streakProtectionsUsed: 0 });
  const [showSettings, setShowSettings] = useState(false);
  const [showHabitForm, setShowHabitForm] = useState(false);
  const [editingHabit, setEditingHabit] = useState(null);
  const [showFab, setShowFab] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [h, t, c, x] = await Promise.all([
        api.get('/api/habits'),
        api.get('/api/tasks'),
        api.get('/api/categories'),
        api.get('/api/xp'),
      ]);
      setHabits(h.data);
      setTasks(t.data);
      setCategories(c.data);
      setXp(x.data);
    } catch (e) {
      console.error('Failed to fetch data:', e.message);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openHabitForm = (habit = null) => {
    setEditingHabit(habit);
    setShowHabitForm(true);
  };

  const refreshData = () => fetchAll();

  const renderTab = () => {
    switch (tab) {
      case 'today':
        return <TodayView habits={habits} xp={xp} categories={categories} refresh={refreshData} openHabitForm={openHabitForm} />;
      case 'habits':
        return <HabitsView habits={habits} categories={categories} refresh={refreshData} openHabitForm={openHabitForm} />;
      case 'tasks':
        return <TasksView tasks={tasks} categories={categories} refresh={refreshData} />;
      case 'timer':
        return <TimerView />;
      case 'analytics':
        return <AnalyticsView habits={habits} xp={xp} categories={categories} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F8F6] max-w-[520px] mx-auto relative" data-testid="app-layout">
      {/* Header */}
      <header className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[520px] z-50 bg-[#F9F8F6]/80 backdrop-blur-xl border-b border-white/40 px-6 py-4 flex items-center justify-between" data-testid="app-header">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#F0F4F1] border border-[#E6DFD4] flex items-center justify-center">
            <Leaf className="w-5 h-5 text-[#6B8E78]" strokeWidth={1.5} />
          </div>
          <span className="text-lg font-bold tracking-tight text-[#1A2E20]" style={{ fontFamily: 'Outfit' }}>HabitFlow</span>
        </div>
        <div className="flex items-center gap-2">
          <button data-testid="settings-btn" onClick={() => setShowSettings(true)} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[#F0F4F1] transition-colors">
            <Settings size={20} className="text-[#5C6B61]" strokeWidth={1.5} />
          </button>
          <button data-testid="logout-btn" onClick={logout} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[#F0F4F1] transition-colors">
            <LogOut size={20} className="text-[#5C6B61]" strokeWidth={1.5} />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="pt-[76px] pb-[100px] px-5">
        {renderTab()}
      </main>

      {/* FAB */}
      <button
        data-testid="fab-btn"
        onClick={() => openHabitForm()}
        className="fixed bottom-[100px] right-6 max-w-[520px] w-14 h-14 rounded-2xl bg-[#C86B53] text-white shadow-lg shadow-[#C86B53]/30 flex items-center justify-center z-40 hover:scale-105 active:scale-95 transition-transform"
      >
        <Plus size={24} strokeWidth={2} />
      </button>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[520px] z-50 bg-white/90 backdrop-blur-xl border-t border-[#E6DFD4] px-2 pt-2 pb-[max(8px,env(safe-area-inset-bottom))]" data-testid="bottom-nav">
        <div className="flex items-center justify-around">
          {TABS.map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                data-testid={`nav-${t.id}`}
                onClick={() => setTab(t.id)}
                className={`flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-all duration-200 min-w-[56px] ${
                  active ? 'text-[#C86B53]' : 'text-[#5C6B61] hover:text-[#1A2E20]'
                }`}
              >
                <Icon size={22} strokeWidth={active ? 2 : 1.5} />
                <span className="text-[10px] font-bold tracking-wider uppercase">{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Modals */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} refresh={refreshData} />}
      {showHabitForm && (
        <HabitForm
          habit={editingHabit}
          categories={categories}
          onClose={() => { setShowHabitForm(false); setEditingHabit(null); }}
          refresh={refreshData}
        />
      )}
    </div>
  );
}
