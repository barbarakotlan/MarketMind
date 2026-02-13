import React from 'react';
import { gettingStartedContent } from '../data/content';
import { BookOpenIcon } from './Icons';

const InfoCard = ({ item }) => {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden transform hover:scale-105 transition-transform duration-300">
            <div className="p-8">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">{item.title}</h2>
                <div className="space-y-4">
                {item.content.map((el, index) => {
                    switch (el.type) {
                        case 'paragraph':
                            return <p key={index} className="text-gray-600 dark:text-gray-300 leading-relaxed">{el.text}</p>;
                        case 'heading':
                            return <h3 key={index} className="text-xl font-semibold text-gray-700 dark:text-gray-200 mt-4">{el.text}</h3>;
                        case 'list':
                            return (
                                <ul key={index} className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-300">
                                    {el.items.map((li, i) => <li key={i}>{li}</li>)}
                                </ul>
                            );
                        case 'note':
                            return <p key={index} className="text-sm text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 p-3 rounded-lg mt-4">{el.text}</p>
                        default:
                            return null;
                    }
                })}
                </div>
            </div>
        </div>
    );
};

const GettingStartedPage = () => {
    return (
        <div className="container mx-auto px-4 py-8">
            <div className="text-center mb-12">
                <BookOpenIcon />
                <h1 className="text-4xl font-extrabold text-gray-800 dark:text-white">Welcome to Investing!</h1>
                <p className="text-lg text-gray-500 dark:text-gray-400 mt-2">Your complete guide to understanding the market.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {gettingStartedContent.map((item, index) => (
                    <InfoCard key={index} item={item} />
                ))}
            </div>
        </div>
    );
};

export default GettingStartedPage;