// --- QUIZ DATA ---
export const QUESTION_BANK = {
    easy: [
        {
            id: 1,
            type: 'multiple',
            question: "What is a 'Bull Market'?",
            options: ["A period of rising prices", "A period of falling prices", "A market with no movement", "A market for trading livestock"],
            answer: "A period of rising prices"
        },
        {
            id: 2,
            type: 'multiple',
            question: "What does a 'Stock' represent?",
            options: ["A loan to a company", "A share of ownership in a company", "A government bond", "An insurance policy"],
            answer: "A share of ownership in a company"
        },
        {
            id: 3,
            type: 'text',
            question: "Fill in the blank: A portion of a company's profits paid to shareholders is called a ______.",
            answer: "dividend"
        },
        {
            id: 4,
            type: 'checkbox',
            question: "Which of the following are types of stocks? (Select all that apply)",
            options: ["Common Stocks", "Preferred Stocks", "Loan Stocks", "Future Stocks"],
            answer: ["Common Stocks", "Preferred Stocks"]
        },
        {
            id: 5,
            type: 'multiple',
            question: "What is the primary risk of investing in stocks?",
            options: ["Guaranteed profit", "Loss of capital", "Too much liquidity", "Fixed interest rates"],
            answer: "Loss of capital"
        },
        {
            id: 6,
            type: 'multiple',
            question: "Which option gives you the right to BUY an asset?",
            options: ["Call Option", "Put Option", "Strike Option", "Bid Option"],
            answer: "Call Option"
        },
        {
            id: 7,
            type: 'text',
            question: "Fill in the blank: The acronym for Initial Public Offering is ______.",
            answer: "ipo"
        },
        {
            id: 8,
            type: 'multiple',
            question: "What is a Portfolio?",
            options: ["A collection of investments", "A type of tax document", "A single stock", "A bank account"],
            answer: "A collection of investments"
        },
        {
            id: 9,
            type: 'multiple',
            question: "Which index tracks 500 large companies in the US?",
            options: ["S&P 500", "Dow Jones 30", "Nasdaq 100", "Russell 2000"],
            answer: "S&P 500"
        },
        {
            id: 10,
            type: 'multiple',
            question: "What represents the price a buyer is willing to pay?",
            options: ["Bid", "Ask", "Spread", "Volume"],
            answer: "Bid"
        }
    ],
    medium: [
        {
            id: 1,
            type: 'multiple',
            question: "What is Market Capitalization?",
            options: ["Stock Price x Total Shares Outstanding", "Total Revenue / Net Income", "Assets - Liabilities", "Dividends x Yield"],
            answer: "Stock Price x Total Shares Outstanding"
        },
        {
            id: 2,
            type: 'checkbox',
            question: "Select the tools commonly used in Technical Analysis:",
            options: ["Moving Averages (MA)", "Income Statements", "Relative Strength Index (RSI)", "P/E Ratio"],
            answer: ["Moving Averages (MA)", "Relative Strength Index (RSI)"]
        },
        {
            id: 3,
            type: 'text',
            question: "Fill in the blank: The price at which an option asset can be bought or sold is called the ______ price.",
            answer: "strike"
        },
        {
            id: 4,
            type: 'multiple',
            question: "What does 'Short Selling' mean?",
            options: ["Selling a stock you own", "Selling a borrowed stock expecting price to fall", "Buying a stock for a short time", "Selling stock to a friend"],
            answer: "Selling a borrowed stock expecting price to fall"
        },
        {
            id: 5,
            type: 'multiple',
            question: "Which analysis method evaluates financial statements and economic factors?",
            options: ["Fundamental Analysis", "Technical Analysis", "Sentiment Analysis", "Chart Analysis"],
            answer: "Fundamental Analysis"
        },
        {
            id: 6,
            type: 'checkbox',
            question: "Why might someone trade options? (Select all that apply)",
            options: ["Leverage", "Hedging", "Risk-free profits", "Speculation"],
            answer: ["Leverage", "Hedging", "Speculation"]
        },
        {
            id: 7,
            type: 'multiple',
            question: "What is 'Liquidity'?",
            options: ["How easily an asset can be bought/sold without affecting price", "The amount of cash a company has", "The dividend yield", "The volatility of a stock"],
            answer: "How easily an asset can be bought/sold without affecting price"
        },
        {
            id: 8,
            type: 'text',
            question: "Fill in the blank: P/E Ratio stands for Price-to-______ Ratio.",
            answer: "earnings"
        },
        {
            id: 9,
            type: 'multiple',
            question: "What is the difference between American and European options?",
            options: ["American can be exercised anytime; European only at expiration", "European can be exercised anytime; American only at expiration", "American are cheaper", "No difference"],
            answer: "American can be exercised anytime; European only at expiration"
        },
        {
            id: 10,
            type: 'multiple',
            question: "Which is a risk management tool?",
            options: ["Stop-Loss Order", "Market Order", "Leverage", "Going All In"],
            answer: "Stop-Loss Order"
        }
    ],
    hard: [
        {
            id: 1,
            type: 'multiple',
            question: "What does it mean if an option is 'Out-of-the-Money' (OTM)?",
            options: ["It has no intrinsic value", "It is profitable to exercise", "The premium is zero", "It has expired"],
            answer: "It has no intrinsic value"
        },
        {
            id: 2,
            type: 'checkbox',
            question: "Which factors affect an option's Premium? (Select all that apply)",
            options: ["Underlying Price", "Time to Expiration", "Volatility", "CEO's Name"],
            answer: ["Underlying Price", "Time to Expiration", "Volatility"]
        },
        {
            id: 3,
            type: 'text',
            question: "Fill in the blank: ______ Analysis assumes that past price action and volume predict future movements.",
            answer: "technical"
        },
        {
            id: 4,
            type: 'multiple',
            question: "In Fundamental Analysis, what does the Debt-to-Equity ratio measure?",
            options: ["Financial Leverage", "Profitability", "Asset Turnover", "Market Sentiment"],
            answer: "Financial Leverage"
        },
        {
            id: 5,
            type: 'multiple',
            question: "What is a 'Candlestick Pattern' used for?",
            options: ["Visualizing price movement", "Calculating dividends", "Predicting inflation", "Measuring GDP"],
            answer: "Visualizing price movement"
        },
        {
            id: 6,
            type: 'multiple',
            question: "Which strategy involves selling a borrowed asset?",
            options: ["Short Selling", "Long Position", "Call Buying", "Value Investing"],
            answer: "Short Selling"
        },
        {
            id: 7,
            type: 'checkbox',
            question: "What are the limitations of Technical Analysis? (Select all that apply)",
            options: ["Can be subjective", "Produces false signals in volatile markets", "Requires zero practice", "Past performance doesn't guarantee future results"],
            answer: ["Can be subjective", "Produces false signals in volatile markets", "Past performance doesn't guarantee future results"]
        },
        {
            id: 8,
            type: 'text',
            question: "Fill in the blank: ______ is a method where you buy an asset to reduce the risk of adverse price movements in another asset.",
            answer: "hedging"
        },
        {
            id: 9,
            type: 'multiple',
            question: "What happens to the seller of an option if the market moves against them?",
            options: ["They face potentially unlimited risk (for naked calls)", "They lose only the premium", "They make a profit", "Nothing happens"],
            answer: "They face potentially unlimited risk (for naked calls)"
        },
        {
            id: 10,
            type: 'multiple',
            question: "Which financial statement shows a company's assets, liabilities, and shareholders' equity?",
            options: ["Balance Sheet", "Income Statement", "Cash Flow Statement", "Annual Report"],
            answer: "Balance Sheet"
        }
    ]
};


