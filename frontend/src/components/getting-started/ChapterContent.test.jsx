import { fireEvent, render, screen } from '@testing-library/react';
import ChapterContent from './ChapterContent';

const chapter = {
    estimatedMinutes: 10,
    content: [
        { type: 'paragraph', text: 'Hello paragraph' },
        { type: 'heading', text: 'Section Heading' },
        { type: 'list', items: ['first item', 'second item'] },
        { type: 'note', text: 'Important note' },
    ],
};

describe('ChapterContent', () => {
    test('renders each content block type and the read estimate', () => {
        render(<ChapterContent chapter={chapter} isCompleted={false} onToggleComplete={() => {}} />);
        expect(screen.getByText('Hello paragraph')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Section Heading' })).toBeInTheDocument();
        expect(screen.getByText('first item')).toBeInTheDocument();
        expect(screen.getByText('Important note')).toBeInTheDocument();
        expect(screen.getByText('10 min read')).toBeInTheDocument();
    });

    test('the complete button toggles completion', () => {
        const onToggleComplete = vi.fn();
        render(<ChapterContent chapter={chapter} isCompleted={false} onToggleComplete={onToggleComplete} />);
        fireEvent.click(screen.getByRole('button', { name: /Complete/ }));
        expect(onToggleComplete).toHaveBeenCalledTimes(1);
    });

    test('shows Done when the chapter is completed', () => {
        render(<ChapterContent chapter={chapter} isCompleted onToggleComplete={() => {}} />);
        expect(screen.getByRole('button', { name: /Done/ })).toBeInTheDocument();
    });
});
