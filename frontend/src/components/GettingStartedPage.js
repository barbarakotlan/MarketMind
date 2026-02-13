import React, { useState } from 'react';
import {
  BookOpen,
  HelpCircle,
  Award,
  TrendingUp,
  ShieldAlert,
  Activity,
  Search,
  DollarSign,
  CheckCircle,
  RefreshCw,
  ChevronRight,
  Brain,
  Layers // Icon for Modules
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

// --- INFO CARD COMPONENT ---
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

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl animate-in fade-in duration-500">
            <div className="text-center mb-10">
                <h1 className="text-4xl font-black text-gray-900 dark:text-white mb-2">Learning Center</h1>
                <p className="text-gray-500 dark:text-gray-400">Master the markets with our comprehensive deep-dive modules.</p>
            </div>

            <div className="flex justify-center mb-12">
                <div className="bg-gray-100 dark:bg-gray-800 p-1.5 rounded-2xl flex gap-1">
                    <button onClick={() => setActiveTab('learn')} className={`px-8 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'learn' ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
                        <BookOpen className="w-4 h-4" /> Modules
                    </button>
                    <button onClick={() => setActiveTab('quiz')} className={`px-8 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'quiz' ? 'bg-white dark:bg-gray-700 text-purple-600 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
                        <HelpCircle className="w-4 h-4" /> Market Quiz
                    </button>
                </div>
            </div>

            {activeTab === 'learn' ? (
                <div className="space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {learningModules.map((module) => (
                        <div key={module.id} className="border-b border-gray-100 dark:border-gray-800 pb-12 last:border-0 last:pb-0">
                            <div className="mb-6">
                                <h2 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                                    <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold shadow-sm">
                                        {module.id.toUpperCase()}
                                    </div>
                                    {module.title}
                                </h2>
                                <p className="text-gray-500 dark:text-gray-400 ml-12 mt-1 max-w-2xl">{module.description}</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 ml-0 md:ml-12">
                                {module.chapters.map((chapter, idx) => (
                                    <InfoCard key={idx} item={chapter} />
                                ))}
                            </div>
                        </div>
                    ))}
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