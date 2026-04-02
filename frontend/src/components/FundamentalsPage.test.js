import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import FundamentalsPage from './FundamentalsPage';
import { API_ENDPOINTS, apiRequest } from '../config/api';

jest.mock('../config/api', () => ({
    API_ENDPOINTS: {
        FUNDAMENTALS: jest.fn((ticker) => `/fundamentals/${ticker}`),
        FUNDAMENTALS_FINANCIALS: jest.fn((ticker) => `/fundamentals/financials/${ticker}`),
        FUNDAMENTALS_FILINGS: jest.fn((ticker) => `/fundamentals/filings/${ticker}`),
        FUNDAMENTALS_SEC_INTELLIGENCE: jest.fn((ticker) => `/fundamentals/sec-intelligence/${ticker}`),
        FUNDAMENTALS_FILING_DETAIL: jest.fn((ticker, accessionNumber) => `/fundamentals/filings/${ticker}/${accessionNumber}`),
    },
    apiRequest: jest.fn(),
}));

const fundamentalsPayload = {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    exchange: 'NASDAQ',
    currency: 'USD',
    sector: 'Technology',
    industry: 'Consumer Electronics',
    description: 'Apple designs consumer hardware and software products.',
    market_cap: 3000000000000,
    pe_ratio: 30.5,
    eps: 6.2,
    beta: 1.2,
};

const financialsPayload = {
    income_statement: [],
    balance_sheet: [],
    cash_flow: [],
};

const filingsPayload = [
    {
        date: '2026-01-31',
        type: '10-K',
        description: 'Annual report',
        url: 'https://www.sec.gov/example-10k',
        accessionNumber: '0000320193-26-000123',
        hasKeySections: true,
        isAnnualOrQuarterly: true,
    },
    {
        date: '2026-02-10',
        type: '8-K',
        description: 'Current report',
        url: 'https://www.sec.gov/example-8k',
        accessionNumber: '0000320193-26-000124',
        hasKeySections: false,
        isAnnualOrQuarterly: false,
    },
];

const filingDetailPayload = {
    accessionNumber: '0000320193-26-000123',
    type: '10-K',
    date: '2026-01-31',
    url: 'https://www.sec.gov/example-10k',
    hasKeySections: true,
    sections: [
        {
            key: 'business',
            title: 'Business',
            text: 'Apple designs devices and services for consumers and businesses.',
            truncated: false,
        },
        {
            key: 'riskFactors',
            title: 'Risk Factors',
            text: 'Supply chain disruption and regulation remain material risks.',
            truncated: true,
        },
    ],
};

const secIntelligencePayload = {
    latestAnnualOrQuarterly: {
        accessionNumber: '0000320193-26-000123',
        type: '10-K',
        date: '2026-01-31',
        url: 'https://www.sec.gov/example-10k',
    },
    filingChangeSummary: {
        comparisonForm: '10-K',
        currentFiling: { date: '2026-01-31' },
        previousFiling: { date: '2025-10-31' },
        sectionChanges: [
            {
                key: 'riskFactors',
                title: 'Risk Factors',
                status: 'material',
                currentExcerpt: 'Supply chain concentration remains elevated.',
            },
        ],
    },
    insiderActivity: [
        {
            accessionNumber: '0000320193-26-000222',
            date: '2026-03-01',
            type: '4',
            insiderName: 'Tim Cook',
            position: 'Chief Executive Officer',
            activity: 'Purchase',
            netShares: 125000,
            remainingShares: 3280000,
        },
    ],
    beneficialOwnership: [
        {
            accessionNumber: '0001193125-26-000111',
            date: '2026-02-20',
            type: 'SC 13D',
            owners: ['Berkshire Hathaway Inc.'],
            ownershipPercent: 6.8,
            isPassive: false,
            purpose: 'The reporting persons may review strategic alternatives.',
        },
    ],
};

describe('FundamentalsPage', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('loads SEC filing sections on demand without changing the base filings table', async () => {
        apiRequest
            .mockResolvedValueOnce(fundamentalsPayload)
            .mockResolvedValueOnce(financialsPayload)
            .mockResolvedValueOnce(filingsPayload)
            .mockResolvedValueOnce(secIntelligencePayload)
            .mockResolvedValueOnce(filingDetailPayload);

        render(<FundamentalsPage />);

        fireEvent.change(screen.getByPlaceholderText(/Enter stock ticker/i), { target: { value: 'AAPL' } });
        fireEvent.click(screen.getByRole('button', { name: 'Search' }));

        expect(await screen.findByText('Apple Inc.')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'SEC Filings' }));

        expect(await screen.findByText('Filing Change Watch')).toBeInTheDocument();
        expect(await screen.findByText('Tim Cook')).toBeInTheDocument();
        expect(await screen.findByText('Berkshire Hathaway Inc.')).toBeInTheDocument();
        expect(await screen.findByText('Annual report')).toBeInTheDocument();
        expect(screen.getByText('Current report')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Read key sections' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Read key sections' })).toHaveTextContent('Read key sections');

        fireEvent.click(screen.getByRole('button', { name: 'Read key sections' }));

        expect((await screen.findAllByText('Business')).length).toBeGreaterThan(0);
        expect(screen.getByText('Apple designs devices and services for consumers and businesses.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Risk Factors' })).toBeInTheDocument();
        expect(API_ENDPOINTS.FUNDAMENTALS).toHaveBeenCalledWith('AAPL');
        expect(API_ENDPOINTS.FUNDAMENTALS_FINANCIALS).toHaveBeenCalledWith('AAPL');
        expect(API_ENDPOINTS.FUNDAMENTALS_FILINGS).toHaveBeenCalledWith('AAPL');
        expect(API_ENDPOINTS.FUNDAMENTALS_SEC_INTELLIGENCE).toHaveBeenCalledWith('AAPL');
        expect(API_ENDPOINTS.FUNDAMENTALS_FILING_DETAIL).toHaveBeenCalledWith('AAPL', '0000320193-26-000123');
        expect(screen.queryByText('No key sections were parsed for this filing.')).not.toBeInTheDocument();
    });

    test('shows a retryable inline error if filing detail fails', async () => {
        apiRequest
            .mockResolvedValueOnce(fundamentalsPayload)
            .mockResolvedValueOnce(financialsPayload)
            .mockResolvedValueOnce(filingsPayload)
            .mockResolvedValueOnce(secIntelligencePayload)
            .mockRejectedValueOnce(new Error('detail unavailable'))
            .mockRejectedValueOnce(new Error('detail unavailable'));

        render(<FundamentalsPage />);

        fireEvent.change(screen.getByPlaceholderText(/Enter stock ticker/i), { target: { value: 'AAPL' } });
        fireEvent.click(screen.getByRole('button', { name: 'Search' }));

        expect(await screen.findByText('Apple Inc.')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'SEC Filings' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Read key sections' }));

        expect(await screen.findByText('detail unavailable')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

        await waitFor(() => {
            expect(API_ENDPOINTS.FUNDAMENTALS_FILING_DETAIL).toHaveBeenCalledWith('AAPL', '0000320193-26-000123');
        });
    });
});
