import { render, waitFor } from '@testing-library/react';

import CheckoutPage from './CheckoutPage';
import { API_ENDPOINTS, apiRequest } from '../config/api';


jest.mock('@stripe/stripe-js', () => ({
    loadStripe: jest.fn(() => Promise.resolve({})),
}));

jest.mock('@stripe/react-stripe-js', () => ({
    Elements: ({ children }) => <div>{children}</div>,
    PaymentElement: () => <div>Payment Element</div>,
    useStripe: () => null,
    useElements: () => null,
}));

jest.mock('../config/api', () => ({
    API_ENDPOINTS: {
        CHECKOUT_CREATE_SUBSCRIPTION: '/checkout/create-subscription',
    },
    apiRequest: jest.fn(),
}));


describe('CheckoutPage', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('requests a subscription without sending client-owned email', async () => {
        apiRequest.mockResolvedValue({ clientSecret: 'cs_test' });

        render(
            <CheckoutPage
                isAnnual={false}
                userEmail="user@example.com"
                onBack={() => {}}
                onSuccess={() => {}}
            />
        );

        await waitFor(() => {
            expect(apiRequest).toHaveBeenCalled();
        });

        expect(apiRequest).toHaveBeenCalledWith(
            API_ENDPOINTS.CHECKOUT_CREATE_SUBSCRIPTION,
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ billing: 'monthly' }),
            })
        );
        expect(apiRequest.mock.calls[0][1].body).not.toContain('email');
    });
});
