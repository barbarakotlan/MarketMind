'use client';

import React, { useState, useEffect } from 'react';
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
    Layers,
    ChevronLeft,
    Clock,
    Target,
    BarChart3,
    CheckSquare,
    Square,
    Lock,
    Play,
    RotateCcw
} from 'lucide-react';
import { learningModules, QUESTION_BANK, getTotalChapters, getEstimatedCourseTime } from '../data/content';

// --- MASTERY LEVEL HELPER ---
const getMasteryLevel = (progress) => {
    if (progress === 0) return { label: 'Not Started', color: 'bg-gray-100 text-gray-400', barColor: 'bg-gray-200' };
    if (progress < 30) return { label: 'Beginner', color: 'bg-blue-50 text-blue-600', barColor: 'bg-blue-300' };
    if (progress < 60) return { label: 'Learning', color: 'bg-blue-100 text-blue-700', barColor: 'bg-blue-400' };
    if (progress < 85) return { label: 'Proficient', color: 'bg-indigo-100 text-indigo-700', barColor: 'bg-indigo-500' };
    return { label: 'Mastered', color: 'bg-green-100 text-green-700', barColor: 'bg-green-500' };
};

// --- PROGRESS STORAGE UTILITIES ---
const STORAGE_KEY = 'marketmind_course_progress';

const loadProgress = () => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? JSON.parse(saved) : {};
    } catch {
        return {};
    };
};

const saveProgress = (progress) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch {
        // Silently fail if localStorage is unavailable
    }
};

// --- QUIZ COMPONENT ---
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

// --- CHAPTER CONTENT COMPONENT ---
const ChapterContent = ({ chapter, isCompleted, onToggleComplete }) => {
    return (
        <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
                <Clock className="w-4 h-4" />
                <span>{chapter.estimatedMinutes || 20} min read</span>
            </div>

            <div className="prose prose-lg max-w-none dark:prose-invert">
                {chapter.content.map((el, index) => {
                    switch (el.type) {
                        case 'paragraph':
                            return <p key={index} className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">{el.text}</p>;
                        case 'heading':
                            return <h3 key={index} className="text-xl font-bold text-gray-900 dark:text-white mt-8 mb-4 flex items-center gap-2">{el.text}</h3>;
                        case 'list':
                            return (
                                <ul key={index} className="list-disc list-outside space-y-2 text-gray-700 dark:text-gray-300 ml-5 mb-6">
                                    {el.items.map((li, i) => (
                                        <li key={i} className="leading-relaxed">
                                            {li.split(':').length > 1 ? (
                                                <>
                                                    <span className="font-semibold text-gray-900 dark:text-gray-100">{li.split(':')[0]}:</span>
                                                    {li.split(':').slice(1).join(':')}
                                                </>
                                            ) : li}
                                        </li>
                                    ))}
                                </ul>
                            );
                        case 'note':
                            return (
                                <div key={index} className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-400 p-4 my-6 rounded-r-lg">
                                    <div className="flex items-start gap-3">
                                        <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                        <p className="text-sm text-amber-800 dark:text-amber-200">{el.text}</p>
                                    </div>
                                </div>
                            );
                        default:
                            return null;
                    }
                })}
            </div>

            {/* Completion Checkbox */}
            <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
                <button
                    onClick={onToggleComplete}
                    className={`flex items-center gap-3 px-6 py-4 rounded-xl border-2 transition-all ${
                        isCompleted 
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-500 text-green-700 dark:text-green-400' 
                            : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-blue-400'
                    }`}
                >
                    {isCompleted ? <CheckSquare className="w-6 h-6" /> : <Square className="w-6 h-6" />}
                    <span className="font-semibold">
                        {isCompleted ? 'Chapter Completed' : 'Mark as Complete'}
                    </span>
                </button>
            </div>
        </div>
    );
};

