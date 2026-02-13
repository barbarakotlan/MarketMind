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

// --- LEARNING MODULES - FULL COURSE CURRICULUM ---
export const learningModules = [
    {
        id: "m1",
        title: "Module 1: Market Foundations",
        description: "Build a solid understanding of how markets function, key participants, and the basic instruments available to investors.",
        estimatedMinutes: 120,
        chapters: [
            {
                id: "m1c1",
                title: "The Market Ecosystem",
                estimatedMinutes: 25,
                content: [
                    { type: 'paragraph', text: "The stock market is more than just rising and falling numbers; it is a sophisticated mechanism for capital allocation. It connects companies seeking capital with investors seeking returns. Understanding this ecosystem is fundamental to becoming a successful investor." },
                    { type: 'heading', text: "Primary vs. Secondary Markets" },
                    { type: 'paragraph', text: "Primary markets are where companies first issue securities to the public through Initial Public Offerings (IPOs). This is how companies raise capital to fund growth, pay off debt, or allow early investors to exit. Secondary markets are what most people think of as 'the stock market'—where existing shares trade between investors without the company directly receiving the proceeds." },
                    { type: 'heading', text: "The Order Book & Price Discovery" },
                    { type: 'paragraph', text: "Every price you see is the result of a continuous auction. The 'Bid' represents the highest price a buyer is willing to pay, while the 'Ask' (or Offer) is the lowest price a seller will accept. The difference between these is called the 'Spread'—a key indicator of liquidity." },
                    { type: 'list', items: [
                        "Bid: Maximum price buyers are willing to pay",
                        "Ask: Minimum price sellers will accept", 
                        "Spread: The gap between bid and ask prices",
                        "Volume: Number of shares traded, indicating activity level"
                    ]},
                    { type: 'note', text: "Liquidity is king. Stocks with narrow spreads are highly liquid and easier to trade. Wide spreads signal lower liquidity and higher trading costs." },
                    { type: 'heading', text: "Market Participants" },
                    { type: 'list', items: [
                        "Market Makers: Specialized firms that maintain orderly markets by providing continuous bid and ask quotes. They profit from the spread while ensuring liquidity.",
                        "Retail Traders: Individual investors trading their own capital, typically with smaller position sizes.",
                        "Institutional Investors: Pension funds, mutual funds, hedge funds, and insurance companies managing billions. Their large trades often drive market trends.",
                        "Algorithmic Traders: Computer systems executing trades in milliseconds based on predefined strategies, accounting for a significant portion of daily volume."
                    ]}
                ]
            },
            {
                id: "m1c2",
                title: "Asset Classes Deep Dive",
                estimatedMinutes: 30,
                content: [
                    { type: 'paragraph', text: "True diversification requires understanding the characteristics of different asset classes. Each serves different purposes in a portfolio and behaves differently under various market conditions." },
                    { type: 'heading', text: "Equities (Stocks)" },
                    { type: 'paragraph', text: "When you buy a stock, you purchase partial ownership in a company. This entitles you to a share of future profits and potential voting rights." },
                    { type: 'list', items: [
                        "Common Stock: Standard shares with voting rights and variable dividends. Most publicly traded stocks are common shares.",
                        "Preferred Stock: Hybrid securities with bond-like characteristics—fixed dividends paid before common stock, but typically no voting rights.",
                        "Growth Stocks: Companies reinvesting earnings for expansion rather than paying dividends. Higher potential returns with higher risk.",
                        "Value Stocks: Mature companies trading below their intrinsic value, often paying consistent dividends."
                    ]},
                    { type: 'heading', text: "Fixed Income (Bonds)" },
                    { type: 'paragraph', text: "Bonds are debt instruments where you lend money to a government or corporation in exchange for periodic interest payments and return of principal at maturity. They generally offer lower returns than stocks but with less volatility." },
                    { type: 'heading', text: "Exchange-Traded Funds (ETFs)" },
                    { type: 'paragraph', text: "ETFs are baskets of securities that trade like individual stocks. They offer instant diversification, lower fees than mutual funds, and transparency. Popular examples include SPY (S&P 500), QQQ (Nasdaq-100), and VTI (Total Stock Market)." },
                    { type: 'heading', text: "Alternative Assets" },
                    { type: 'list', items: [
                        "Commodities: Physical goods like gold, oil, and agricultural products often used as inflation hedges.",
                        "Real Estate: Direct property ownership or REITs (Real Estate Investment Trusts) providing exposure to property markets.",
                        "Cryptocurrencies: Digital assets using blockchain technology, known for high volatility and 24/7 trading."
                    ]}
                ]
            },
            {
                id: "m1c3",
                title: "Market Indices & Benchmarks",
                estimatedMinutes: 20,
                content: [
                    { type: 'paragraph', text: "Market indices serve as barometers for market performance and provide benchmarks against which to measure your own returns. Understanding what each index represents helps you contextualize market movements." },
                    { type: 'heading', text: "Major US Indices" },
                    { type: 'list', items: [
                        "S&P 500: Tracks 500 of the largest publicly traded US companies. Considered the best gauge of large-cap US equities and the broader economy.",
                        "Dow Jones Industrial Average: Price-weighted index of 30 blue-chip stocks. Despite its fame, it represents a small sample and is less comprehensive than the S&P 500.",
                        "Nasdaq Composite: Heavy on technology companies, includes nearly all stocks listed on the Nasdaq exchange. More volatile than the S&P 500.",
                        "Russell 2000: Tracks 2,000 small-cap companies, providing insight into the performance of smaller businesses."
                    ]},
                    { type: 'heading', text: "Index Weighting Methodologies" },
                    { type: 'paragraph', text: "Not all indices are created equal. Market-cap weighted indices (like S&P 500) give larger companies more influence. Price-weighted indices (like Dow) give higher-priced stocks more weight regardless of company size. Equal-weighted indices treat all constituents the same." },
                    { type: 'note', text: "The S&P 500 is dominated by mega-cap tech companies. In 2024, the top 10 holdings represented over 30% of the entire index." }
                ]
            },
            {
                id: "m1c4",
                title: "Trading Mechanics & Order Types",
                estimatedMinutes: 25,
                content: [
                    { type: 'paragraph', text: "Understanding order types and trading mechanics helps you execute your strategy effectively while managing costs and avoiding common pitfalls." },
                    { type: 'heading', text: "Basic Order Types" },
                    { type: 'list', items: [
                        "Market Order: Executes immediately at the best available current price. Guarantees execution but not the price.",
                        "Limit Order: Executes only at your specified price or better. Guarantees price but not execution.",
                        "Stop Order: Becomes a market order once a trigger price is hit. Used to limit losses or protect profits.",
                        "Stop-Limit Order: Combines stop and limit—becomes a limit order when triggered, providing price control."
                    ]},
                    { type: 'heading', text: "Extended Hours Trading" },
                    { type: 'paragraph', text: "Pre-market (4:00-9:30 AM ET) and after-hours (4:00-8:00 PM ET) sessions allow trading outside regular hours. However, liquidity is lower, spreads are wider, and volatility is higher during these periods." },
                    { type: 'heading', text: "Settlement & T+1" },
                    { type: 'paragraph', text: "As of 2024, US securities settle on a T+1 basis—meaning ownership officially transfers one business day after the trade date. This affects when you can withdraw proceeds from a sale or use them to buy other securities." },
                    { type: 'note', text: "Pattern Day Trader Rule: FINRA restricts accounts with less than $25,000 to no more than 3 day trades in a 5-business-day period." }
                ]
            },
            {
                id: "m1c5",
                title: "Market Regulation & Investor Protection",
                estimatedMinutes: 20,
                content: [
                    { type: 'paragraph', text: "Financial markets operate within a framework of regulations designed to maintain fairness, transparency, and investor protection. Understanding these guardrails helps you recognize legitimate practices and avoid scams." },
                    { type: 'heading', text: "Key Regulatory Bodies" },
                    { type: 'list', items: [
                        "SEC (Securities and Exchange Commission): Federal agency overseeing securities markets, enforcing laws against market manipulation and fraud.",
                        "FINRA (Financial Industry Regulatory Authority): Self-regulatory organization supervising broker-dealers and licensing securities professionals.",
                        "CFTC (Commodity Futures Trading Commission): Regulates futures, options, and derivatives markets.",
                        "SIPC (Securities Investor Protection Corporation): Protects against broker-dealer failure (not investment losses), covering up to $500,000 per account."
                    ]},
                    { type: 'heading', text: "Insider Trading Laws" },
                    { type: 'paragraph', text: "Trading securities while in possession of material non-public information is illegal. This applies to company insiders, but also to anyone who receives a 'tip' and trades on it. Penalties include fines up to 3x profits and imprisonment." },
                    { type: 'heading', text: "Disclosure Requirements" },
                    { type: 'paragraph', text: "Public companies must file regular reports (10-K annual, 10-Q quarterly, 8-K for material events). These filings provide transparency into financial health, risks, and operations. Learning to read these documents is essential for fundamental analysis." }
                ]
            }
        ]
    },
    {
        id: "m2",
        title: "Module 2: Fundamental Analysis",
        description: "Learn to read financial statements, calculate valuation metrics, and determine the intrinsic value of a company.",
        estimatedMinutes: 180,
        chapters: [
            {
                id: "m2c1",
                title: "The Big Three Financial Statements",
                estimatedMinutes: 40,
                content: [
                    { type: 'paragraph', text: "Financial statements are the report cards of business. Learning to read them allows you to assess a company's health, profitability, and sustainability. All three statements interconnect to tell the complete financial story." },
                    { type: 'heading', text: "The Balance Sheet" },
                    { type: 'paragraph', text: "The balance sheet provides a snapshot of what a company owns (assets) versus what it owes (liabilities) at a specific point in time. The difference is shareholders' equity—the book value belonging to owners." },
                    { type: 'list', items: [
                        "Assets: Cash, accounts receivable, inventory, property, and intangibles. Current assets can convert to cash within a year.",
                        "Liabilities: Accounts payable, debt, and obligations. Current liabilities are due within a year.",
                        "Shareholders' Equity: The residual value if all assets were sold and debts paid. Includes retained earnings and contributed capital."
                    ]},
                    { type: 'heading', text: "The Income Statement" },
                    { type: 'paragraph', text: "Also called the Profit & Loss (P&L) statement, this shows revenue, expenses, and profitability over a period. It follows a logical flow from top-line revenue to bottom-line net income." },
                    { type: 'list', items: [
                        "Revenue (Top Line): Total sales before any costs are deducted.",
                        "Gross Profit: Revenue minus cost of goods sold (COGS).",
                        "Operating Income: Gross profit minus operating expenses (R&D, SG&A).",
                        "Net Income (Bottom Line): Final profit after all expenses, interest, and taxes."
                    ]},
                    { type: 'heading', text: "The Cash Flow Statement" },
                    { type: 'paragraph', text: "Cash is harder to manipulate than earnings. This statement tracks actual cash movement through operating, investing, and financing activities." },
                    { type: 'list', items: [
                        "Operating Activities: Cash generated from core business operations.",
                        "Investing Activities: Capital expenditures, acquisitions, and asset sales.",
                        "Financing Activities: Debt issuance/repayment, stock buybacks, and dividend payments."
                    ]},
                    { type: 'note', text: "Free Cash Flow = Operating Cash Flow - Capital Expenditures. This represents cash available for growth, debt reduction, or returning to shareholders." }
                ]
            },
            {
                id: "m2c2",
                title: "Profitability Ratios",
                estimatedMinutes: 30,
                content: [
                    { type: 'paragraph', text: "Profitability ratios measure how efficiently a company generates profits from its resources. These metrics allow comparison across companies and industries." },
                    { type: 'heading', text: "Margin Analysis" },
                    { type: 'list', items: [
                        "Gross Margin: (Revenue - COGS) / Revenue. Shows pricing power and production efficiency. Software companies typically have 70%+ margins; retailers often have 20-30%.",
                        "Operating Margin: Operating Income / Revenue. Reflects core business profitability after operating expenses.",
                        "Net Margin: Net Income / Revenue. The bottom-line percentage of revenue that becomes profit."
                    ]},
                    { type: 'heading', text: "Return Metrics" },
                    { type: 'list', items: [
                        "ROE (Return on Equity): Net Income / Shareholders' Equity. Measures how effectively capital generates returns. 15%+ is generally considered good.",
                        "ROA (Return on Assets): Net Income / Total Assets. Shows efficiency in using all assets, regardless of financing source.",
                        "ROIC (Return on Invested Capital): NOPAT / (Debt + Equity). Measures returns on all capital invested in the business—the purest measure of operational efficiency."
                    ]},
                    { type: 'note', text: "Buffett's Rule: Look for companies with consistent ROE above 20% over 10+ years with little debt." }
                ]
            },
            {
                id: "m2c3",
                title: "Valuation Multiples",
                estimatedMinutes: 35,
                content: [
                    { type: 'paragraph', text: "Valuation multiples provide a common language for comparing company values. They normalize for size differences and offer quick benchmarks, but must always be interpreted in context." },
                    { type: 'heading', text: "Price Multiples" },
                    { type: 'list', items: [
                        "P/E (Price-to-Earnings): Stock Price / EPS. The most common valuation metric—how many years of earnings you're paying for. Varies by growth prospects and risk.",
                        "P/S (Price-to-Sales): Market Cap / Revenue. Useful for unprofitable growth companies where earnings are negative.",
                        "P/B (Price-to-Book): Stock Price / Book Value per Share. Popular for banks and asset-heavy industries. Below 1 may indicate undervaluation (or problems)."
                    ]},
                    { type: 'heading', text: "Enterprise Value Multiples" },
                    { type: 'paragraph', text: "Enterprise Value (EV) = Market Cap + Debt - Cash. It represents the total cost to acquire the company, making EV multiples better for comparing companies with different capital structures." },
                    { type: 'list', items: [
                        "EV/EBITDA: Compares total company value to earnings before interest, taxes, depreciation, and amortization. Common in M&A analysis.",
                        "EV/Revenue: Used for high-growth companies not yet profitable. SaaS companies often trade at 10-20x revenue multiples."
                    ]},
                    { type: 'heading', text: "The PEG Ratio" },
                    { type: 'paragraph', text: "PEG = P/E Ratio / Annual EPS Growth Rate. Developed by Peter Lynch, it factors growth into valuation. A PEG below 1 suggests a stock may be undervalued relative to its growth prospects, while above 2 may indicate overvaluation." },
                    { type: 'note', text: "No single multiple tells the whole story. Always compare against peers, historical averages, and consider the business quality." }
                ]
            },
            {
                id: "m2c4",
                title: "Growth & Dividend Analysis",
                estimatedMinutes: 30,
                content: [
                    { type: 'paragraph', text: "Understanding a company's growth trajectory and capital return policy helps you determine whether it fits your investment objectives and how to value it appropriately." },
                    { type: 'heading', text: "Growth Metrics" },
                    { type: 'list', items: [
                        "Revenue Growth: Year-over-year sales increase. Consistent 10%+ revenue growth is attractive for established companies; 20%+ for growth stocks.",
                        "Earnings Growth: More important than revenue growth, but can be manipulated by buybacks and accounting adjustments.",
                        "CAGR (Compound Annual Growth Rate): Smooths year-to-year volatility to show the mean annual growth rate over a period."
                    ]},
                    { type: 'heading', text: "Dividend Analysis" },
                    { type: 'paragraph', text: "Dividends represent direct cash returns to shareholders. Dividend-paying stocks tend to be less volatile and appeal to income-focused investors." },
                    { type: 'list', items: [
                        "Dividend Yield: Annual Dividend / Stock Price. Shows income return percentage. Typically 2-5% for dividend stocks.",
                        "Payout Ratio: Dividends / Net Income. The percentage of earnings paid as dividends. Above 80% may be unsustainable; below 30% suggests room for increases.",
                        "Dividend Growth Rate: How quickly the dividend increases annually. 25+ years of consecutive increases makes a stock a 'Dividend Aristocrat'."
                    ]},
                    { type: 'note', text: "The Gordon Growth Model: Stock Value = Next Year's Dividend / (Required Return - Growth Rate). A simple way to value dividend stocks." }
                ]
            },
            {
                id: "m2c5",
                title: "Qualitative Analysis",
                estimatedMinutes: 25,
                content: [
                    { type: 'paragraph', text: "Numbers tell only part of the story. Qualitative factors—the aspects that don't appear on financial statements—often determine long-term success or failure." },
                    { type: 'heading', text: "Competitive Advantages (Moats)" },
                    { type: 'paragraph', text: "Warren Buffett popularized the concept of an economic moat—a sustainable competitive advantage that protects a company's profits from competitors." },
                    { type: 'list', items: [
                        "Brand Power: Companies like Coca-Cola or Apple can charge premium prices based on brand reputation alone.",
                        "Network Effects: Platforms become more valuable as more users join (e.g., Meta, Visa, marketplaces).",
                        "High Switching Costs: When customers face significant barriers to changing providers (e.g., enterprise software, banks).",
                        "Cost Advantages: Lower production costs due to scale, location, or proprietary processes.",
                        "Regulatory Barriers: Licenses, patents, and government protections limiting competition."
                    ]},
                    { type: 'heading', text: "Management Quality" },
                    { type: 'paragraph', text: "Evaluate management by reading earnings call transcripts, reviewing capital allocation decisions, and assessing their communication transparency. Great management teams think like owners, avoid excessive dilution, and return excess capital appropriately." },
                    { type: 'heading', text: "Industry Dynamics" },
                    { type: 'paragraph', text: "Porter's Five Forces framework helps assess industry attractiveness: competitive rivalry, supplier power, buyer power, threat of substitutes, and barriers to entry. Favorable industries have limited competition and high barriers to entry." }
                ]
            }
        ]
    },
    {
        id: "m3",
        title: "Module 3: Technical Analysis",
        description: "Master chart reading, pattern recognition, and technical indicators to time your entries and exits.",
        estimatedMinutes: 160,
        chapters: [
            {
                id: "m3c1",
                title: "Chart Types & Candlestick Anatomy",
                estimatedMinutes: 30,
                content: [
                    { type: 'paragraph', text: "Technical analysis is the study of market psychology manifested in price action. Before learning patterns, you must understand how to read the basic building blocks of charts." },
                    { type: 'heading', text: "Chart Types" },
                    { type: 'list', items: [
                        "Line Charts: Simple closing price connection. Best for identifying overall trends but lack detail.",
                        "Bar Charts: Show open, high, low, and close (OHLC) for each period as vertical bars.",
                        "Candlestick Charts: Originating from Japanese rice traders, these provide the same OHLC data as bars but with visual color coding that makes patterns easier to spot."
                    ]},
                    { type: 'heading', text: "Candlestick Anatomy" },
                    { type: 'paragraph', text: "Each candlestick represents the battle between buyers (bulls) and sellers (bears) during a specific time period." },
                    { type: 'list', items: [
                        "Body: The rectangular area between open and close. Green/white candles close higher than they open; red/black candles close lower.",
                        "Wicks (Shadows): The thin lines extending above and below the body, representing the period's high and low.",
                        "Long Body: Strong conviction in the direction of the move.",
                        "Long Wicks: Rejection of price levels—bulls rejected highs or bears rejected lows."
                    ]},
                    { type: 'heading', text: "Key Single-Candle Patterns" },
                    { type: 'list', items: [
                        "Doji: Open and close are virtually equal, indicating indecision. Often signals reversals at trend extremes.",
                        "Hammer: Small body at the top with a long lower wick. Bullish reversal when appearing after a decline.",
                        "Shooting Star: Small body at the bottom with a long upper wick. Bearish reversal when appearing after a rally.",
                        "Marubozu: Long body with no wicks. Shows overwhelming control by buyers (green) or sellers (red)."
                    ]}
                ]
            },
            {
                id: "m3c2",
                title: "Support & Resistance",
                estimatedMinutes: 25,
                content: [
                    { type: 'paragraph', text: "Support and resistance are the foundation of technical analysis. These price levels where buying or selling pressure historically emerges can help predict future price movements and identify trading opportunities." },
                    { type: 'heading', text: "Understanding Support" },
                    { type: 'paragraph', text: "Support is a price level where buying pressure is strong enough to overcome selling pressure, causing price to stop falling and potentially reverse. It often forms at previous lows, round numbers, or key moving averages." },
                    { type: 'heading', text: "Understanding Resistance" },
                    { type: 'paragraph', text: "Resistance is the opposite—a price level where selling pressure overcomes buying pressure, halting advances. Previous highs, psychological round numbers, and overhead supply create resistance." },
                    { type: 'heading', text: "The Principle of Polarity" },
                    { type: 'paragraph', text: "Once support is broken, it often becomes resistance—and vice versa. This 'role reversal' occurs because traders who bought at support and held through the breakdown often sell when price returns to their breakeven point." },
                    { type: 'list', items: [
                        "Breakouts: When price moves decisively above resistance on high volume, the resistance level often becomes new support.",
                        "Breakdowns: When price falls below support on volume, that support becomes overhead resistance.",
                        "False Breakouts: Price briefly breaks a level before reversing sharply. These 'fakeouts' trap breakout traders and often lead to strong moves in the opposite direction."
                    ]},
                    { type: 'note', text: "The more times a level is tested, the stronger it becomes—but also the more likely it is to eventually break." }
                ]
            },
            {
                id: "m3c3",
                title: "Trend Analysis & Moving Averages",
                estimatedMinutes: 35,
                content: [
                    { type: 'paragraph', text: "The trend is your friend. Trading in the direction of the prevailing trend significantly improves your probability of success. Moving averages provide objective trend identification and dynamic support/resistance." },
                    { type: 'heading', text: "Types of Trends" },
                    { type: 'list', items: [
                        "Uptrend: Characterized by higher highs and higher lows. The bulls are in control.",
                        "Downtrend: Characterized by lower highs and lower lows. The bears dominate.",
                        "Sideways/Range-Bound: When price oscillates between parallel support and resistance with no clear direction.",
                        "Trend Within a Trend: A daily uptrend may contain hourly downtrends—always consider your timeframe."
                    ]},
                    { type: 'heading', text: "Moving Averages" },
                    { type: 'paragraph', text: "Moving averages smooth price data to reveal the underlying trend. They lag price action but provide clarity in noisy markets." },
                    { type: 'list', items: [
                        "SMA (Simple Moving Average): The arithmetic mean of prices over a period. All data points weighted equally.",
                        "EMA (Exponential Moving Average): Gives more weight to recent prices, making it more responsive to current action.",
                        "Common Periods: 20-day (monthly trend), 50-day (quarterly trend), 200-day (yearly trend, proxy for institutional sentiment)."
                    ]},
                    { type: 'heading', text: "Moving Average Signals" },
                    { type: 'list', items: [
                        "Golden Cross: 50-day SMA crosses above 200-day SMA. Bullish signal suggesting momentum shift.",
                        "Death Cross: 50-day SMA crosses below 200-day SMA. Bearish signal often preceding extended declines.",
                        "Price Cross: When price crosses above/below a significant MA, it signals potential trend change."
                    ]},
                    { type: 'note', text: "In strong trends, price often 'respects' the 20-day EMA, using it as dynamic support (uptrends) or resistance (downtrends)." }
                ]
            },
            {
                id: "m3c4",
                title: "Technical Indicators",
                estimatedMinutes: 40,
                content: [
                    { type: 'paragraph', text: "Indicators are mathematical calculations based on price, volume, or open interest. They help confirm trends, identify overbought/oversold conditions, and generate trading signals. Remember: indicators are derivatives of price—they lag and can give false signals." },
                    { type: 'heading', text: "Momentum Oscillators" },
                    { type: 'list', items: [
                        "RSI (Relative Strength Index): Measures speed and magnitude of price movements on a 0-100 scale. Above 70 = overbought; below 30 = oversold. Divergences between RSI and price often precede reversals.",
                        "MACD (Moving Average Convergence Divergence): Shows relationship between two EMAs. The MACD line crossing above the signal line is bullish. Histogram shows momentum strength.",
                        "Stochastic Oscillator: Compares closing price to price range over time. Values above 80 overbought; below 20 oversold. Very sensitive—best in ranging markets, not trending ones."
                    ]},
                    { type: 'heading', text: "Volume Indicators" },
                    { type: 'paragraph', text: "Volume confirms price movements. Strong moves on high volume are more significant than moves on low volume." },
                    { type: 'list', items: [
                        "OBV (On-Balance Volume): Running total of volume, adding on up days and subtracting on down days. Rising OBV confirms uptrends.",
                        "Volume Profile: Shows trading activity at specific price levels, revealing where most trading occurred (value areas) and where little trading happened (thin zones likely to be traversed quickly)."
                    ]},
                    { type: 'heading', text: "Volatility Indicators" },
                    { type: 'list', items: [
                        "Bollinger Bands: Price envelope showing 2 standard deviations from a 20-day SMA. Price touching bands suggests overextension; squeeze (narrowing bands) precedes volatility expansions.",
                        "ATR (Average True Range): Measures volatility independent of direction. Helps set stop-losses based on normal price fluctuations."
                    ]},
                    { type: 'note', text: "Indicator Confluence: When multiple indicators align (e.g., RSI oversold + price at support + bullish MACD cross), the signal is stronger than any single indicator alone." }
                ]
            },
            {
                id: "m3c5",
                title: "Chart Patterns",
                estimatedMinutes: 30,
                content: [
                    { type: 'paragraph', text: "Chart patterns are recognizable formations created by price action. They reflect market psychology and, while not foolproof, provide probabilistic scenarios for future price movement." },
                    { type: 'heading', text: "Reversal Patterns" },
                    { type: 'list', items: [
                        "Head and Shoulders: Three peaks with the middle highest. The neckline connects the two troughs; a break below signals trend change from up to down. Inverted version signals bottoms.",
                        "Double Top/Bottom: 'M' or 'W' shapes showing two tests of a level followed by reversal. The middle trough/peak becomes the trigger level.",
                        "Rounding Bottom: Gradual saucer-shaped decline and recovery indicating slow shift from bearish to bullish sentiment. Often leads to powerful moves."
                    ]},
                    { type: 'heading', text: "Continuation Patterns" },
                    { type: 'paragraph', text: "These patterns suggest the prevailing trend will resume after a consolidation period." },
                    { type: 'list', items: [
                        "Triangles: Ascending (bullish), descending (bearish), and symmetrical (neutral). Price coils within converging trendlines before breaking out.",
                        "Flags and Pennants: Brief consolidations after sharp moves. Flags are rectangular; pennants are small triangles. Both suggest continuation in the direction of the preceding move.",
                        "Cup and Handle: Rounding bottom (cup) followed by a small pullback (handle). Breakout above the handle rim signals continuation of the prior uptrend."
                    ]},
                    { type: 'heading', text: "Measuring Implications" },
                    { type: 'paragraph', text: "Many patterns have measuring rules based on their formation height. For example, the expected move after a head and shoulders breakdown equals the distance from the head to the neckline, projected downward from the breakout point." }
                ]
            }
        ]
    },
    {
        id: "m4",
        title: "Module 4: Options & Derivatives",
        description: "Understand options mechanics, the Greeks, and strategies for income, speculation, and hedging.",
        estimatedMinutes: 200,
        chapters: [
            {
                id: "m4c1",
                title: "Options Basics",
                estimatedMinutes: 35,
                content: [
                    { type: 'paragraph', text: "Options are contracts that give the holder the right, but not the obligation, to buy or sell an underlying asset at a specific price before a specific date. They are powerful tools for leverage, income, and risk management." },
                    { type: 'heading', text: "Call Options" },
                    { type: 'paragraph', text: "A call option gives the buyer the right to BUY the underlying asset at the strike price. Buyers of calls are bullish—profiting when the stock price rises above the strike plus the premium paid." },
                    { type: 'list', items: [
                        "Buyer (Long Call): Pays premium for upside potential. Maximum loss = premium paid. Unlimited profit potential.",
                        "Seller (Short Call): Receives premium. Obligated to sell shares if assigned. Maximum profit = premium received. Unlimited risk if naked (no underlying position)."
                    ]},
                    { type: 'heading', text: "Put Options" },
                    { type: 'paragraph', text: "A put option gives the buyer the right to SELL the underlying asset at the strike price. Buyers of puts are bearish—profiting when the stock price falls below the strike minus the premium paid." },
                    { type: 'list', items: [
                        "Buyer (Long Put): Pays premium for downside protection or bearish speculation. Maximum loss = premium. Maximum profit = strike price minus premium (if stock goes to zero).",
                        "Seller (Short Put): Receives premium. Obligated to buy shares if assigned. Used to generate income or acquire stocks at desired prices."
                    ]},
                    { type: 'heading', text: "Key Terms" },
                    { type: 'list', items: [
                        "Strike Price: The agreed-upon price at which the underlying can be bought or sold.",
                        "Expiration: The date by which the option must be exercised or it becomes worthless.",
                        "Premium: The price paid for the option contract (1 contract = 100 shares).",
                        "In-the-Money (ITM): Call with strike below stock price; Put with strike above stock price. Has intrinsic value.",
                        "Out-of-the-Money (OTM): Call with strike above stock price; Put with strike below stock price. Only time value."
                    ]}
                ]
            },
            {
                id: "m4c2",
                title: "The Greeks",
                estimatedMinutes: 40,
                content: [
                    { type: 'paragraph', text: "The Greeks measure how sensitive an option's price is to various factors. They help traders understand risk exposure and position themselves appropriately for different market conditions." },
                    { type: 'heading', text: "Delta (Directional Risk)" },
                    { type: 'paragraph', text: "Delta measures how much an option's price changes for every $1 move in the underlying stock. It ranges from 0 to 1 for calls and -1 to 0 for puts. Delta also approximates the probability the option expires in-the-money." },
                    { type: 'list', items: [
                        "At-the-money options have deltas around 0.50 (calls) or -0.50 (puts).",
                        "Deep ITM options approach 1.00 (or -1.00), moving nearly dollar-for-dollar with the stock.",
                        "Deep OTM options have deltas near 0, barely responding to stock price changes."
                    ]},
                    { type: 'heading', text: "Theta (Time Decay)" },
                    { type: 'paragraph', text: "Theta represents how much value an option loses each day due to time passing, all else equal. Time decay accelerates as expiration approaches, especially in the final 30 days. Option buyers fight theta; option sellers benefit from it." },
                    { type: 'heading', text: "Gamma (Delta Acceleration)" },
                    { type: 'paragraph', text: "Gamma measures how quickly delta changes as the stock price moves. High gamma means delta is changing rapidly—small stock moves create large changes in option value. ATM options have the highest gamma, especially near expiration." },
                    { type: 'heading', text: "Vega (Volatility Sensitivity)" },
                    { type: 'paragraph', text: "Vega measures sensitivity to changes in implied volatility. It represents how much an option's price changes for each 1% change in implied volatility. Longer-dated options have higher vega, making them more sensitive to volatility changes." },
                    { type: 'note', text: "Rho (interest rate sensitivity) exists but is generally less significant for most traders, especially in stable rate environments." }
                ]
            },
            {
                id: "m4c3",
                title: "Volatility & Pricing",
                estimatedMinutes: 35,
                content: [
                    { type: 'paragraph', text: "Understanding volatility is crucial for options trading. It represents the market's expectation of future price movement and is a primary driver of option premiums." },
                    { type: 'heading', text: "Implied Volatility (IV)" },
                    { type: 'paragraph', text: "IV represents the market's forecast of likely movement in the underlying stock. It's derived from option prices using models like Black-Scholes and expressed as an annualized percentage. High IV means expensive options; low IV means cheap options." },
                    { type: 'list', items: [
                        "IV Rank: Where current IV falls relative to the past year's range (0-100 scale). 90 means IV is higher than 90% of the past year.",
                        "IV Percentile: Similar to rank but accounts for how often IV was at each level.",
                        "Mean Reversion: IV tends to oscillate around a long-term average. Extreme levels often revert to the mean."
                    ]},
                    { type: 'heading', text: "Historical vs. Implied Volatility" },
                    { type: 'paragraph', text: "Historical volatility measures actual past price movements. When IV exceeds historical volatility, options are expensive relative to realized movement—favoring selling strategies. When IV is below historical volatility, options may be underpriced—favoring buying." },
                    { type: 'heading', text: "Volatility Skew" },
                    { type: 'paragraph', text: "IV is not constant across strikes. OTM puts typically have higher IV than OTM calls (reverse skew), reflecting the market's fear of crashes. This pattern affects strategy selection—selling puts generates more premium than selling calls at equidistant strikes." },
                    { type: 'note', text: "Earnings announcements typically cause a volatility crush after the event—IV drops dramatically, hurting long option positions even if the stock moves in your direction." }
                ]
            },
            {
                id: "m4c4",
                title: "Income Strategies",
                estimatedMinutes: 35,
                content: [
                    { type: 'paragraph', text: "Options can generate consistent income through premium collection. These strategies work best in neutral to slightly directional markets with high implied volatility." },
                    { type: 'heading', text: "Covered Calls" },
                    { type: 'paragraph', text: "Selling call options against stock you own. You collect premium in exchange for capping your upside. Best used when neutral to slightly bearish on a stock you already own." },
                    { type: 'list', items: [
                        "Maximum Profit: Premium received + gain to strike price.",
                        "Maximum Loss: Stock purchase price minus premium (if stock goes to zero).",
                        "Best Conditions: High IV, neutral outlook, willing to sell shares at strike.",
                        "Risk: Missing out on gains if stock rockets past the strike."
                    ]},
                    { type: 'heading', text: "Cash-Secured Puts" },
                    { type: 'paragraph', text: "Selling put options while keeping cash available to purchase shares if assigned. Essentially, getting paid to place limit orders." },
                    { type: 'list', items: [
                        "Strategy: Sell OTM puts on stocks you'd happily own at the strike price.",
                        "Outcome A: Stock stays above strike, keep full premium.",
                        "Outcome B: Stock falls below strike, buy shares at effective price (strike minus premium).",
                        "Best Conditions: High IV, bullish long-term but willing to buy dips."
                    ]},
                    { type: 'heading', text: "Credit Spreads" },
                    { type: 'paragraph', text: "Limited-risk versions of naked selling. Buy a further OTM option to cap potential losses, sacrificing some premium." },
                    { type: 'list', items: [
                        "Bull Put Spread: Sell put, buy lower put. Profitable if stock stays above short strike.",
                        "Bear Call Spread: Sell call, buy higher call. Profitable if stock stays below short strike.",
                        "Iron Condor: Combine both spreads for a range-bound strategy—profiting if stock stays between the short strikes."
                    ]}
                ]
            },
            {
                id: "m4c5",
                title: "Speculation & Hedging",
                estimatedMinutes: 30,
                content: [
                    { type: 'paragraph', text: "Options provide leveraged exposure to stock movements and can protect existing positions against adverse moves. These uses require disciplined risk management given their potential for total loss." },
                    { type: 'heading', text: "Long Options for Speculation" },
                    { type: 'paragraph', text: "Buying calls or puts offers leveraged returns with defined risk. A small move in the underlying can produce outsized percentage gains on the option—but time decay works against you." },
                    { type: 'list', items: [
                        "Buying Calls: Limited risk (premium paid), unlimited upside. Requires significant upward move to overcome time decay.",
                        "Buying Puts: Limited risk, substantial profit potential (to zero). Natural hedge for long stock positions.",
                        "LEAPS: Long-dated options (1+ years) with lower theta decay. Useful for long-term directional bets with less capital than owning stock."
                    ]},
                    { type: 'heading', text: "Hedging Strategies" },
                    { type: 'paragraph', text: "Options can protect portfolios against downside without selling holdings and triggering tax events." },
                    { type: 'list', items: [
                        "Protective Puts: Buying puts on stocks you own sets a floor on potential losses (like insurance). Cost reduces returns but limits drawdowns.",
                        "Collars: Combine covered calls with protective puts. Premium from selling calls helps pay for put protection, capping both upside and downside.",
                        "Index Puts: Buying puts on broad indices (SPY, QQQ) hedges entire portfolios against market crashes."
                    ]},
                    { type: 'heading', text: "The Risk of Naked Positions" },
                    { type: 'paragraph', text: "Selling uncovered (naked) calls has theoretically unlimited risk—if the stock price rises indefinitely, losses are infinite. Most brokers require high option approval levels and significant margin for naked positions. Always understand your maximum risk before entering any trade." },
                    { type: 'note', text: "The 10% Rule: Never risk more than 10% of your portfolio on speculative options trades. Their leveraged nature means small position sizes can still produce meaningful returns." }
                ]
            },
            {
                id: "m4c6",
                title: "Multi-Leg Strategies",
                estimatedMinutes: 25,
                content: [
                    { type: 'paragraph', text: "Advanced strategies combine multiple options to create specific risk/reward profiles for various market conditions and objectives." },
                    { type: 'heading', text: "Straddles & Strangles" },
                    { type: 'paragraph', text: "These strategies profit from significant moves in either direction, regardless of which way the stock goes. Ideal when expecting high volatility but uncertain of direction." },
                    { type: 'list', items: [
                        "Long Straddle: Buy ATM call and put with same strike and expiration. Profits if stock moves significantly in either direction. Requires large move to overcome cost of both premiums.",
                        "Long Strangle: Buy OTM call and put with different strikes. Cheaper than straddle but requires even larger move to profit.",
                        "Short Straddle/Strangle: Sell both options, collecting premium. Profitable if stock stays stable—high risk if large move occurs."
                    ]},
                    { type: 'heading', text: "Butterfly Spreads" },
                    { type: 'paragraph', text: "Low-cost, limited-risk strategies that profit from low volatility and time decay. Structure: Buy 1 ITM option, Sell 2 ATM options, Buy 1 OTM option. Maximum profit occurs if stock expires exactly at the middle strike." },
                    { type: 'heading', text: "Calendar Spreads" },
                    { type: 'paragraph', text: "Also called time spreads or horizontal spreads. Sell short-dated option, buy longer-dated option at same strike. Profits from faster time decay of the near-term option. Works best in low volatility environments when expecting the underlying to stay near the strike." }
                ]
            }
        ]
    },
    {
        id: "m5",
        title: "Module 5: Portfolio Management",
        description: "Build and manage a diversified portfolio aligned with your goals, risk tolerance, and time horizon.",
        estimatedMinutes: 150,
        chapters: [
            {
                id: "m5c1",
                title: "Investment Policy & Goal Setting",
                estimatedMinutes: 25,
                content: [
                    { type: 'paragraph', text: "Successful investing begins with clarity about what you're trying to achieve. Without defined goals and constraints, you're navigating without a map." },
                    { type: 'heading', text: "Defining Your Objectives" },
                    { type: 'list', items: [
                        "Growth: Prioritizing capital appreciation over income. Appropriate for younger investors with long time horizons.",
                        "Income: Prioritizing cash flow through dividends and interest. Common for retirees or those seeking passive income.",
                        "Preservation: Prioritizing capital protection over returns. For near-term goals or risk-averse investors.",
                        "Total Return: Balanced approach seeking both growth and income."
                    ]},
                    { type: 'heading', text: "Time Horizon Considerations" },
                    { type: 'paragraph', text: "Your time horizon profoundly impacts appropriate asset allocation. Goals within 3 years require conservative approaches; goals 10+ years away can tolerate more volatility for higher returns." },
                    { type: 'list', items: [
                        "Short-term (0-3 years): Emphasize safety—high-yield savings, CDs, short-term bonds.",
                        "Medium-term (3-10 years): Balanced approach—mix of stocks and bonds.",
                        "Long-term (10+ years): Growth-oriented—higher equity allocation, ability to ride out volatility."
                    ]},
                    { type: 'heading', text: "Risk Tolerance Assessment" },
                    { type: 'paragraph', text: "Be honest about your ability and willingness to endure losses. Risk tolerance has two components: ability to take risk (financial capacity to recover from losses) and willingness to take risk (emotional comfort with volatility). A mismatch leads to poor decisions during market stress." }
                ]
            },
            {
                id: "m5c2",
                title: "Asset Allocation",
                estimatedMinutes: 35,
                content: [
                    { type: 'paragraph', text: "Asset allocation is the single most important decision in portfolio construction, explaining the majority of long-term performance differences. It's about spreading investments across uncorrelated asset classes to optimize risk-adjusted returns." },
                    { type: 'heading', text: "The Core-Satellite Approach" },
                    { type: 'paragraph', text: "Build your portfolio with a stable core of diversified index funds, then add satellite positions in individual stocks or sectors where you have conviction. This balances reliability with the potential for outperformance." },
                    { type: 'list', items: [
                        "Core (60-80%): Broad market ETFs (VTI, VXUS), bond funds (BND), providing market exposure at low cost.",
                        "Satellite (20-40%): Individual stocks, sector ETFs, or thematic bets reflecting your research and convictions."
                    ]},
                    { type: 'heading', text: "Strategic vs. Tactical Allocation" },
                    { type: 'paragraph', text: "Strategic allocation is your long-term target based on goals and risk tolerance. Tactical allocation involves temporary deviations based on market conditions. Be cautious—tactical moves often hurt more than help due to timing difficulties." },
                    { type: 'heading', text: "Common Allocation Models" },
                    { type: 'list', items: [
                        "Age in Bonds: Simple rule—your bond percentage equals your age. Conservative but reduces equity exposure perhaps too quickly.",
                        "60/40 Portfolio: Classic balanced allocation—60% stocks, 40% bonds. Historically provided solid returns with moderate volatility.",
                        "Risk Parity: Allocates based on risk contribution rather than capital, typically requiring leverage to achieve equity-like returns."
                    ]},
                    { type: 'note', text: "Diversification is the only free lunch in investing. Assets that don't move in perfect lockstep reduce overall portfolio volatility without sacrificing expected returns." }
                ]
            },
            {
                id: "m5c3",
                title: "Position Sizing & Risk Management",
                estimatedMinutes: 30,
                content: [
                    { type: 'paragraph', text: "How much you invest in each position matters as much as what you invest in. Proper position sizing protects against catastrophic losses while allowing winners to meaningfully impact performance." },
                    { type: 'heading', text: "Position Sizing Methods" },
                    { type: 'list', items: [
                        "Equal Weighting: Divide portfolio equally among positions. Simple, but can lead to excessive concentration if you have few holdings.",
                        "Market Cap Weighting: Larger companies get larger allocations. Passive and self-rebalancing, but concentrates in big tech.",
                        "Conviction Weighting: Size positions by confidence level. Highest conviction gets largest allocation.",
                        "Kelly Criterion: Mathematical formula for optimal bet sizing based on win rate and payoff. Often produces aggressive sizes; many use 'half-Kelly' instead."
                    ]},
                    { type: 'heading', text: "The 5/10/40 Rule" },
                    { type: 'paragraph', text: "A common guideline for individual stock positions: No position smaller than 5% (otherwise too small to matter), no position larger than 10% (concentration risk), and no sector larger than 40% (sector risk)." },
                    { type: 'heading', text: "Portfolio-Level Risk Controls" },
                    { type: 'list', items: [
                        "Maximum Drawdown Limit: Predetermined point where you reduce exposure (e.g., portfolio down 20% from peak).",
                        "Volatility Targeting: Adjust total exposure to maintain target volatility level, reducing leverage when markets are turbulent.",
                        "Correlation Monitoring: Watch for correlations spiking toward 1 during crises—diversification may fail when you need it most."
                    ]}
                ]
            },
            {
                id: "m5c4",
                title: "Rebalancing & Tax Management",
                estimatedMinutes: 30,
                content: [
                    { type: 'paragraph', text: "Maintenance is as important as initial construction. Rebalancing keeps your allocation aligned with targets, while tax management maximizes after-tax returns." },
                    { type: 'heading', text: "Rebalancing Strategies" },
                    { type: 'paragraph', text: "Over time, winning positions grow and losing positions shrink, causing drift from target allocation. Rebalancing restores targets and enforces buy-low-sell-high discipline." },
                    { type: 'list', items: [
                        "Time-Based: Rebalance at set intervals (quarterly, annually). Simple but may rebalance unnecessarily in trending markets.",
                        "Threshold-Based: Rebalance when allocations drift beyond bands (e.g., ±5% from target). More responsive to market moves.",
                        "Cash Flow: Use new contributions and withdrawals to rebalance without selling. Most tax-efficient method."
                    ]},
                    { type: 'heading', text: "Tax-Efficient Investing" },
                    { type: 'paragraph', text: "Tax drag can cost 1-2% annually—compounding to significant differences over decades. Structure your portfolio to minimize taxes." },
                    { type: 'list', items: [
                        "Asset Location: Place tax-inefficient assets (bonds, REITs) in tax-advantaged accounts. Put tax-efficient assets (index funds) in taxable accounts.",
                        "Tax-Loss Harvesting: Sell losers to offset gains, maintaining exposure through similar (but not identical) securities.",
                        "Holding Period Management: Hold winners beyond one year for favorable long-term capital gains rates."
                    ]},
                    { type: 'note', text: "Tax-advantaged accounts (401k, IRA, Roth) are powerful wealth-building tools. Maximize contributions before investing in taxable accounts." }
                ]
            },
            {
                id: "m5c5",
                title: "Behavioral Finance",
                estimatedMinutes: 30,
                content: [
                    { type: 'paragraph', text: "Markets are driven by human emotion as much as fundamentals. Understanding cognitive biases helps you recognize and counteract irrational tendencies that destroy returns." },
                    { type: 'heading', text: "Common Cognitive Biases" },
                    { type: 'list', items: [
                        "Confirmation Bias: Seeking information that confirms existing beliefs while ignoring contradictory evidence. You become blind to risks in your favorite stocks.",
                        "Recency Bias: Overweighting recent events when predicting the future. After a crash, we expect more crashes; after a rally, we expect endless gains.",
                        "Loss Aversion: Feeling losses roughly twice as intensely as equivalent gains. Leads to holding losers too long (hoping to break even) and selling winners too early (fearing losses).",
                        "Overconfidence: Overestimating our knowledge and abilities after a few successes. Often leads to excessive trading and concentration."
                    ]},
                    { type: 'heading', text: "Emotional Traps" },
                    { type: 'list', items: [
                        "FOMO (Fear Of Missing Out): Buying at peaks because 'everyone is getting rich.' Often results in buying high and selling low.",
                        "Panic Selling: Dumping quality assets at market bottoms due to fear. Realizes temporary losses as permanent ones.",
                        "Revenge Trading: Increasing position sizes after losses to 'make it back quickly.' Compounds errors and can lead to ruin.",
                        "Analysis Paralysis: Over-researching to the point of never acting. Opportunity cost of sitting in cash often exceeds potential losses from informed decisions."
                    ]},
                    { type: 'heading', text: "Building Behavioral Defenses" },
                    { type: 'paragraph', text: "Create systems that remove emotion from decisions. Set predetermined rules for buying and selling. Use automatic investing to remove timing decisions. Keep a trading journal to review decisions objectively. Consider an accountability partner or advisor who can provide perspective when emotions run high." },
                    { type: 'note', text: "The best investment strategy is one you can stick with through market cycles. A mediocre strategy followed consistently beats a perfect strategy abandoned during the inevitable rough periods." }
                ]
            }
        ]
    }
];

// --- COURSE PROGRESS UTILITIES ---

export const getTotalChapters = () => {
    return learningModules.reduce((total, module) => total + module.chapters.length, 0);
};

export const getModuleChapterCount = (moduleId) => {
    const module = learningModules.find(m => m.id === moduleId);
    return module ? module.chapters.length : 0;
};

export const getChapterById = (moduleId, chapterId) => {
    const module = learningModules.find(m => m.id === moduleId);
    return module ? module.chapters.find(c => c.id === chapterId) : null;
};

export const getEstimatedCourseTime = () => {
    return learningModules.reduce((total, module) => total + (module.estimatedMinutes || 0), 0);
};