export const gettingStartedContent = [
    {
        title: "What is the Stock Market?",
        content: [
            { type: 'paragraph', text: "The stock market is where shares of public companies are bought and sold. It helps companies raise capital and allows investors to grow their wealth by trading stocks." },
            { type: 'heading', text: "How It Works" },
            { type: 'paragraph', text: "Investors buy shares through exchanges like the NYSE or NASDAQ, often using brokers. Prices fluctuate based on supply, demand, and company performance." },
            { type: 'heading', text: "Key Participants" },
            { type: 'list', items: ["Investors: Individuals or institutions trading stocks.", "Companies: Businesses listing shares to raise funds.", "Regulators: Ensure fair trading (e.g., SEC)."] },
            { type: 'heading', text: "Types of Stocks" },
            { type: 'list', items: ["Common Stocks: Voting rights + potential dividends.", "Preferred Stocks: Fixed dividends, no voting rights."] },
            { type: 'heading', text: "Why Invest?" },
            { type: 'list', items: ["Potential for high returns.", "Ownership in companies.", "Dividends (profit-sharing)."] },
            { type: 'heading', text: "Risks" },
            { type: 'list', items: ["Market volatility.", "Possible loss of capital.", "Impact of economic events."] },
            { type: 'heading', text: "Key Terms" },
            { type: 'list', items: ["Bull Market: Rising prices.", "Bear Market: Falling prices.", "Portfolio: Your collection of investments.", "Index: Tracks stock groups (e.g., S&P 500)."] },
            { type: 'heading', text: "Getting Started" },
            { type: 'list', items: ["Learn the basics.", "Open a brokerage account.", "Start with a diversified portfolio.", "Stay updated on market trends."] },
            { type: 'note', text: "Investing carries risks. Always research and consult experts if needed!" },
        ]
    },
    {
        title: "What is Options Trading?",
        content: [
             { type: 'paragraph', text: "Options trading involves buying/selling contracts that give the right (but not the obligation) to buy or sell an asset (like stocks) at a set price before a specific date." },
            { type: 'heading', text: "How It Works" },
            { type: 'list', items: ["Call Option: Right to buy an asset at a set price.", "Put Option: Right to sell an asset at a set price.", "Traders pay a 'premium' to own these contracts."] },
            { type: 'heading', text: "Key Participants" },
            { type: 'list', items: ["Buyers: Pay premiums for rights.", "Sellers: Collect premiums, take on obligations.", "Market Makers: Facilitate trading."] },
            { type: 'heading', text: "Types of Options" },
            { type: 'list', items: ["American Options: Can be exercised anytime before expiration.", "European Options: Can only be exercised at expiration."] },
            { type: 'heading', text: "Why Trade Options?" },
            { type: 'list', items: ["Leverage: Control more assets with less capital.", "Hedging: Protect against price movements.", "Speculation: Profit from market predictions."] },
            { type: 'heading', text: "Risks" },
            { type: 'list', items: ["Premiums can be lost if the option expires worthless.", "Sellers face unlimited risk if the market moves against them.", "Complexity requires knowledge and strategy."] },
            { type: 'heading', text: "Key Terms" },
            { type: 'list', items: ["Strike Price: Price at which the asset can be bought/sold.", "Expiration Date: Last day to exercise the option.", "Premium: Cost of the option contract.", "In-the-Money: Option has intrinsic value.", "Out-of-the-Money: Option has no intrinsic value."] },
            { type: 'heading', text: "Getting Started" },
            { type: 'list', items: ["Learn the basics (calls, puts, strategies).", "Open a brokerage account that supports options.", "Start with simple strategies (e.g., buying calls/puts).", "Practice with paper trading before using real money."] },
            { type: 'note', text: "Options trading is complex and risky. Always research and consider consulting a financial advisor!" },
        ]
    },
     {
        title: "Technical Analysis",
        content: [
            { type: 'paragraph', text: "Technical Analysis is a method used to evaluate and predict the future price movements of securities by analyzing historical price data, trading volume, and market trends. Unlike fundamental analysis, it relies on charts, patterns, and indicators." },
            { type: 'heading', text: "Key Concepts" },
            { type: 'list', items: ["Price Action: The movement of a security's price over time.", "Trends: The general direction of a price (uptrend, downtrend, or sideways).", "Support and Resistance: Price levels where buying or selling pressure is strong.", "Volume: The number of shares traded, indicating the strength of a price move."] },
            { type: 'heading', text: "Common Tools" },
            { type: 'list', items: ["Chart Patterns: Head and Shoulders, Double Top/Bottom, Triangles.", "Indicators: Moving Averages (MA), Relative Strength Index (RSI), MACD.", "Candlestick Patterns: Doji, Hammer, Engulfing patterns."] },
            { type: 'heading', text: "Why Use It?" },
            { type: 'list', items: ["Ideal for short-term trading.", "Helps identify entry and exit points.", "Provides tools for risk management.", "Versatile across different markets."] },
            { type: 'heading', text: "Limitations" },
            { type: 'list', items: ["Can be subjective.", "Past performance doesn't guarantee future results.", "Can produce false signals in volatile markets."] },
            { type: 'note', text: "Technical analysis is a powerful tool, but it requires practice and a clear strategy." },
        ]
    },
    {
        title: "Fundamental Analysis",
        content: [
            { type: 'paragraph', text: "Fundamental Analysis is a method of evaluating the intrinsic value of a security by examining economic, financial, and qualitative factors. It looks at the underlying factors that influence a company's performance." },
            { type: 'heading', text: "Key Concepts" },
            { type: 'list', items: ["Intrinsic Value: The true worth of a security.", "Financial Statements: Income Statement, Balance Sheet, Cash Flow Statement.", "Economic Indicators: GDP, inflation, and interest rates."] },
            { type: 'heading', text: "Key Metrics" },
            { type: 'list', items: ["Earnings Per Share (EPS)", "Price-to-Earnings (P/E) Ratio", "Price-to-Book (P/B) Ratio", "Debt-to-Equity Ratio", "Dividend Yield"] },
            { type: 'heading', text: "Qualitative Factors" },
            { type: 'list', items: ["Management Quality", "Industry Position", "Business Model", "Regulatory Environment"] },
            { type: 'heading', text: "Why Use It?" },
            { type: 'list', items: ["Ideal for long-term investing.", "Provides insight into whether a stock is over or underpriced.", "Evaluates a company's financial health."] },
            { type: 'heading', text: "Limitations" },
            { type: 'list', items: ["Time-consuming research.", "Qualitative factors can be subjective.", "Short-term market sentiment can override fundamentals."] },
            { type: 'note', text: "Fundamental analysis is essential for long-term investors seeking to build a strong portfolio." },
        ]
    },
    {
        title: "Risk Management in Crypto",
        content: [
            { type: 'paragraph', text: "Risk Management in cryptocurrency trading is crucial due to the highly volatile nature of the market. Here are key strategies to manage risk effectively:" },
            { type: 'list', items: [
                "Diversify and Allocate Wisely: Spread investments across multiple cryptocurrencies and limit exposure to high-risk assets.",
                "Use Risk Mitigation Tools: Set stop-loss and take-profit orders. Avoid excessive leverage.",
                "Secure Your Assets: Use hardware wallets for long-term holdings and enable two-factor authentication (2FA).",
                "Stay Informed and Avoid Emotions: Conduct thorough research and stick to a predefined strategy.",
                "Plan for the Worst: Define clear exit strategies and be prepared for extreme market scenarios."
            ]},
            { type: 'note', text: "Crypto investments are inherently risky, and there are no guarantees of profit." },
        ]
    },
    {
        title: "Essential Stock Market Vocabulary",
        content: [
            { type: 'paragraph', text: "Here's a list of essential stock market vocabulary to help you understand the world of investing:" },
            { type: 'heading', text: "1. Basic Terms" },
            { type: 'list', items: ["Stock: A share of ownership in a company.", "Dividend: A portion of a company's profits paid to shareholders.", "IPO (Initial Public Offering): The first time a company sells its shares to the public.", "Market Capitalization: The total value of a company's outstanding shares."] },
            { type: 'heading', text: "2. Market Types" },
            { type: 'list', items: ["Bull Market: A period of rising stock prices.", "Bear Market: A period of declining stock prices.", "Volatility: The degree of variation in a stock's price.", "Liquidity: How easily a stock can be bought or sold."] },
            { type: 'heading', text: "3. Trading Terms" },
            { type: 'list', items: ["Bid: The price a buyer is willing to pay.", "Ask: The price a seller is willing to accept.", "Volume: The number of shares traded.", "Order Types: Market Order, Limit Order, Stop-Loss Order."] },
            { type: 'heading', text: "4. Investment Strategies" },
            { type: 'list', items: ["Long Position: Buying a stock expecting its price to rise.", "Short Selling: Selling a borrowed stock expecting its price to fall.", "Value Investing: Buying undervalued stocks.", "Growth Investing: Investing in companies with high growth potential."] },
             { type: 'heading', text: "5. Financial Metrics" },
            { type: 'list', items: ["EPS (Earnings Per Share)", "P/E Ratio (Price-to-Earnings Ratio)", "ROE (Return on Equity)", "Debt-to-Equity Ratio"] },
        ]
    }
];