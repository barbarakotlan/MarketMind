import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TradeModal from './TradeModal';

const contract = { contractSymbol: 'AAPL240119C', ask: 5, bid: 4.8, current_price: 4.9 };

describe('TradeModal', () => {
    test('renders nothing without a contract', () => {
        const { container } = render(
            <TradeModal contract={null} tradeType="Buy" onClose={() => {}} onConfirmTrade={() => {}} />,
        );
        expect(container).toBeEmptyDOMElement();
    });

    test('buy: shows the buy heading, ask price and estimated cost', () => {
        render(
            <TradeModal contract={contract} tradeType="Buy" stockPrice={190} onClose={() => {}} onConfirmTrade={() => {}} />,
        );
        expect(screen.getByRole('heading', { name: 'Buy to Open' })).toBeInTheDocument();
        expect(screen.getByText('AAPL240119C')).toBeInTheDocument();
        expect(screen.getByText('$5.00')).toBeInTheDocument(); // market price = ask
        expect(screen.getByText(/Underlying Price: \$190\.00/)).toBeInTheDocument();
    });

    test('submitting a valid quantity confirms the trade and closes on success', async () => {
        const onConfirmTrade = vi.fn().mockResolvedValue({ success: true });
        const onClose = vi.fn();
        render(<TradeModal contract={contract} tradeType="Buy" onClose={onClose} onConfirmTrade={onConfirmTrade} />);

        fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '2' } });
        fireEvent.click(screen.getByRole('button', { name: 'Confirm Buy' }));

        await waitFor(() => expect(onClose).toHaveBeenCalled());
        expect(onConfirmTrade).toHaveBeenCalledWith('AAPL240119C', 2, 5, true);
    });

    test('shows the error message when the trade fails', async () => {
        const onConfirmTrade = vi.fn().mockResolvedValue({ success: false, errorMessage: 'Insufficient funds' });
        render(<TradeModal contract={contract} tradeType="Buy" onClose={() => {}} onConfirmTrade={onConfirmTrade} />);

        fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '2' } });
        fireEvent.click(screen.getByRole('button', { name: 'Confirm Buy' }));

        expect(await screen.findByText('Insufficient funds')).toBeInTheDocument();
    });

    test('disables the action for a zero-priced (illiquid) contract', () => {
        render(
            <TradeModal
                contract={{ contractSymbol: 'X', ask: 0, bid: 0, current_price: 0 }}
                tradeType="Buy"
                onClose={() => {}}
                onConfirmTrade={() => {}}
            />,
        );
        expect(screen.getByRole('button', { name: 'Unavailable' })).toBeDisabled();
    });

    test('cancel closes the modal', () => {
        const onClose = vi.fn();
        render(<TradeModal contract={contract} tradeType="Sell" onClose={onClose} onConfirmTrade={() => {}} />);
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
