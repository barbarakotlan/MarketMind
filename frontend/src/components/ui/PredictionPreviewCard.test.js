import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import PredictionPreviewCard from './PredictionPreviewCard';

describe('PredictionPreviewCard', () => {
    test('renders the updated 7-session CTA', () => {
        const onViewFullPredictions = jest.fn();
        render(
            <PredictionPreviewCard
                predictionData={{
                    predictions: [
                        { date: '2026-04-03', predictedClose: 101.5 },
                        { date: '2026-04-06', predictedClose: 102.2 },
                        { date: '2026-04-07', predictedClose: 102.9 },
                    ],
                }}
                onViewFullPredictions={onViewFullPredictions}
            />
        );

        expect(screen.getByText('Next 3 trading sessions')).toBeInTheDocument();
        expect(screen.getByText('See Full 7-Session Forecast')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /See Full 7-Session Forecast/i }));
        expect(onViewFullPredictions).toHaveBeenCalledTimes(1);
    });
});
