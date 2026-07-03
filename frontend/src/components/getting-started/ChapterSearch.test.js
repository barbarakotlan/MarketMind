import { fireEvent, render, screen } from '@testing-library/react';
import { learningModules } from '../../data/content';
import ChapterSearch from './ChapterSearch';

describe('ChapterSearch', () => {
    test('shows the empty prompt before typing', () => {
        render(<ChapterSearch onSelectResult={jest.fn()} onClose={jest.fn()} />);
        expect(screen.getByText(/Type to search across all/i)).toBeInTheDocument();
    });

    test('matches a chapter by title and selects it', () => {
        const onSelectResult = jest.fn();
        const onClose = jest.fn();
        render(<ChapterSearch onSelectResult={onSelectResult} onClose={onClose} />);

        const module = learningModules[0];
        const chapter = module.chapters[0];
        fireEvent.change(screen.getByPlaceholderText(/Search chapters/i), {
            target: { value: chapter.title },
        });

        const heading = screen.getByRole('heading', { name: chapter.title });
        fireEvent.click(heading.closest('button'));

        expect(onSelectResult).toHaveBeenCalledWith(module, chapter);
        expect(onClose).toHaveBeenCalled();
    });

    test('shows a no-results message for an unmatched query', () => {
        render(<ChapterSearch onSelectResult={jest.fn()} onClose={jest.fn()} />);
        fireEvent.change(screen.getByPlaceholderText(/Search chapters/i), {
            target: { value: 'zzz-nonexistent-query-xyz' },
        });
        expect(screen.getByText(/No results found/i)).toBeInTheDocument();
    });
});
