import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function WatchlistModal({ isOpen, onClose, onSave, editList = null }) {
const [name, setName] = useState(editList?.name || '');
const [description, setDescription] = useState(editList?.description || '');
const [isPublic, setIsPublic] = useState(editList?.isPublic ?? false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    
    setSaving(true);
    await onSave({ name: name.trim(), description: description.trim(), isPublic });
    setSaving(false);
    onClose();
  };

  useEffect(() => {
  if (editList) {
    setName(editList.name || '');
    setDescription(editList.description || '');
    setIsPublic(editList.isPublic ?? false);
  } else {
    setName('');
    setDescription('');
    setIsPublic(false);
  }
}, [editList]);

if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100000] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-[#050505] border-2 border-zinc-800 rounded-xl p-6 md:p-8 max-w-md w-full shadow-2xl"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">
              {editList ? 'Edit List' : 'Create Watchlist'}
            </h2>
            <button
              onClick={onClose}
              className="text-zinc-500 hover:text-white transition-colors text-2xl"
            >
              ×
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-black uppercase tracking-wider text-zinc-500 block mb-2">
                List Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Healthcare Stocks"
                className="w-full bg-black border border-zinc-800 text-white px-4 py-3 rounded-lg outline-none focus:border-[#00ff4e]/50 transition-all"
                style={{ caretColor: '#00ff4e' }}
                maxLength={50}
              />
            </div>

            <div>
              <label className="text-xs font-black uppercase tracking-wider text-zinc-500 block mb-2">
                Description (Optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's this list about?"
                className="w-full bg-black border border-zinc-800 text-white px-4 py-3 rounded-lg outline-none focus:border-[#00ff4e]/50 transition-all resize-none"
                style={{ caretColor: '#00ff4e' }}
                rows={3}
                maxLength={200}
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-zinc-900 rounded-lg border border-zinc-800">
              <div>
                <p className="text-sm font-black text-white uppercase">Public List</p>
                <p className="text-[10px] text-zinc-500 mt-1">Allow others to view this list</p>
              </div>
              <button
                onClick={() => setIsPublic(!isPublic)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  isPublic ? 'bg-[#00ff4e]' : 'bg-zinc-700'
                }`}
              >
                <motion.div
                  className="absolute top-1 w-4 h-4 bg-black rounded-full"
                  animate={{ left: isPublic ? '28px' : '4px' }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </button>
            </div>

            {isPublic && (
              <div className="bg-yellow-500/10 border border-yellow-500/50 text-yellow-500 px-4 py-3 rounded-lg text-xs">
                ⚠️ <strong>Disclaimer:</strong> Public lists are for educational purposes only. Not financial advice.
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="w-full bg-[#00ff4e] text-black font-black py-3 rounded-lg hover:opacity-90 transition-all disabled:opacity-50 uppercase tracking-tight"
            >
              {saving ? 'Saving...' : editList ? 'Save Changes' : 'Create List'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}