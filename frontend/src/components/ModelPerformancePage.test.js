import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ModelPerformancePage from './ModelPerformancePage';
import { API_ENDPOINTS, apiRequest } from '../config/api';

jest.mock('./charts/ActualVsPredictedChart', () => () => <div data-testid="actual-vs-predicted-chart" />);

jest.mock('../config/api', () => ({
    API_ENDPOINTS: {
        EVALUATE: jest.fn((ticker, params) => `/evaluate/${ticker}?${new URLSearchParams(params).toString()}`),
    },
    apiRequest: jest.fn(),
}));

const evaluationPayload = {
    ticker: 'AAPL',
    featureSpecVersion: 'prediction-stack-v2',
    test_period: {
        start_date: '2026-01-02',
        end_date: '2026-03-27',
        days: 60,
    },
    dates: ['2026-01-02', '2026-01-05'],
    actuals: [100.0, 101.0],
    models: {
        ensemble: {
            predictions: [100.4, 101.2],
            metrics: { mae: 1.1, rmse: 1.3, mape: 1.2, r_squared: 0.81, directional_accuracy: 50.0 },
        },
        linear_regression: {
            predictions: [100.3, 101.4],
            metrics: { mae: 1.0, rmse: 1.2, mape: 1.1, r_squared: 0.84, directional_accuracy: 50.0 },
            explainability: {
                global_top_features: [{ feature: 'lag1', meanAbsImpact: 1.42 }],
                latest_prediction_contributors: [{ feature: 'lag1', value: 100.0, impact: 0.71 }],
            },
        },
        auto_arima: {
            predictions: [100.5, 101.0],
            metrics: { mae: 1.3, rmse: 1.5, mape: 1.4, r_squared: 0.78, directional_accuracy: 50.0 },
        },
    },
    evaluationOptions: { includeExplanations: true },
    returns: {
        initial_capital: 10000,
        final_value: 10125,
        total_return: 1.25,
        buy_hold_return: 0.9,
        outperformance: 0.35,
        sharpe_ratio: 1.1,
        max_drawdown: -1.5,
        num_trades: 2,
    },
    best_model: 'linear_regression',
};

describe('ModelPerformancePage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        API_ENDPOINTS.EVALUATE.mockImplementation((ticker, params) => `/evaluate/${ticker}?${new URLSearchParams(params).toString()}`);
        apiRequest.mockResolvedValue(evaluationPayload);
    });

    test('requests deep evaluation with explainability enabled', async () => {
        render(<ModelPerformancePage />);

        fireEvent.change(screen.getByPlaceholderText(/enter stock ticker/i), {
            target: { value: 'AAPL' },
        });
        fireEvent.click(screen.getByRole('checkbox'));
        fireEvent.click(screen.getByRole('button', { name: 'Evaluate' }));

        await waitFor(() => {
            expect(API_ENDPOINTS.EVALUATE).toHaveBeenCalledWith(
                'AAPL',
                expect.objectContaining({
                    fast_mode: false,
                    include_explanations: true,
                    include_selective: true,
                })
            );
        });
        expect(apiRequest).toHaveBeenCalled();
        expect(await screen.findByText('Feature Spec')).toBeInTheDocument();
        expect(screen.getByText('prediction-stack-v2')).toBeInTheDocument();
    });

    test('renders explainability for supported models and fallback for unsupported ones', async () => {
        render(<ModelPerformancePage />);

        fireEvent.change(screen.getByPlaceholderText(/enter stock ticker/i), {
            target: { value: 'AAPL' },
        });
        fireEvent.click(screen.getByRole('checkbox'));
        fireEvent.click(screen.getByRole('button', { name: 'Evaluate' }));

        await screen.findByText('Model Comparison');

        fireEvent.click(screen.getByRole('button', { name: /Linear Regression/i }));
        expect(screen.getByText('Explainability')).toBeInTheDocument();
        expect(screen.getByText('Global Top Features')).toBeInTheDocument();
        expect(screen.getAllByText('lag1').length).toBeGreaterThan(0);

        fireEvent.click(screen.getByRole('button', { name: /AutoARIMA/i }));
        expect(screen.getByText(/SHAP explanations are unavailable for this model/i)).toBeInTheDocument();
    });
});
