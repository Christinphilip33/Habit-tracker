import React, { useState } from 'react';
import api from '../api';
import { todayKey } from '../utils';
import { X, Trash2, Archive, ArchiveRestore } from 'lucide-react';

const FREQ_OPTIONS = [
  { id: 'daily', label: 'Daily' },
  { id: 'specific', label: 'Specific Days' },
  { id: 'interval', label: 'Interval' },
  { id: 'monthly', label: 'Monthly' },
];

const TYPE_OPTIONS = [
  { id: 'toggle', label: 'Yes/No' },
  { id: 'numeric', label: 'Numeric' },
  { id: 'timer', label: 'Timer' },
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function HabitForm({ habit, categories, onClose, refresh }) {
  const isEdit = !!habit;
  const [name, setName] = useState(habit?.name || '');
  const [identity, setIdentity] = useState(habit?.identity || '');
  const [category, setCategory] = useState(habit?.category || '');
  const [type, setType] = useState(habit?.type || 'toggle');
  const [targetValue, setTargetValue] = useState(habit?.targetValue || 1);
  const [unit, setUnit] = useState(habit?.unit || '');
  const [duration, setDuration] = useState(habit?.duration || 10);
  const [freqType, setFreqType] = useState(habit?.frequency?.type || 'daily');
  const [freqDays, setFreqDays] = useState(habit?.frequency?.days || []);
  const [interval, setInterval2] = useState(habit?.frequency?.interval || 2);
  const [perMonth, setPerMonth] = useState(habit?.frequency?.perMonth || 5);
  const [reminderTime, setReminderTime] = useState(habit?.reminderTime || '');
  const [startDate, setStartDate] = useState(habit?.startDate || todayKey());
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const data = {
      name: name.trim(),
      identity: identity.trim(),
      category,
      type,
      targetValue,
      unit,
      duration: type === 'timer' ? duration : null,
      frequency: { type: freqType, days: freqDays, interval, perMonth },
      reminderTime,
      startDate,
    };
    try {
      if (isEdit) {
        await api.put(`/api/habits/${habit.id}`, data);
      } else {
        await api.post('/api/habits', data);
      }
      refresh();
      onClose();
    } catch (e) {
      console.error('Habit save failed:', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    await api.put(`/api/habits/${habit.id}`, { archived: !habit.archived });
    refresh();
    onClose();
  };

  const handleDelete = async () => {
    if (!window.confirm('Permanently delete this habit? This cannot be undone.')) return;
    await api.delete(`/api/habits/${habit.id}`);
    refresh();
    onClose();
  };

  const toggleDay = (day) => {
    setFreqDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  return (
    <div className="fixed inset-0 z-[200]" data-testid="habit-form-modal">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[520px] max-h-[90vh] bg-[#F9F8F6] rounded-t-3xl border-t border-[#E6DFD4] overflow-hidden animate-slide-up">
        <div className="w-12 h-1.5 bg-[#E6DFD4] rounded-full mx-auto mt-3" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-4 pb-3">
          <h2 className="text-xl font-bold" style={{ fontFamily: 'Outfit' }}>{isEdit ? 'Edit Habit' : 'New Habit'}</h2>
          <button data-testid="habit-form-close" onClick={onClose} className="w-9 h-9 rounded-full bg-[#F0F4F1] flex items-center justify-center">
            <X size={18} className="text-[#5C6B61]" />
          </button>
        </div>

        {/* Form */}
        <div className="px-6 pb-8 overflow-y-auto max-h-[calc(90vh-80px)] space-y-5">
          {/* Name */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#C86B53] mb-2">Habit Name</label>
            <input data-testid="habit-name-input" value={name} onChange={e => setName(e.target.value)} maxLength={100}
              placeholder="e.g. Meditate, Read, Exercise"
              className="w-full px-5 py-4 bg-white border border-[#E6DFD4] rounded-xl focus:outline-none focus:border-[#C86B53] focus:ring-2 focus:ring-[#C86B53]/10 transition-all" />
          </div>

          {/* Identity */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#C86B53] mb-2">Identity Statement</label>
            <input data-testid="habit-identity-input" value={identity} onChange={e => setIdentity(e.target.value)} maxLength={150}
              placeholder="I am someone who..."
              className="w-full px-5 py-4 bg-white border border-[#E6DFD4] rounded-xl italic focus:outline-none focus:border-[#C86B53] focus:ring-2 focus:ring-[#C86B53]/10 transition-all" />
          </div>

          {/* Category */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#C86B53] mb-2">Category</label>
            <select data-testid="habit-category-select" value={category} onChange={e => setCategory(e.target.value)}
              className="w-full px-5 py-4 bg-white border border-[#E6DFD4] rounded-xl appearance-none focus:outline-none focus:border-[#C86B53]">
              <option value="">No Category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Type */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#C86B53] mb-2">Habit Type</label>
            <div className="flex gap-2">
              {TYPE_OPTIONS.map(t => (
                <button key={t.id} data-testid={`type-${t.id}`} onClick={() => setType(t.id)}
                  className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${type === t.id ? 'bg-[#C86B53] text-white' : 'bg-white border border-[#E6DFD4] text-[#5C6B61]'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Numeric fields */}
          {type === 'numeric' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#C86B53] mb-2">Target</label>
                <input data-testid="habit-target-input" type="number" value={targetValue} onChange={e => setTargetValue(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-4 py-3 bg-white border border-[#E6DFD4] rounded-xl focus:outline-none focus:border-[#C86B53]" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#C86B53] mb-2">Unit</label>
                <input data-testid="habit-unit-input" value={unit} onChange={e => setUnit(e.target.value)} maxLength={30} placeholder="e.g. cups, pages"
                  className="w-full px-4 py-3 bg-white border border-[#E6DFD4] rounded-xl focus:outline-none focus:border-[#C86B53]" />
              </div>
            </div>
          )}

          {/* Timer field */}
          {type === 'timer' && (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#C86B53] mb-2">Duration (Minutes)</label>
              <input data-testid="habit-duration-input" type="number" value={duration} onChange={e => setDuration(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-4 py-3 bg-white border border-[#E6DFD4] rounded-xl focus:outline-none focus:border-[#C86B53]" />
            </div>
          )}

          {/* Frequency */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#C86B53] mb-2">Frequency</label>
            <div className="flex flex-wrap gap-2">
              {FREQ_OPTIONS.map(f => (
                <button key={f.id} data-testid={`freq-${f.id}`} onClick={() => setFreqType(f.id)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${freqType === f.id ? 'bg-[#C86B53] text-white' : 'bg-white border border-[#E6DFD4] text-[#5C6B61]'}`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {freqType === 'specific' && (
            <div className="flex flex-wrap gap-2">
              {DAY_NAMES.map((d, i) => (
                <button key={i} data-testid={`day-${i}`} onClick={() => toggleDay(i)}
                  className={`w-11 h-11 rounded-full text-sm font-semibold transition-all ${freqDays.includes(i) ? 'bg-[#C86B53] text-white' : 'bg-white border border-[#E6DFD4] text-[#5C6B61]'}`}>
                  {d.charAt(0)}
                </button>
              ))}
            </div>
          )}

          {freqType === 'interval' && (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#C86B53] mb-2">Every X Days</label>
              <input type="number" value={interval} onChange={e => setInterval2(Math.max(2, parseInt(e.target.value) || 2))}
                className="w-full px-4 py-3 bg-white border border-[#E6DFD4] rounded-xl focus:outline-none focus:border-[#C86B53]" />
            </div>
          )}

          {freqType === 'monthly' && (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#C86B53] mb-2">Times per Month</label>
              <input type="number" value={perMonth} onChange={e => setPerMonth(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-4 py-3 bg-white border border-[#E6DFD4] rounded-xl focus:outline-none focus:border-[#C86B53]" />
            </div>
          )}

          {/* Start Date + Reminder */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#C86B53] mb-2">Start Date</label>
              <input data-testid="habit-start-date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-[#E6DFD4] rounded-xl focus:outline-none focus:border-[#C86B53]" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#C86B53] mb-2">Reminder</label>
              <input data-testid="habit-reminder" type="time" value={reminderTime} onChange={e => setReminderTime(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-[#E6DFD4] rounded-xl focus:outline-none focus:border-[#C86B53]" />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button data-testid="habit-form-cancel" onClick={onClose}
              className="flex-1 py-4 bg-[#F0F4F1] text-[#1A2E20] font-semibold rounded-xl hover:bg-[#E6DFD4] transition-colors">
              Cancel
            </button>
            <button data-testid="habit-form-save" onClick={handleSave} disabled={saving}
              className="flex-[2] py-4 bg-[#C86B53] text-white font-bold rounded-xl hover:bg-[#B35A44] transition-colors shadow-lg shadow-[#C86B53]/20 disabled:opacity-60 active:scale-[0.98]">
              {saving ? 'Saving...' : isEdit ? 'Update Habit' : 'Create Habit'}
            </button>
          </div>

          {/* Edit-only actions */}
          {isEdit && (
            <div className="flex gap-3 pt-2">
              <button data-testid="habit-archive-btn" onClick={handleArchive}
                className="flex-1 py-3 bg-white border border-[#E6DFD4] rounded-xl text-sm font-semibold text-[#5C6B61] flex items-center justify-center gap-2 hover:bg-[#F0F4F1]">
                {habit.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                {habit.archived ? 'Restore' : 'Archive'}
              </button>
              <button data-testid="habit-delete-btn" onClick={handleDelete}
                className="flex-1 py-3 bg-white border border-red-200 rounded-xl text-sm font-semibold text-[#D94F4F] flex items-center justify-center gap-2 hover:bg-red-50">
                <Trash2 size={16} />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slide-up {
          from { transform: translate(-50%, 100%); }
          to { transform: translate(-50%, 0); }
        }
        .animate-slide-up { animation: slide-up 0.3s ease-out; }
      `}</style>
    </div>
  );
}
