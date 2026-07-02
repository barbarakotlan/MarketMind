import React, { useState } from 'react';
import { formatNum } from './format';

const TradeModal = ({ contract, tradeType, stockPrice, onClose, onConfirmTrade }) => {
    const [quantity, setQuantity] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    if (!contract) return null;

    const isBuy = tradeType === 'Buy';
    const price = isBuy ? (contract.ask || contract.current_price || 0) : (contract.bid || contract.current_price || 0);
    const totalCost = ( (price || 0) * (parseFloat(quantity) || 0) * 100).toFixed(2);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const numQuantity = parseInt(quantity);
        if (isNaN(numQuantity) || numQuantity <= 0) {
            setError('Please enter a valid quantity.');
            setLoading(false);
            return;
        }

       if (price <= 0) {
            setError('Cannot trade with $0.00 price. Market may be closed or illiquid.');
            setLoading(false);
            return;
        }

        const result = await onConfirmTrade(contract.contractSymbol || contract.ticker, numQuantity, price, isBuy);

        if (result?.success) {
            onClose();
        } else {
            setError(result?.errorMessage || 'Trade failed. Check portfolio for details.');
        }
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100]" onClick={onClose}>
            <div className="ui-panel max-w-md w-full mx-4 animate-in fade-in zoom-in duration-200 p-8" onClick={(e) => e.stopPropagation()}>
                <h2 className={`text-2xl font-semibold mb-2 ${isBuy ? 'text-mm-accent-primary' : 'text-mm-negative'}`}>
                    {isBuy ? 'Buy to Open' : 'Sell to Close'}
                </h2>
                <p className="text-lg font-semibold text-mm-text-primary">{contract.contractSymbol || contract.ticker}</p>
                {stockPrice && (
                    <p className="text-sm text-mm-text-secondary mb-6">
                        Underlying Price: ${formatNum(stockPrice)}
                    </p>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-mm-text-secondary mb-2">
                            Quantity (1 contract = 100 shares)
                        </label>
                        <input
                            type="number"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            className="ui-input"
                            placeholder="1"
                            min="1"
                            step="1"
                            required
                        />
                    </div>
                    <div className="ui-panel-subtle mb-6 p-4">
                        <div className="flex justify-between text-mm-text-secondary">
                            <span>Market Price:</span>
                            <span className="font-medium">${formatNum(price)}</span>
                        </div>
                        <div className="flex justify-between text-mm-text-primary font-semibold text-lg mt-2">
                            <span>Estimated {isBuy ? 'Cost' : 'Credit'}:</span>
                            <span>${totalCost}</span>
                        </div>
                    </div>

                    {error && <p className="text-mm-negative text-sm text-center mb-4">{error}</p>}

                    <div className="flex gap-4">
                        <button type="button" onClick={onClose} className="ui-button-secondary flex-1">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || price <= 0}
                            className={`flex-1 ${(loading || price <= 0) ? 'ui-button-secondary cursor-not-allowed opacity-60' : (isBuy ? 'ui-button-primary' : 'ui-button-destructive')}`}
                            aria-disabled={loading || price <= 0}
                        >
                            {loading ? 'Submitting...' : (price <= 0 ? 'Unavailable' : `Confirm ${isBuy ? 'Buy' : 'Sell'}`)}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default TradeModal;
