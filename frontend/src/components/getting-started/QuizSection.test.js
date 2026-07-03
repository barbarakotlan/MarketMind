import { fireEvent, render, screen } from '@testing-library/react';
import QuizSection from './QuizSection';

describe('QuizSection', () => {
    test('opens on the difficulty picker', () => {
        render(<QuizSection />);
        expect(screen.getByText('Test Your Market Knowledge')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /easy/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /medium/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /hard/i })).toBeInTheDocument();
    });

    test('starting a quiz shows the first question with the advance button disabled', () => {
        render(<QuizSection />);
        fireEvent.click(screen.getByRole('button', { name: /easy/i }));

        expect(screen.getByText(/Question 1 of/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Next Question|Finish Quiz/i })).toBeDisabled();
    });
});
