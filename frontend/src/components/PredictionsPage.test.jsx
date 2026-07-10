import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PredictionsPage from './PredictionsPage';
import { NavigationProvider } from '../context/NavigationContext';
import { API_ENDPOINTS, apiRequest } from '../config/api';

vi.mock('./ui/StockPredictionCard', () => ({ default: () => <div data-testid="stock-prediction-card" /> }));
vi.mock('./charts/PredictionChart', () => ({ default: () => <div data-testid="prediction-chart" /> }));
vi.mock('./ui/ModelComparisonCard', () => ({ default: () => <div data-testid="model-comparison-card" /> }));

vi.mock('../config/api', () => ({
    API_ENDPOINTS: {
        PREDICT: vi.fn((model, ticker) => `/predict/${model}/${ticker}`),
        PREDICT_ENSEMBLE: vi.fn((ticker) => `/predict/ensemble/${ticker}`),
    },
    apiRequest: vi.fn(),
}));

describe('PredictionsPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        API_ENDPOINTS.PREDICT.mockImplementation((model, ticker) => `/predict/${model}/${ticker}`);
        API_ENDPOINTS.PREDICT_ENSEMBLE.mockImplementation((ticker) => `/predict/ensemble/${ticker}`);
        apiRequest.mockResolvedValue({
            recentDate: '2026-03-12',
            recentClose: 100,
            recentPredicted: 101,
            predictions: [],
        });
    });

    test('uses the ensemble endpoint by default', async () => {
        render(<NavigationProvider><PredictionsPage /></NavigationProvider>);

        expect(screen.getByText(/7 trading-session price predictions/i)).toBeInTheDocument();

        fireEvent.change(screen.getByPlaceholderText(/enter stock ticker/i), {
            target: { value: 'AAPL' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Predict' }));

        await waitFor(() => {
            expect(API_ENDPOINTS.PREDICT_ENSEMBLE).toHaveBeenCalledWith('AAPL');
        });
        expect(apiRequest).toHaveBeenCalled();
        expect(apiRequest.mock.calls[0][0]).toBe('/predict/ensemble/AAPL');
    });

    test('uses a valid default model in single-model mode', async () => {
        render(<NavigationProvider><PredictionsPage /></NavigationProvider>);

        fireEvent.change(screen.getByPlaceholderText(/enter stock ticker/i), {
            target: { value: 'AAPL' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Single Model' }));
        fireEvent.click(screen.getByRole('button', { name: 'Predict' }));

        await waitFor(() => {
            expect(API_ENDPOINTS.PREDICT).toHaveBeenCalledWith('LinReg', 'AAPL');
        });
        expect(apiRequest).toHaveBeenCalled();
        expect(apiRequest.mock.calls[0][0]).toBe('/predict/LinReg/AAPL');
    });

    test('uses the selected single model', async () => {
        render(<NavigationProvider><PredictionsPage /></NavigationProvider>);

        fireEvent.change(screen.getByPlaceholderText(/enter stock ticker/i), {
            target: { value: 'AAPL' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Single Model' }));
        fireEvent.click(screen.getByRole('button', { name: 'Random Forest' }));
        fireEvent.click(screen.getByRole('button', { name: 'Predict' }));

        await waitFor(() => {
            expect(API_ENDPOINTS.PREDICT).toHaveBeenCalledWith('RandomForest', 'AAPL');
        });
        expect(apiRequest).toHaveBeenCalled();
        expect(apiRequest.mock.calls[0][0]).toBe('/predict/RandomForest/AAPL');
    });
});
