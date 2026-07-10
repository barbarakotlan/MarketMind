import React from 'react';
import { render, screen } from '@testing-library/react';
import ModelComparisonCard from './ModelComparisonCard';

describe('ModelComparisonCard', () => {
    test('renders statistical and ML model labels', () => {
        render(
            <ModelComparisonCard
                modelBreakdown={{
                    auto_arima: [101.1, 101.4, 101.8, 102.0, 102.2, 102.5, 102.8],
                    linear_regression: [101.0, 101.3, 101.7, 101.9, 102.1, 102.4, 102.7],
                    random_forest: [101.2, 101.5, 101.9, 102.1, 102.3, 102.7, 103.0],
                }}
                modelsUsed={['auto_arima', 'linear_regression', 'random_forest']}
                confidence={88.4}
            />
        );

        expect(screen.getByText('AutoARIMA')).toBeInTheDocument();
        expect(screen.getByText('Linear Regression')).toBeInTheDocument();
        expect(screen.getByText('Random Forest')).toBeInTheDocument();
        expect(screen.getByText(/statistical and ML models/i)).toBeInTheDocument();
        expect(screen.getAllByText('7 trading-session forecast')).toHaveLength(3);
    });
});
