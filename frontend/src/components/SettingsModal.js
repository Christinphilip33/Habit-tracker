import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api';
import { X, Download, Upload, Moon, Sun, Monitor } from 'lucide-react';

export default function SettingsModal({ onClose, refresh }) {
  const { user } = useAuth();
  const [importing, setImporting] = useState(false);

  const handleExport = async () => {
    try {
      const { data } = await api.get('/api/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `habitflow-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Export failed');
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!window.confirm('This will replace ALL your current data. Continue?')) {
        setImporting(false);
        return;
      }
      await api.post('/api/import', data);
      refresh();
      alert('Data imported successfully!');
      onClose();
    } catch (err) {
      alert('Import failed. Invalid file.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200]" data-testid="settings-modal">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[520px] max-h-[85vh] bg-[#F9F8F6] rounded-t-3xl border-t border-[#E6DFD4] overflow-hidden">
        <div className="w-12 h-1.5 bg-[#E6DFD4] rounded-full mx-auto mt-3" />
        <div className="flex items-center justify-between px-6 pt-4 pb-3">
          <h2 className="text-xl font-bold" style={{ fontFamily: 'Outfit' }}>Settings</h2>
          <button data-testid="settings-close" onClick={onClose} className="w-9 h-9 rounded-full bg-[#F0F4F1] flex items-center justify-center">
            <X size={18} className="text-[#5C6B61]" />
          </button>
        </div>

        <div className="px-6 pb-8 overflow-y-auto max-h-[calc(85vh-80px)] space-y-6">
          {/* Account */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C86B53] block mb-3">Account</span>
            <div className="bg-white rounded-2xl border border-[#E6DFD4] p-4">
              <p className="text-sm font-semibold">{user?.name}</p>
              <p className="text-xs text-[#5C6B61]">{user?.email}</p>
            </div>
          </div>

          {/* Data Backup */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C86B53] block mb-3">Data Backup</span>
            <p className="text-xs text-[#5C6B61] mb-4">Your data is saved in the cloud. Export a backup for extra safety.</p>
            <div className="flex gap-3">
              <button data-testid="export-btn" onClick={handleExport}
                className="flex-1 py-4 bg-white border border-[#E6DFD4] rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#F0F4F1] transition-colors">
                <Download size={16} /> Export JSON
              </button>
              <label className="flex-1 py-4 bg-white border border-[#E6DFD4] rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#F0F4F1] transition-colors cursor-pointer">
                <Upload size={16} /> {importing ? 'Importing...' : 'Import'}
                <input type="file" accept=".json" onChange={handleImport} className="sr-only" data-testid="import-input" />
              </label>
            </div>
          </div>

          {/* About */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C86B53] block mb-3">About</span>
            <div className="bg-white rounded-2xl border border-[#E6DFD4] p-4">
              <p className="text-sm font-semibold" style={{ fontFamily: 'Outfit' }}>HabitFlow v2.0</p>
              <p className="text-xs text-[#5C6B61] mt-1">Build your identity through daily habits. Now with cloud sync and cross-device support.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
