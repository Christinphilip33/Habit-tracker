import React, { useState } from 'react';
import api from '../api';
import { todayKey, toDateKey } from '../utils';
import { Check, Trash2, Calendar, Tag, Plus, Edit3 } from 'lucide-react';

export default function TasksView({ tasks, categories, refresh }) {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [category, setCategory] = useState('');
  const [editingTask, setEditingTask] = useState(null);

  const pending = tasks.filter(t => !t.completed);
  const completed = tasks.filter(t => t.completed);
  const tk = todayKey();

  const handleAdd = async () => {
    if (!title.trim()) return;
    await api.post('/api/tasks', { title: title.trim(), dueDate, category });
    setTitle(''); setDueDate(''); setCategory('');
    refresh();
  };

  const handleToggle = async (id) => {
    await api.post(`/api/tasks/${id}/toggle`);
    refresh();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this task?')) return;
    await api.delete(`/api/tasks/${id}`);
    refresh();
  };

  const handleUpdate = async (id, updates) => {
    await api.put(`/api/tasks/${id}`, updates);
    setEditingTask(null);
    refresh();
  };

  const getTimeText = (task) => {
    if (!task.dueDate) return '';
    if (task.dueDate === tk) return 'Today';
    if (task.dueDate < tk) return 'Overdue';
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (task.dueDate === toDateKey(tomorrow)) return 'Tomorrow';
    return task.dueDate;
  };

  return (
    <div className="space-y-6 animate-fade-in-up" data-testid="tasks-view">
      <div>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#5C6B61]">Focus</span>
        <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'Outfit' }}>Daily Tasks</h1>
      </div>

      {/* Input */}
      <div className="bg-white rounded-2xl border border-[#E6DFD4] p-5" data-testid="task-input-section">
        <div className="flex items-center gap-3 bg-[#F9F8F6] rounded-xl px-4 py-3 mb-4">
          <input data-testid="task-input" value={title} onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="What needs to be done?" maxLength={200}
            className="flex-1 bg-transparent text-sm outline-none text-[#1A2E20] placeholder:text-[#B0AFA9]" />
          <button onClick={() => document.getElementById('task-date-hidden')?.showPicker?.()} className="text-[#5C6B61] hover:text-[#C86B53]">
            <Calendar size={18} />
          </button>
          <input id="task-date-hidden" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
            className="sr-only" />
        </div>
        <div className="flex gap-3">
          <select data-testid="task-category-select" value={category} onChange={e => setCategory(e.target.value)}
            className="flex-1 px-4 py-3 bg-[#F9F8F6] rounded-xl text-sm text-[#5C6B61] border-none outline-none appearance-none">
            <option value="">No Category</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button data-testid="task-add-btn" onClick={handleAdd}
            className="px-6 py-3 bg-[#C86B53] text-white font-semibold rounded-xl flex items-center gap-2 hover:bg-[#B35A44] transition-colors active:scale-[0.98]">
            <Plus size={16} /> Add
          </button>
        </div>
        {dueDate && <p className="text-xs text-[#6B8E78] mt-2">Due: {getTimeText({ dueDate })}</p>}
      </div>

      {/* Pending */}
      {pending.length > 0 && (
        <div data-testid="pending-tasks">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#5C6B61]">To-Do</span>
            <span className="text-[10px] font-bold px-3 py-1 bg-[#F0F4F1] text-[#C86B53] rounded-full">{pending.length} Active</span>
          </div>
          <div className="space-y-3">
            {pending.map((t, i) => (
              <TaskItem key={t.id} task={t} categories={categories} onToggle={handleToggle}
                onDelete={handleDelete} onEdit={setEditingTask} timeText={getTimeText(t)} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <div className="opacity-60" data-testid="completed-tasks">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#5C6B61] mb-3 block">Completed</span>
          <div className="space-y-3">
            {completed.map(t => (
              <TaskItem key={t.id} task={t} categories={categories} onToggle={handleToggle} onDelete={handleDelete} onEdit={setEditingTask} timeText={getTimeText(t)} />
            ))}
          </div>
        </div>
      )}

      {tasks.length === 0 && (
        <div className="text-center py-12 bg-white rounded-2xl border border-[#E6DFD4]" data-testid="empty-tasks">
          <Check size={48} className="mx-auto text-[#6B8E78] opacity-40 mb-3" strokeWidth={1} />
          <h3 className="text-lg font-bold mb-2" style={{ fontFamily: 'Outfit' }}>No tasks yet</h3>
          <p className="text-sm text-[#5C6B61]">Add a task above to get started</p>
        </div>
      )}

      {/* Edit Modal */}
      {editingTask && (
        <EditTaskModal task={editingTask} categories={categories}
          onClose={() => setEditingTask(null)} onSave={handleUpdate} />
      )}
    </div>
  );
}

function TaskItem({ task, categories, onToggle, onDelete, onEdit, timeText, index = 0 }) {
  const cat = categories.find(c => c.id === task.category);
  const isOverdue = timeText === 'Overdue';
  return (
    <div data-testid={`task-item-${task.id}`}
      className="bg-white rounded-2xl border border-[#E6DFD4] p-4 flex items-center gap-4 hover:border-[#C86B53]/20 transition-all animate-fade-in-up"
      style={{ animationDelay: `${index * 40}ms` }}>
      <button data-testid={`task-toggle-${task.id}`} onClick={() => onToggle(task.id)}
        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${
          task.completed ? 'bg-[#C86B53]/80 border-[#C86B53]/80' : 'border-[#E6DFD4] hover:border-[#C86B53]'
        }`}>
        {task.completed && <Check size={12} className="text-white" strokeWidth={3} />}
      </button>
      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onEdit(task)}>
        <p className={`text-sm font-semibold truncate ${task.completed ? 'line-through opacity-60' : ''}`}>{task.title}</p>
        <div className="flex items-center gap-3 mt-1">
          {timeText && (
            <span className={`text-[10px] font-medium ${isOverdue ? 'text-[#D94F4F]' : 'text-[#5C6B61]'}`}>{timeText}</span>
          )}
          {cat && <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#F0F4F1] text-[#6B8E78]">{cat.name}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button data-testid={`task-edit-${task.id}`} onClick={() => onEdit(task)} className="w-8 h-8 rounded-full flex items-center justify-center opacity-40 hover:opacity-100 hover:bg-[#F0F4F1]">
          <Edit3 size={14} className="text-[#5C6B61]" />
        </button>
        <button data-testid={`task-delete-${task.id}`} onClick={() => onDelete(task.id)} className="w-8 h-8 rounded-full flex items-center justify-center opacity-40 hover:opacity-100 hover:bg-red-50">
          <Trash2 size={14} className="text-[#D94F4F]" />
        </button>
      </div>
    </div>
  );
}

function EditTaskModal({ task, categories, onClose, onSave }) {
  const [title, setTitle] = useState(task.title);
  const [dueDate, setDueDate] = useState(task.dueDate || '');
  const [category, setCategory] = useState(task.category || '');

  return (
    <div className="fixed inset-0 z-[200]" data-testid="edit-task-modal">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[520px] bg-[#F9F8F6] rounded-t-3xl border-t border-[#E6DFD4] p-6">
        <h2 className="text-lg font-bold mb-5" style={{ fontFamily: 'Outfit' }}>Edit Task</h2>
        <div className="space-y-4">
          <input data-testid="edit-task-title" value={title} onChange={e => setTitle(e.target.value)} maxLength={200}
            className="w-full px-5 py-4 bg-white border border-[#E6DFD4] rounded-xl focus:outline-none focus:border-[#C86B53]" />
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
            className="w-full px-5 py-4 bg-white border border-[#E6DFD4] rounded-xl focus:outline-none focus:border-[#C86B53]" />
          <select value={category} onChange={e => setCategory(e.target.value)}
            className="w-full px-5 py-4 bg-white border border-[#E6DFD4] rounded-xl focus:outline-none focus:border-[#C86B53] appearance-none">
            <option value="">No Category</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-4 bg-[#F0F4F1] rounded-xl font-semibold">Cancel</button>
            <button data-testid="edit-task-save" onClick={() => onSave(task.id, { title: title.trim(), dueDate, category })}
              className="flex-[2] py-4 bg-[#C86B53] text-white font-bold rounded-xl active:scale-[0.98]">Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}
