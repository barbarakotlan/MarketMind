import React from 'react';
import { X, Keyboard } from 'lucide-react';

// --- KEYBOARD SHORTCUTS HELP ---
const KeyboardHelp = ({ onClose }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
        <div className="ui-panel-elevated w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-mm-text-primary">
                    <Keyboard className="w-5 h-5" />
                    Keyboard Shortcuts
                </h3>
                <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                    <X className="w-5 h-5 text-gray-400" />
                </button>
            </div>
            
            <div className="space-y-3">
                {[
                    { key: '← / K', desc: 'Previous chapter' },
                    { key: '→ / J', desc: 'Next chapter' },
                    { key: 'M', desc: 'Mark chapter complete' },
                    { key: 'Esc', desc: 'Exit / Close modals' },
                    { key: '/', desc: 'Open search' },
                    { key: '?', desc: 'Show this help' },
                ].map(({ key, desc }) => (
                    <div key={key} className="flex items-center justify-between py-2">
                        <span className="text-gray-600 dark:text-gray-300">{desc}</span>
                        <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono text-gray-700 dark:text-gray-300 shadow-sm border border-gray-200 dark:border-gray-600">
                            {key}
                        </kbd>
                    </div>
                ))}
            </div>
        </div>
    </div>
);

export default KeyboardHelp;