// --- MAIN PAGE COMPONENT ---
const GettingStartedPage = () => {
    const [activeTab, setActiveTab] = useState('learn');
    const [selectedModule, setSelectedModule] = useState(null);
    const [selectedChapter, setSelectedChapter] = useState(null);
    const [progress, setProgress] = useState({});

    // Load progress on mount
    useEffect(() => {
        setProgress(loadProgress());
    }, []);

    // Save progress when it changes
    useEffect(() => {
        if (Object.keys(progress).length > 0) {
            saveProgress(progress);
        }
    }, [progress]);

    // Calculate stats
    const totalChapters = getTotalChapters();
    const completedChapters = Object.values(progress).filter(Boolean).length;
    const courseProgress = Math.round((completedChapters / totalChapters) * 100);
    const estimatedCourseTime = getEstimatedCourseTime();

    // Check if module is unlocked
    const isModuleUnlocked = (moduleIndex) => {
        if (moduleIndex === 0) return true;
        const prevModule = learningModules[moduleIndex - 1];
        const prevModuleChapters = prevModule.chapters;
        const completedInPrev = prevModuleChapters.filter(ch => progress[ch.id]).length;
        return completedInPrev >= Math.ceil(prevModuleChapters.length * 0.5);
    };

    // Toggle chapter completion
    const toggleChapterComplete = (chapterId) => {
        setProgress(prev => ({
            ...prev,
            [chapterId]: !prev[chapterId]
        }));
    };

    // Calculate module progress
    const getModuleProgress = (module) => {
        const completed = module.chapters.filter(ch => progress[ch.id]).length;
        return Math.round((completed / module.chapters.length) * 100);
    };

    // Navigate to chapter
    const navigateToChapter = (module, chapter) => {
        setSelectedModule(module);
        setSelectedChapter(chapter);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Navigate back to modules
    const backToModules = () => {
        setSelectedModule(null);
        setSelectedChapter(null);
    };

    // Navigate back to module overview
    const backToModuleOverview = () => {
        setSelectedChapter(null);
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl animate-in fade-in duration-500">
            {/* Header */}
            <div className="text-center mb-10">
                <h1 className="text-4xl font-black text-gray-900 dark:text-white mb-2">Learning Center</h1>
                <p className="text-gray-500 dark:text-gray-400">
                    Master financial markets through our comprehensive {totalChapters}-chapter course.
                </p>
            </div>

            {/* Navigation Tabs */}
            <div className="flex justify-center mb-12">
                <div className="bg-gray-100 dark:bg-gray-800 p-1.5 rounded-2xl flex gap-1">
                    <button 
                        onClick={() => {setActiveTab('learn'); backToModules();}} 
                        className={`px-8 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'learn' ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                    >
                        <BookOpen className="w-4 h-4" /> Course
                    </button>
                    <button 
                        onClick={() => setActiveTab('quiz')} 
                        className={`px-8 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'quiz' ? 'bg-white dark:bg-gray-700 text-purple-600 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                    >
                        <HelpCircle className="w-4 h-4" /> Quiz
                    </button>
                </div>
            </div>

            {activeTab === 'learn' ? (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {!selectedModule ? (
                        // Course Overview - All Modules
                        <>
                            {/* Course Stats */}
                            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 mb-8 text-white">
                                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center">
                                            <BarChart3 className="w-8 h-8" />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-bold">Your Progress</h2>
                                            <p className="text-blue-100">{completedChapters} of {totalChapters} chapters completed</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="text-center">
                                            <div className="text-3xl font-bold">{courseProgress}%</div>
                                            <div className="text-xs text-blue-200 uppercase tracking-wider">Complete</div>
                                        </div>
                                        <div className="w-32 h-3 bg-black/20 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-white rounded-full transition-all duration-500"
                                                style={{ width: `${courseProgress}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Modules Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
                                {learningModules.map((module, index) => {
                                    const moduleProgress = getModuleProgress(module);
                                    const unlocked = isModuleUnlocked(index);
                                    const mastery = getMasteryLevel(moduleProgress);

                                    return (
                                        <div
                                            key={module.id}
                                            onClick={() => unlocked && setSelectedModule(module)}
                                            className={`relative bg-white dark:bg-gray-800 rounded-xl border-2 p-6 transition-all duration-300 h-full flex flex-col
                                                ${!unlocked 
                                                    ? 'border-gray-100 dark:border-gray-700 opacity-60 cursor-not-allowed' 
                                                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-lg cursor-pointer'
                                                }`}
                                        >
                                            {/* Lock/Status Indicator */}
                                            <div className="absolute top-4 right-4">
                                                {!unlocked ? (
                                                    <Lock className="w-5 h-5 text-gray-300" />
                                                ) : moduleProgress === 100 ? (
                                                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                                                        <CheckCircle className="w-4 h-4 text-white" />
                                                    </div>
                                                ) : moduleProgress > 0 ? (
                                                    <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                                                        <Play className="w-3 h-3 text-white ml-0.5" />
                                                    </div>
                                                ) : null}
                                            </div>

                                            {/* Module Header */}
                                            <div className="flex items-start gap-4 mb-4">
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold
                                                    ${!unlocked 
                                                        ? 'bg-gray-100 text-gray-400' 
                                                        : 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                                                    }`}
                                                >
                                                    {index + 1}
                                                </div>
                                                <div className="flex-1 pr-8">
                                                    <h3 className={`font-bold text-lg ${!unlocked ? 'text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                                                        {module.title.replace(`Module ${index + 1}: `, '')}
                                                    </h3>
                                                    <p className={`text-sm mt-1 ${!unlocked ? 'text-gray-300' : 'text-gray-500 dark:text-gray-400'}`}>
                                                        {module.chapters.length} chapters • {module.estimatedMinutes} min
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Description */}
                                            <p className={`text-sm mb-5 flex-grow ${!unlocked ? 'text-gray-300' : 'text-gray-600 dark:text-gray-300'}`}>
                                                {module.description}
                                            </p>

                                            {/* Progress Bar */}
                                            <div>
                                                <div className="flex items-center justify-between text-xs mb-2">
                                                    <span className={`font-medium ${mastery.color} px-2 py-0.5 rounded`}>
                                                        {mastery.label}
                                                    </span>
                                                    <span className="text-gray-400">{moduleProgress}%</span>
                                                </div>
                                                <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                                    <div 
                                                        className={`h-full transition-all duration-500 ${mastery.barColor}`}
                                                        style={{ width: `${moduleProgress}%` }}
                                                    />
                                                </div>
                                                {!unlocked && (
                                                    <p className="text-xs text-gray-400 mt-2">
                                                        Complete 50% of Module {index} to unlock
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* How It Works */}
                            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                                <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-4 flex items-center gap-2">
                                    <Target className="w-5 h-5 text-blue-600" />
                                    How This Course Works
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div>
                                        <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">1. Progress at Your Pace</h4>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                            Each module contains {Math.round(totalChapters / learningModules.length)} chapters. 
                                            Read through the content and mark chapters as complete to track your progress.
                                        </p>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">2. Unlock New Modules</h4>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                            Complete at least 50% of a module to unlock the next. This ensures you build 
                                            knowledge sequentially.
                                        </p>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">3. Test Your Knowledge</h4>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                            Use the Quiz tab to test your understanding with questions at easy, medium, 
                                            and hard difficulty levels.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : !selectedChapter ? (
                        // Module Detail View - Chapter List
                        <div className="animate-in fade-in slide-in-from-right duration-300">
                            {/* Back Button & Header */}
                            <button 
                                onClick={backToModules}
                                className="mb-4 flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                            >
                                <ChevronLeft className="w-4 h-4" />
                                Back to All Modules
                            </button>

                            <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-8 mb-8 text-white">
                                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                    <div>
                                        <h2 className="text-2xl font-bold mb-2">{selectedModule.title}</h2>
                                        <p className="text-gray-300">{selectedModule.description}</p>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm">
                                        <div className="flex items-center gap-2">
                                            <BookOpen className="w-4 h-4" />
                                            {selectedModule.chapters.length} chapters
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-4 h-4" />
                                            {selectedModule.estimatedMinutes} min
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Module Progress */}
                                <div className="mt-6 pt-6 border-t border-white/20">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm text-gray-300">Module Progress</span>
                                        <span className="text-sm font-semibold">{getModuleProgress(selectedModule)}%</span>
                                    </div>
                                    <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-blue-400 rounded-full transition-all duration-500"
                                            style={{ width: `${getModuleProgress(selectedModule)}%` }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Chapters List */}
                            <div className="space-y-3">
                                <h3 className="font-bold text-gray-900 dark:text-white mb-4">Chapters</h3>
                                {selectedModule.chapters.map((chapter, idx) => {
                                    const isCompleted = progress[chapter.id];
                                    return (
                                        <div
                                            key={chapter.id}
                                            onClick={() => navigateToChapter(selectedModule, chapter)}
                                            className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all
                                                ${isCompleted 
                                                    ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800 hover:border-green-300' 
                                                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-600'
                                                }`}
                                        >
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0
                                                ${isCompleted 
                                                    ? 'bg-green-500 text-white' 
                                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
                                                }`}
                                            >
                                                {isCompleted ? <CheckCircle className="w-5 h-5" /> : <span className="font-semibold">{idx + 1}</span>}
                                            </div>
                                            <div className="flex-grow">
                                                <h4 className={`font-semibold ${isCompleted ? 'text-green-900 dark:text-green-100' : 'text-gray-900 dark:text-white'}`}>
                                                    {chapter.title}
                                                </h4>
                                                <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {chapter.estimatedMinutes || 20} min read
                                                </p>
                                            </div>
                                            <ChevronRight className={`w-5 h-5 ${isCompleted ? 'text-green-500' : 'text-gray-400'}`} />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        // Individual Chapter Reading View
                        <div className="animate-in fade-in slide-in-from-right duration-300">
                            {/* Navigation */}
                            <div className="flex items-center justify-between mb-6">
                                <button 
                                    onClick={backToModuleOverview}
                                    className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                    Back to {selectedModule.title.replace(/Module \d+: /, '')}
                                </button>
                                
                                {/* Chapter Navigation */}
                                <div className="flex items-center gap-2">
                                    {selectedModule.chapters.map((ch, idx) => (
                                        <button
                                            key={ch.id}
                                            onClick={() => navigateToChapter(selectedModule, ch)}
                                            className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors
                                                ${ch.id === selectedChapter.id 
                                                    ? 'bg-blue-600 text-white' 
                                                    : progress[ch.id]
                                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                        : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200'
                                                }`}
                                        >
                                            {idx + 1}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Chapter Header */}
                            <div className="mb-8">
                                <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                                    {selectedModule.title.replace(/Module \d+: /, '')}
                                </span>
                                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                                    {selectedChapter.title}
                                </h1>
                            </div>

                            {/* Chapter Content */}
                            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm border border-gray-200 dark:border-gray-700">
                                <ChapterContent 
                                    chapter={selectedChapter}
                                    isCompleted={progress[selectedChapter.id]}
                                    onToggleComplete={() => toggleChapterComplete(selectedChapter.id)}
                                />
                            </div>

                            {/* Chapter Navigation Footer */}
                            <div className="flex items-center justify-between mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
                                {(() => {
                                    const currentIdx = selectedModule.chapters.findIndex(ch => ch.id === selectedChapter.id);
                                    const prevChapter = currentIdx > 0 ? selectedModule.chapters[currentIdx - 1] : null;
                                    const nextChapter = currentIdx < selectedModule.chapters.length - 1 ? selectedModule.chapters[currentIdx + 1] : null;
                                    
                                    return (
                                        <>
                                            {prevChapter ? (
                                                <button
                                                    onClick={() => navigateToChapter(selectedModule, prevChapter)}
                                                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                                >
                                                    <ChevronLeft className="w-4 h-4" />
                                                    Previous
                                                </button>
                                            ) : <div />}
                                            
                                            {nextChapter ? (
                                                <button
                                                    onClick={() => navigateToChapter(selectedModule, nextChapter)}
                                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                                                >
                                                    Next Chapter
                                                    <ChevronRight className="w-4 h-4" />
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={backToModules}
                                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
                                                >
                                                    Complete Module
                                                    <CheckCircle className="w-4 h-4" />
                                                </button>
                                            )}
                                        </>
                                    );
                                })()}
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
