import React, { useState } from 'react';
import { Award, ShieldAlert, Activity, CheckCircle, RefreshCw, ChevronRight, Brain } from 'lucide-react';
import { QUESTION_BANK } from '../../data/content';

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
                <h2 className="mb-4 text-3xl font-semibold text-mm-text-primary">Test Your Market Knowledge</h2>
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
                <h2 className="mb-2 text-4xl font-semibold text-mm-text-primary">Quiz Complete</h2>
                <p className="text-xl text-gray-600 dark:text-gray-300 mb-6">{message}</p>
                <div className="ui-panel-elevated mb-8 w-full max-w-md p-8">
                    <div className="mb-2 text-6xl font-semibold text-mm-accent-primary">{score}/{questions.length}</div>
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
            <div className="ui-panel-elevated mb-8 p-8 animate-in slide-in-from-right duration-300" key={currentQ.id}>
                <h3 className="mb-6 text-2xl font-semibold text-mm-text-primary">{currentQ.question}</h3>
                
                {/* --- Multiple Choice Fix --- */}
                {currentQ.type === 'multiple' && (
                    <div className="space-y-3">
                        {currentQ.options.map((option) => (
                            <button 
                                key={option} 
                                onClick={() => handleAnswer(option)} 
                                className={`w-full text-left p-4 rounded-xl border-2 transition-all font-medium ${
                                    userAnswers[currentQ.id] === option 
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' 
                                        : 'border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-gray-600 text-gray-900 dark:text-gray-200'
                                }`}
                            >
                                {option}
                            </button>
                        ))}
                    </div>
                )}
                
                {/* --- Checkbox Fix --- */}
                {currentQ.type === 'checkbox' && (
                    <div className="space-y-3">
                        {currentQ.options.map((option) => {
                            const isSelected = (userAnswers[currentQ.id] || []).includes(option);
                            return (
                                <button 
                                    key={option} 
                                    onClick={() => handleAnswer(option)} 
                                    className={`w-full text-left p-4 rounded-xl border-2 transition-all font-medium flex items-center gap-3 ${
                                        isSelected 
                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' 
                                            : 'border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-gray-600 text-gray-900 dark:text-gray-200'
                                    }`}
                                >
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center ${isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300 dark:border-gray-600'}`}>
                                        {isSelected && <CheckCircle className="w-3 h-3" />}
                                    </div>
                                    {option}
                                </button>
                            );
                        })}
                    </div>
                )}
                
                {currentQ.type === 'text' && (
                    <input type="text" value={userAnswers[currentQ.id] || ''} onChange={(e) => handleAnswer(e.target.value)} placeholder="Type your answer here..." className="ui-input p-4 text-lg bg-transparent placeholder:text-mm-text-tertiary" />
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

export default QuizSection;
