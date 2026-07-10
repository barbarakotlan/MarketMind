import React from 'react';
import { motion } from 'framer-motion';
import { Brain, Briefcase } from 'lucide-react';
import { blurIn } from './animations';

// ── Animated mini chart SVG ───────────────────────────────────────────────────
function MiniChart({ color = '#3b82f6', className = '' }) {
    const pts = [40,60,45,65,50,40,55,30,45,50,35,55,25,45,30,20,35,15,25,20];
    const d = pts.reduce((acc, y, i) => {
        const x = (i / (pts.length - 1)) * 200;
        return acc + (i === 0 ? `M${x},${y}` : ` L${x},${y}`);
    }, '');
    const id = `g${color.replace('#', '')}`;
    return (
        <svg viewBox="0 0 200 80" className={className} preserveAspectRatio="none">
            <defs>
                <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                    <stop offset="100%" stopColor={color} stopOpacity="0.02" />
                </linearGradient>
            </defs>
            <path d={`${d} L200,80 L0,80 Z`} fill={`url(#${id})`} />
            <path d={d} stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

// ── Dashboard preview ─────────────────────────────────────────────────────────
function DashboardPreview() {
    return (
        <motion.div
            variants={blurIn}
            initial="hidden"
            animate="show"
            transition={{ delay: 0.35 }}
            className="relative w-full max-w-2xl mx-auto"
        >
            <div className="absolute inset-0 bg-blue-500/10 blur-3xl rounded-3xl" />
            <div className="relative bg-gray-900 border border-gray-700/60 rounded-2xl shadow-2xl overflow-hidden">
                {/* Window chrome */}
                <div className="flex items-center gap-2 px-4 py-3 bg-gray-800/80 border-b border-gray-700/60">
                    <span className="w-3 h-3 rounded-full bg-red-500/70" />
                    <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
                    <span className="w-3 h-3 rounded-full bg-green-500/70" />
                    <span className="ml-4 text-xs text-gray-500 font-mono">marketmind · dashboard</span>
                </div>
                <div className="p-5 space-y-4">
                    {/* Ticker row */}
                    <div className="grid grid-cols-5 gap-2">
                        {[
                            { label:'S&P 500', val:'$592.40', pct:'+0.84%', pos:true  },
                            { label:'NASDAQ',  val:'$513.21', pct:'+1.12%', pos:true  },
                            { label:'Dow',     val:'$430.15', pct:'+0.21%', pos:true  },
                            { label:'Bitcoin', val:'$96,240', pct:'-1.04%', pos:false },
                            { label:'Gold',    val:'$237.80', pct:'+0.38%', pos:true  },
                        ].map(t => (
                            <div key={t.label} className="bg-gray-800/60 rounded-lg p-2.5 border border-gray-700/40">
                                <p className="text-xs text-gray-500 mb-1">{t.label}</p>
                                <p className="text-sm font-bold text-white">{t.val}</p>
                                <p className={`text-xs font-medium ${t.pos ? 'text-emerald-400' : 'text-red-400'}`}>{t.pct}</p>
                            </div>
                        ))}
                    </div>
                    {/* Chart */}
                    <div className="bg-gray-800/60 rounded-xl border border-gray-700/40 p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <span className="text-sm font-bold text-white">AAPL</span>
                                <span className="ml-2 text-xs text-gray-400">Apple Inc.</span>
                            </div>
                            <span className="text-xs font-semibold text-emerald-400">+2.34%  $189.32</span>
                        </div>
                        <MiniChart color="#3b82f6" className="w-full h-20" />
                    </div>
                    {/* Bottom cards */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-800/60 rounded-xl border border-blue-500/20 p-3">
                            <div className="flex items-center gap-2 mb-2">
                                <Brain className="w-3.5 h-3.5 text-blue-400" />
                                <span className="text-xs text-gray-400">AI Forecast · 7d</span>
                            </div>
                            <div className="flex items-end gap-2">
                                <span className="text-xl font-bold text-white">$194.80</span>
                                <span className="text-sm font-medium text-emerald-400 mb-0.5">↑ +2.9%</span>
                            </div>
                            <div className="mt-2 grid grid-cols-3 gap-1">
                                {['RF','XGB','LR'].map((m, i) => (
                                    <div key={m} className="text-center">
                                        <div className="text-xs text-gray-500">{m}</div>
                                        <div className={`text-xs font-medium ${i < 2 ? 'text-emerald-400' : 'text-gray-300'}`}>
                                            {['$195.1','$194.4','$193.9'][i]}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="bg-gray-800/60 rounded-xl border border-emerald-500/20 p-3">
                            <div className="flex items-center gap-2 mb-2">
                                <Briefcase className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-xs text-gray-400">Paper Portfolio</span>
                            </div>
                            <p className="text-xl font-bold text-white">$108,432</p>
                            <p className="text-sm font-medium text-emerald-400 mt-0.5">+$8,432 P&L</p>
                            <MiniChart color="#10b981" className="w-full h-8 mt-2" />
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

export default DashboardPreview;
