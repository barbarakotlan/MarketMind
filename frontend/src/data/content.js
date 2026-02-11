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

// --- LEARNING MODULES ---
export const learningModules = [
    {
        id: "m1",
        title: "Module 1: Market Foundations",
        description: "Understand the bedrock of the global financial system.",
        chapters: [
            {
                title: "The Market Ecosystem",
                content: [
                    { type: 'paragraph', text: "The stock market is more than just rising and falling numbers; it is a sophisticated mechanism for capital allocation. It involves primary markets (where companies float IPOs) and secondary markets (where you trade)." },
                    { type: 'heading', text: "The Order Book" },
                    { type: 'paragraph', text: "Every price you see is the result of an auction. The 'Bid' is the highest price a buyer is willing to pay, and the 'Ask' is the lowest price a seller accepts. The difference is the 'Spread'." },
                    { type: 'note', text: "Liquidity is king. Stocks with narrow spreads are highly liquid; those with wide spreads are risky to trade quickly." },
                    { type: 'heading', text: "Market Makers vs. Retail" },
                    { type: 'list', items: [
                        "Market Makers: Institutions required to provide liquidity, profiting from the spread.",
                        "Retail Traders: Individual investors like you.",
                        "Institutional Investors: Pension funds and hedge funds moving billions, often driving trends."
                    ]}
                ]
            },
            {
                title: "Asset Classes Deep Dive",
                content: [
                    { type: 'paragraph', text: "Diversification requires understanding different vehicles." },
                    { type: 'heading', text: "Equities (Stocks)" },
                    { type: 'list', items: ["Common Stock: Voting rights, variable dividends.", "Preferred Stock: No voting rights, fixed dividends (bond-like)."] },
                    { type: 'heading', text: "ETFs (Exchange Traded Funds)" },
                    { type: 'paragraph', text: "Baskets of assets that trade like a single stock. They offer instant diversification (e.g., SPY tracks the S&P 500)." },
                    { type: 'heading', text: "Bonds" },
                    { type: 'paragraph', text: "Debt securities where you lend money to a government or corporation in exchange for interest payments." }
                ]
            }
        ]
    },
    {
        id: "m2",
        title: "Module 2: Advanced Analysis",
        description: "Move beyond the basics with professional valuation techniques.",
        chapters: [
            {
                title: "Fundamental Valuation",
                content: [
                    { type: 'paragraph', text: "Price is what you pay; value is what you get. Fundamental analysis seeks the 'Intrinsic Value' of a company." },
                    { type: 'heading', text: "The Big Three Statements" },
                    { type: 'list', items: [
                        "Balance Sheet: A snapshot of what a company owns (Assets) vs owes (Liabilities).",
                        "Income Statement: Shows profitability over time (Revenue - Expenses = Net Income).",
                        "Cash Flow Statement: The actual cash entering and leaving (harder to fake than Net Income)."
                    ]},
                    { type: 'heading', text: "Valuation Multiples" },
                    { type: 'list', items: [
                        "P/E (Price-to-Earnings): How many years of earnings you are paying for.",
                        "PEG Ratio: P/E divided by growth rate. A PEG < 1 suggests a stock is undervalued relative to its growth."
                    ]}
                ]
            },
            {
                title: "Technical Psychology",
                content: [
                    { type: 'paragraph', text: "Technical analysis is the study of market psychology manifested in price action." },
                    { type: 'heading', text: "Support & Resistance" },
                    { type: 'paragraph', text: "Support is a price floor caused by demand concentration. Resistance is a ceiling caused by supply concentration. When resistance breaks, it often becomes new support." },
                    { type: 'heading', text: "Candlestick Anatomy" },
                    { type: 'paragraph', text: "A candlestick tells you the battle between bulls and bears. A 'Wick' or 'Shadow' indicates rejection of a price level." },
                    { type: 'note', text: "Indicators like RSI and MACD are lagging. Price and Volume are the only leading indicators." }
                ]
            }
        ]
    },
    {
        id: "m3",
        title: "Module 3: Derivatives & Options",
        description: "Mastering leverage, hedging, and the mathematics of risk.",
        chapters: [
            {
                title: "Options Mechanics",
                content: [
                    { type: 'paragraph', text: "Options are non-linear instruments. You are trading probability and time." },
                    { type: 'heading', text: "The Greeks (Risk Metrics)" },
                    { type: 'list', items: [
                        "Delta: How much the option price moves for every $1 move in the stock.",
                        "Theta: Time decay. How much value the option loses every day.",
                        "Gamma: The acceleration of Delta. High Gamma means explosive price changes.",
                        "Vega: Sensitivity to volatility. High Vega profits when fear (volatility) increases."
                    ]},
                    { type: 'heading', text: "Implied Volatility (IV)" },
                    { type: 'paragraph', text: "IV represents the market's expectation of future range. Buying options in high IV environments is expensive (like buying fire insurance while the house is burning)." }
                ]
            },
            {
                title: "Strategies",
                content: [
                    { type: 'heading', text: "Speculation vs Income" },
                    { type: 'list', items: [
                        "Long Call/Put: Pure speculation. Unlimited profit potential, but suffers from Time Decay.",
                        "Covered Call: Selling upside potential in exchange for guaranteed income (premium). Lowers cost basis.",
                        "Cash Secured Put: Getting paid to wait to buy a stock at a lower price."
                    ]},
                    { type: 'note', text: "Warning: Selling 'Naked' calls has theoretically infinite risk." }
                ]
            }
        ]
    },
    {
        id: "m4",
        title: "Module 4: Risk & Psychology",
        description: "The mental game of trading and protecting your capital.",
        chapters: [
            {
                title: "Capital Preservation",
                content: [
                    { type: 'paragraph', text: "The first rule of trading is to stay in the game. Professional traders focus on how much they can lose, not how much they can win." },
                    { type: 'heading', text: "The 1% Rule" },
                    { type: 'paragraph', text: "Never risk more than 1-2% of your total account equity on a single trade. If you have $10,000, your stop loss should not lose you more than $100." },
                    { type: 'heading', text: "Risk/Reward Ratio" },
                    { type: 'paragraph', text: "Aim for at least 1:2. You risk $1 to make $2. This allows you to be wrong 50% of the time and still be profitable." }
                ]
            },
            {
                title: "Trading Psychology",
                content: [
                    { type: 'heading', text: "Emotional Traps" },
                    { type: 'list', items: [
                        "FOMO (Fear Of Missing Out): Buying at the top because 'everyone else is'.",
                        "Revenge Trading: Increasing size after a loss to 'make it back'.",
                        "Confirmation Bias: Only reading news that supports your trade."
                    ]},
                    { type: 'note', text: "A trading plan is your emotional anchor. Plan the trade, trade the plan." }
                ]
            }
        ]
    }
];