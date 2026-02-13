import React, { useState } from 'react';
import {
  BookOpen,
  HelpCircle,
  Award,
  TrendingUp,
  ShieldAlert,
  Activity,
  Search,
  CheckCircle,
  RefreshCw,
  ChevronRight,
  Brain,
  Layers
} from 'lucide-react';
import { learningModules, QUESTION_BANK } from '../data/content';

// --- QUIZ COMPONENT (Unchanged Logic) ---
const QuizSection = () => {
    const [difficulty, setDifficulty] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userAnswers, setUserAnswers] = useState({});
    const [showResults, setShowResults] = useState(false);
    const [score, setScore] = useState(0);

    const startQuiz = (level) => {
        setDifficulty(level);
        const shuffled = [...QUESTION_BANK[level]].sort(() => 0.5 - Math.random());
        setQuestions(shuffled.slice(0, 10));
        setCurrentIndex(0);
        setUserAnswers({});
        setShowResults(false);
        setScore(0);
    };

    const handleAnswer = (answer) => {
        const currentQ = questions[currentIndex];
        if (currentQ.type === 'checkbox') {
            const currentSelection = userAnswers[currentQ.id] || [];
            const newSelection = currentSelection.includes(answer)
                ? currentSelection.filter(item => item !== answer)
                : [...currentSelection, answer];
            setUserAnswers({ ...userAnswers, [currentQ.id]: newSelection });
        } else {
            setUserAnswers({ ...userAnswers, [currentQ.id]: answer });
        }
    };

    const nextQuestion = () => {
        if (currentIndex < questions.length - 1) {
            setCurrentIndex(currentIndex + 1);
        } else {
            calculateScore();
            setShowResults(true);
        }
    };

    const calculateScore = () => {
        let newScore = 0;
        questions.forEach(q => {
            const userAns = userAnswers[q.id];
            if (!userAns) return;
            if (q.type === 'checkbox') {
                const correct = [...q.answer].sort();
                const user = [...userAns].sort();
                if (JSON.stringify(correct) === JSON.stringify(user)) newScore++;
            } else if (q.type === 'text') {
                if (userAns.toLowerCase().trim() === q.answer.toLowerCase()) newScore++;
            } else {
                if (userAns === q.answer) newScore++;
            }
        });
        setScore(newScore);
    };

    const resetQuiz = () => {
        setDifficulty(null);
        setShowResults(false);
        setScore(0);
    };

    if (!difficulty) {
        return (
            <div className="flex flex-col items-center justify-center py-12 animate-in fade-in zoom-in duration-500">
                <Brain className="w-20 h-20 text-blue-500 mb-6" />
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Test Your Market Knowledge</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-8 text-center max-w-lg">
                    Choose a difficulty level to start a quiz. Questions cover everything from basic terms to advanced trading strategies.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-2xl">
                    {['easy', 'medium', 'hard'].map((level) => (
                        <button
                            key={level}
                            onClick={() => startQuiz(level)}
                            className={`p-6 rounded-2xl border-2 transition-all hover:-translate-y-1 hover:shadow-xl capitalize text-lg font-bold flex flex-col items-center gap-3
                                ${level === 'easy' ? 'border-green-400 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100' : ''}
                                ${level === 'medium' ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-100' : ''}
                                ${level === 'hard' ? 'border-red-400 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-100' : ''}
                            `}
                        >
                            {level === 'easy' && <CheckCircle className="w-8 h-8" />}
                            {level === 'medium' && <Activity className="w-8 h-8" />}
                            {level === 'hard' && <ShieldAlert className="w-8 h-8" />}
                            {level}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    if (showResults) {
        const percentage = (score / questions.length) * 100;
        let message = "Good effort!";
        if (percentage >= 80) message = "Market Wizard! 🧙‍♂️";
        else if (percentage >= 50) message = "Solid Knowledge! 📈";
        else message = "Keep Learning! 📚";

        return (
            <div className="flex flex-col items-center justify-center py-12 animate-in fade-in zoom-in duration-500 text-center">
                <Award className={`w-24 h-24 mb-6 ${percentage >= 80 ? 'text-yellow-500' : 'text-blue-500'}`} />
                <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Quiz Complete</h2>
                <p className="text-xl text-gray-600 dark:text-gray-300 mb-6">{message}</p>
                <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 mb-8 w-full max-w-md">
                    <div className="text-6xl font-black text-blue-600 dark:text-blue-400 mb-2">{score}/{questions.length}</div>
                    <div className="text-sm font-bold text-gray-400 uppercase tracking-widest">Correct Answers</div>
                </div>
                <button onClick={resetQuiz} className="px-8 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-bold hover:opacity-90 transition-all flex items-center gap-2">
                    <RefreshCw className="w-5 h-5" /> Take Another Quiz
                </button>
            </div>
        );
    }

    const currentQ = questions[currentIndex];

    return (
        <div className="max-w-3xl mx-auto py-8">
            <div className="mb-8">
                <div className="flex justify-between text-xs font-bold uppercase text-gray-400 mb-2">
                    <span>Question {currentIndex + 1} of {questions.length}</span>
                    <span>{difficulty} Mode</span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }} />
                </div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-lg border border-gray-200 dark:border-gray-700 mb-8 animate-in slide-in-from-right duration-300" key={currentQ.id}>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{currentQ.question}</h3>
                {currentQ.type === 'multiple' && (
                    <div className="space-y-3">
                        {currentQ.options.map((option) => (
                            <button key={option} onClick={() => handleAnswer(option)} className={`w-full text-left p-4 rounded-xl border-2 transition-all font-medium ${userAnswers[currentQ.id] === option ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-gray-600'}`}>{option}</button>
                        ))}
                    </div>
                )}
                {currentQ.type === 'checkbox' && (
                    <div className="space-y-3">
                        {currentQ.options.map((option) => {
                            const isSelected = (userAnswers[currentQ.id] || []).includes(option);
                            return (
                                <button key={option} onClick={() => handleAnswer(option)} className={`w-full text-left p-4 rounded-xl border-2 transition-all font-medium flex items-center gap-3 ${isSelected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'border-gray-100 dark:border-gray-700 hover:border-blue-200'}`}>
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center ${isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300'}`}>{isSelected && <CheckCircle className="w-3 h-3" />}</div>
                                    {option}
                                </button>
                            );
                        })}
                    </div>
                )}
                {currentQ.type === 'text' && (
                    <input type="text" value={userAnswers[currentQ.id] || ''} onChange={(e) => handleAnswer(e.target.value)} placeholder="Type your answer here..." className="w-full p-4 text-lg border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none bg-transparent dark:text-white" />
                )}
            </div>
            <div className="flex justify-end">
                <button onClick={nextQuestion} disabled={!userAnswers[currentQ.id] || (Array.isArray(userAnswers[currentQ.id]) && userAnswers[currentQ.id].length === 0)} className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                    {currentIndex === questions.length - 1 ? 'Finish Quiz' : 'Next Question'}
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};

// --- MASTERY LEVEL HELPER ---
const getMasteryLevel = (progress) => {
    if (progress === 0) return { label: 'Not Started', color: 'bg-gray-100 text-gray-400', barColor: 'bg-gray-200' };
    if (progress < 30) return { label: 'Beginner', color: 'bg-blue-50 text-blue-600', barColor: 'bg-blue-300' };
    if (progress < 60) return { label: 'Learning', color: 'bg-blue-100 text-blue-700', barColor: 'bg-blue-400' };
    if (progress < 85) return { label: 'Proficient', color: 'bg-indigo-100 text-indigo-700', barColor: 'bg-indigo-500' };
    return { label: 'Mastered', color: 'bg-green-100 text-green-700', barColor: 'bg-green-500' };
};

// --- MODULE CARD COMPONENT ---
const ModuleCard = ({ module, progress, isLocked, onClick }) => {
    const mastery = getMasteryLevel(progress);
    const isCompleted = progress >= 85;
    const chapterCount = module.chapters?.length || 0;
    
    // Determine module icon based on title
    let Icon = BookOpen;
    if (module.title.includes("Foundations")) Icon = TrendingUp;
    if (module.title.includes("Analysis")) Icon = Search;
    if (module.title.includes("Options")) Icon = Activity;
    if (module.title.includes("Risk")) Icon = ShieldAlert;

    return (
        <div 
            onClick={onClick}
            className={`relative bg-white dark:bg-gray-800 rounded-xl border p-5 transition-all duration-300 h-full flex flex-col
                ${isLocked 
                    ? 'border-gray-100 dark:border-gray-700 opacity-60 cursor-not-allowed' 
                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md hover:-translate-y-1 cursor-pointer'
                }`
            }
        >
            {/* Lock indicator */}
            {isLocked && (
                <div className="absolute top-3 right-3">
                    <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                </div>
            )}

            {/* Completed checkmark */}
            {isCompleted && !isLocked && (
                <div className="absolute top-3 right-3">
                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                </div>
            )}

            {/* Module header */}
            <div className="flex items-start gap-3 mb-4">
                <div className={`p-2.5 rounded-lg ${isLocked ? 'bg-gray-100 text-gray-400' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'}`}>
                    <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1 pr-8">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Module {module.id.replace('m', '')}</span>
                    <h3 className={`font-bold text-lg ${isLocked ? 'text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                        {module.title.replace('Module ' + module.id.replace('m', '') + ': ', '')}
                    </h3>
                </div>
            </div>

            {/* Description */}
            <p className={`text-sm mb-4 flex-grow ${isLocked ? 'text-gray-300' : 'text-gray-600 dark:text-gray-300'}`}>
                {module.description}
            </p>

            {/* Progress bar */}
            <div className="mt-auto">
                <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className={`font-medium ${isLocked ? 'text-gray-300' : 'text-gray-500'}`}>{mastery.label}</span>
                    <span className="text-gray-400">{progress}%</span>
                </div>
                <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div 
                        className={`h-full transition-all duration-500 ${mastery.barColor}`}
                        style={{ width: `${progress}%` }}
                    />
                </div>
                
                {/* Meta info */}
                <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
                    <span>{chapterCount} chapters</span>
                    {isLocked ? (
                        <span>Complete previous module</span>
                    ) : (
                        <span className="text-blue-600 dark:text-blue-400 font-medium">
                            {isCompleted ? 'Review' : progress > 0 ? 'Continue' : 'Start'}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- INFO CARD COMPONENT (For detailed chapter view) ---
const InfoCard = ({ item }) => {
    let Icon = Activity;
    if (item.title.includes("Market")) Icon = TrendingUp;
    if (item.title.includes("Fundamental")) Icon = Search;
    if (item.title.includes("Risk")) Icon = ShieldAlert;
    if (item.title.includes("Mechanics")) Icon = Layers;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 h-full hover:shadow-md transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100 dark:border-gray-700">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
                    <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{item.title}</h3>
            </div>

            <div className="space-y-4">
                {item.content.map((el, index) => {
                    switch (el.type) {
                        case 'paragraph':
                            return <p key={index} className="text-gray-600 dark:text-gray-300 leading-relaxed text-sm">{el.text}</p>;
                        case 'heading':
                            return <h4 key={index} className="text-md font-bold text-gray-800 dark:text-gray-200 mt-2 uppercase tracking-wide">{el.text}</h4>;
                        case 'list':
                            return (
                                <ul key={index} className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-300 text-sm pl-2">
                                    {el.items.map((li, i) => (
                                        <li key={i}>
                                            {li.split(':').length > 1 ? (
                                                <>
                                                    <span className="font-semibold text-gray-800 dark:text-gray-200">{li.split(':')[0]}:</span>
                                                    {li.split(':').slice(1).join(':')}
                                                </>
                                            ) : li}
                                        </li>
                                    ))}
                                </ul>
                            );
                        case 'note':
                            return (
                                <div key={index} className="text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg mt-2 border border-blue-100 dark:border-blue-800 flex items-start gap-2">
                                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                                    {el.text}
                                </div>
                            );
                        default:
                            return null;
                    }
                })}
            </div>
        </div>
    );
};

// --- MAIN PAGE COMPONENT ---
const GettingStartedPage = () => {
    const [activeTab, setActiveTab] = useState('learn');
    const [selectedModule, setSelectedModule] = useState(null);
    
    // Mock progress data - in a real app, this would come from a backend or localStorage
    const [moduleProgress] = useState({
        'm1': 100, // Completed
        'm2': 65,  // In progress
        'm3': 0,   // Not started
        'm4': 0    // Locked
    });

    // Calculate stats
    const totalModules = learningModules.length;
    const completedModules = Object.values(moduleProgress).filter(p => p >= 85).length;
    const inProgressModules = Object.values(moduleProgress).filter(p => p > 0 && p < 85).length;

    // Check if module is locked (previous must be at least 50% complete)
    const isModuleLocked = (moduleId) => {
        const moduleIndex = learningModules.findIndex(m => m.id === moduleId);
        if (moduleIndex === 0) return false;
        const prevModuleId = learningModules[moduleIndex - 1].id;
        return moduleProgress[prevModuleId] < 50;
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl animate-in fade-in duration-500">
            <div className="text-center mb-10">
                <h1 className="text-4xl font-black text-gray-900 dark:text-white mb-2">Learning Center</h1>
                <p className="text-gray-500 dark:text-gray-400">Master the markets with our comprehensive deep-dive modules.</p>
            </div>

            <div className="flex justify-center mb-12">
                <div className="bg-gray-100 dark:bg-gray-800 p-1.5 rounded-2xl flex gap-1">
                    <button onClick={() => {setActiveTab('learn'); setSelectedModule(null);}} className={`px-8 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'learn' ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
                        <BookOpen className="w-4 h-4" /> Modules
                    </button>
                    <button onClick={() => setActiveTab('quiz')} className={`px-8 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'quiz' ? 'bg-white dark:bg-gray-700 text-purple-600 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
                        <HelpCircle className="w-4 h-4" /> Market Quiz
                    </button>
                </div>
            </div>

            {activeTab === 'learn' ? (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {!selectedModule ? (
                        // Modules Grid View
                        <>
                            {/* Stats Header */}
                            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Course Modules</h2>
                                <div className="flex items-center gap-2">
                                    <div className="px-3 py-1.5 bg-green-100 dark:bg-green-900/30 rounded-lg">
                                        <span className="text-green-700 dark:text-green-400 font-semibold text-sm">{completedModules}</span>
                                        <span className="text-green-600 dark:text-green-500 text-xs ml-1">completed</span>
                                    </div>
                                    <div className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                        <span className="text-blue-700 dark:text-blue-400 font-semibold text-sm">{inProgressModules}</span>
                                        <span className="text-blue-600 dark:text-blue-500 text-xs ml-1">in progress</span>
                                    </div>
                                    <div className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                        <span className="text-gray-700 dark:text-gray-300 font-semibold text-sm">{totalModules - completedModules - inProgressModules}</span>
                                        <span className="text-gray-500 dark:text-gray-400 text-xs ml-1">to go</span>
                                    </div>
                                </div>
                            </div>

                            {/* Modules Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
                                {learningModules.map((module) => (
                                    <ModuleCard
                                        key={module.id}
                                        module={module}
                                        progress={moduleProgress[module.id] || 0}
                                        isLocked={isModuleLocked(module.id)}
                                        onClick={() => !isModuleLocked(module.id) && setSelectedModule(module)}
                                    />
                                ))}
                            </div>

                            {/* Help Section - How Learning Works */}
                            <div className="mt-12 border-t border-gray-200 dark:border-gray-700 pt-8">
                                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6">
                                    <div className="flex items-center gap-2 mb-5">
                                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                            <HelpCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <h3 className="font-bold text-gray-900 dark:text-white text-lg">How Learning Modules Work</h3>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                                                Module Structure
                                            </h4>
                                            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                                                Each module contains comprehensive chapters covering key concepts. Work through them sequentially to build your market knowledge from foundations to advanced strategies.
                                            </p>
                                        </div>

                                        <div>
                                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                                                Prerequisites & Progression
                                            </h4>
                                            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                                                Complete at least 50% of a module to unlock the next. Aim for 85% mastery to fully complete a module. Each chapter builds on previous knowledge.
                                            </p>
                                        </div>

                                        <div>
                                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                                                Mastery Levels
                                            </h4>
                                            <div className="flex flex-wrap gap-2 text-xs">
                                                <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-400 rounded">Not Started</span>
                                                <span className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded">Beginner</span>
                                                <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 rounded">Learning</span>
                                                <span className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 rounded">Proficient</span>
                                                <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 rounded">Mastered</span>
                                            </div>
                                        </div>

                                        <div>
                                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                                                Test Your Knowledge
                                            </h4>
                                            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                                                Use the <strong>Market Quiz</strong> tab to test your understanding with questions ranging from easy to hard. Perfect for reinforcing what you've learned.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-5 pt-4 border-t border-gray-200 dark:border-gray-700">
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            <strong>Pro Tip:</strong> Click on any unlocked module card to view detailed chapters. Review completed modules anytime to refresh your knowledge.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        // Module Detail View
                        <div className="animate-in fade-in slide-in-from-right duration-300">
                            <button 
                                onClick={() => setSelectedModule(null)}
                                className="mb-6 flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                                Back to Modules
                            </button>
                            
                            <div className="mb-6">
                                <h2 className="text-2xl font-black text-gray-900 dark:text-white">{selectedModule.title}</h2>
                                <p className="text-gray-500 dark:text-gray-400 mt-1">{selectedModule.description}</p>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {selectedModule.chapters.map((chapter, idx) => (
                                    <InfoCard key={idx} item={chapter} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                    <QuizSection />
                </div>
            )}
        </div>
    );
};

export default GettingStartedPage;