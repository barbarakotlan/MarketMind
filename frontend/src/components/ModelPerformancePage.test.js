import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ModelPerformancePage from './ModelPerformancePage';
import { API_ENDPOINTS, apiRequest } from '../config/api';

// --- MOCKING ---

// Mock the child chart component. We do this to isolate the ModelPerformancePage tests
// and avoid rendering heavy charting libraries (like Recharts or Chart.js) in our unit tests.
jest.mock('./charts/ActualVsPredictedChart', () => () => <div data-testid="actual-vs-predicted-chart" />);

// Mock the API configuration and network request function.
// This prevents the tests from making real HTTP requests, ensuring they run quickly and deterministically.
jest.mock('../config/api', () => ({
    API_ENDPOINTS: {
        // Mock the EVALUATE endpoint builder to return a predictable URL string with query params
        EVALUATE: jest.fn((ticker, params) => `/evaluate/${ticker}?${new URLSearchParams(params).toString()}`),
    },
    apiRequest: jest.fn(), // Creates a controlled mock function for the actual fetch call
}));

// --- MOCK DATA ---

// Define a robust mock payload that mimics the backend's response for a deep evaluation.
// This payload covers all UI states: KPIs, model metrics, trading returns, and SHAP explainability.
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
        // Base model without explainability
        ensemble: {
            predictions: [100.4, 101.2],
            metrics: { mae: 1.1, rmse: 1.3, mape: 1.2, r_squared: 0.81, directional_accuracy: 50.0 },
        },
        // Target model that supports SHAP explainability
        linear_regression: {
            predictions: [100.3, 101.4],
            metrics: { mae: 1.0, rmse: 1.2, mape: 1.1, r_squared: 0.84, directional_accuracy: 50.0 },
            explainability: {
                global_top_features: [{ feature: 'lag1', meanAbsImpact: 1.42 }],
                latest_prediction_contributors: [{ feature: 'lag1', value: 100.0, impact: 0.71 }],
            },
        },
        // Another baseline model
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
    // --- TEARDOWN & SETUP ---
    beforeEach(() => {
        jest.clearAllMocks(); // Clear mock history before each test to prevent test bleed
        // Reset the endpoint mock implementation
        API_ENDPOINTS.EVALUATE.mockImplementation((ticker, params) => `/evaluate/${ticker}?${new URLSearchParams(params).toString()}`);
        // Set the apiRequest to resolve successfully with our mock payload
        apiRequest.mockResolvedValue(evaluationPayload);
    });

    test('requests deep evaluation with explainability enabled', async () => {
        // 1. ARRANGE: Render the component
        render(<ModelPerformancePage />);

        // 2. ACT: Simulate user interactions
        // Type the ticker into the search input
        fireEvent.change(screen.getByPlaceholderText(/enter stock ticker/i), {
            target: { value: 'AAPL' },
        });
        
        // Click the "deep evaluation" checkbox to toggle the expensive compute parameters
        fireEvent.click(screen.getByRole('checkbox'));
        
        // Submit the form
        fireEvent.click(screen.getByRole('button', { name: 'Evaluate' }));

        // 3. ASSERT: Verify the API logic and UI updates
        // Wait for the async API request to be triggered and check its payload
        await waitFor(() => {
            expect(API_ENDPOINTS.EVALUATE).toHaveBeenCalledWith(
                'AAPL',
                expect.objectContaining({
                    fast_mode: false,             // Must be false for deep eval
                    include_explanations: true,   // Must request SHAP data
                    include_selective: true,
                })
            );
        });
        
        expect(apiRequest).toHaveBeenCalled();
        
        // Verify that the UI successfully parsed the response and rendered the spec version
        expect(await screen.findByText('Feature Spec')).toBeInTheDocument();
        expect(screen.getByText('prediction-stack-v2')).toBeInTheDocument();
    });

    test('renders explainability for supported models and fallback for unsupported ones', async () => {
        // 1. ARRANGE: Render and trigger the deep evaluation
        render(<ModelPerformancePage />);

        fireEvent.change(screen.getByPlaceholderText(/enter stock ticker/i), {
            target: { value: 'AAPL' },
        });
        fireEvent.click(screen.getByRole('checkbox'));
        fireEvent.click(screen.getByRole('button', { name: 'Evaluate' }));

        // Wait for the results to load by looking for a section header
        await screen.findByText('Model Comparison');

        // 2. ACT & ASSERT: Test Linear Regression (Supports SHAP)
        // Switch the active model tab to Linear Regression
        fireEvent.click(screen.getByRole('button', { name: /Linear Regression/i }));
        
        // Verify the explainability headers and specific data points from the payload are rendered
        expect(screen.getByText('Explainability')).toBeInTheDocument();
        expect(screen.getByText('Global Top Features')).toBeInTheDocument();
        expect(screen.getAllByText('lag1').length).toBeGreaterThan(0);

        // 3. ACT & ASSERT: Test AutoARIMA (Does not support SHAP)
        // Switch the active model tab to AutoARIMA
        fireEvent.click(screen.getByRole('button', { name: /AutoARIMA/i }));
        
        // Verify that the fallback warning message is displayed instead of throwing an error
        expect(screen.getByText(/SHAP explanations are unavailable for this model/i)).toBeInTheDocument();
    });
});
