"""
Database configuration and models for MarketMind
Uses SQLAlchemy ORM with SQLite for development
"""
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import json

# Initialize SQLAlchemy
db = SQLAlchemy()

# Association table for many-to-many relationship between users and watchlists
watchlist_items = db.Table(
    'watchlist_items',
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'), primary_key=True),
    db.Column('watchlist_id', db.Integer, db.ForeignKey('watchlist.id'), primary_key=True),
    db.Column('added_at', db.DateTime, default=datetime.utcnow)
)


class User(db.Model):
    """User model for storing user information"""
    __tablename__ = 'user'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    
    # Relationships
    portfolios = db.relationship('Portfolio', backref='user', lazy=True, cascade='all, delete-orphan')
    watchlists = db.relationship('Watchlist', secondary=watchlist_items, backref='users', lazy=True)
    alerts = db.relationship('Alert', backref='user', lazy=True, cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<User {self.username}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'created_at': self.created_at.isoformat(),
            'is_active': self.is_active
        }


class Watchlist(db.Model):
    """Watchlist model for storing stock watchlists"""
    __tablename__ = 'watchlist'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    is_public = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Store tickers as JSON string for simplicity
    tickers = db.Column(db.Text, default='[]')  # JSON array of tickers
    
    def __repr__(self):
        return f'<Watchlist {self.name}>'
    
    def get_tickers(self):
        """Get tickers as Python list"""
        return json.loads(self.tickers) if self.tickers else []
    
    def set_tickers(self, tickers):
        """Set tickers from Python list"""
        self.tickers = json.dumps(tickers)
    
    def add_ticker(self, ticker):
        """Add ticker to watchlist"""
        tickers = self.get_tickers()
        if ticker.upper() not in tickers:
            tickers.append(ticker.upper())
            self.set_tickers(tickers)
    
    def remove_ticker(self, ticker):
        """Remove ticker from watchlist"""
        tickers = self.get_tickers()
        if ticker.upper() in tickers:
            tickers.remove(ticker.upper())
            self.set_tickers(tickers)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'is_public': self.is_public,
            'created_at': self.created_at.isoformat(),
            'tickers': self.get_tickers()
        }


class Portfolio(db.Model):
    """Portfolio model for storing user portfolios"""
    __tablename__ = 'portfolio'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    starting_cash = db.Column(db.Float, default=10000.0)
    current_cash = db.Column(db.Float, default=10000.0)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Foreign key
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    
    # Relationships
    positions = db.relationship('Position', backref='portfolio', lazy=True, cascade='all, delete-orphan')
    trades = db.relationship('Trade', backref='portfolio', lazy=True, cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<Portfolio {self.name}>'
    
    def get_total_value(self):
        """Calculate total portfolio value including positions"""
        total = self.current_cash
        for position in self.positions:
            total += position.get_market_value()
        return total
    
    def get_total_cost(self):
        """Calculate total cost basis of all positions"""
        return sum(position.get_cost_basis() for position in self.positions)
    
    def get_total_pnl(self):
        """Calculate total P&L"""
        return self.get_total_value() - self.starting_cash
    
    def get_pnl_percentage(self):
        """Calculate P&L as percentage"""
        if self.starting_cash == 0:
            return 0
        return (self.get_total_pnl() / self.starting_cash) * 100
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'starting_cash': self.starting_cash,
            'current_cash': self.current_cash,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'total_value': self.get_total_value(),
            'total_cost': self.get_total_cost(),
            'total_pnl': self.get_total_pnl(),
            'pnl_percentage': self.get_pnl_percentage(),
            'positions_count': len(self.positions),
            'trades_count': len(self.trades)
        }


class Position(db.Model):
    """Position model for storing portfolio positions"""
    __tablename__ = 'position'
    
    id = db.Column(db.Integer, primary_key=True)
    ticker = db.Column(db.String(10), nullable=False)
    shares = db.Column(db.Float, nullable=False)
    avg_cost = db.Column(db.Float, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Foreign key
    portfolio_id = db.Column(db.Integer, db.ForeignKey('portfolio.id'), nullable=False)
    
    def __repr__(self):
        return f'<Position {self.ticker} {self.shares}>'
    
    def get_cost_basis(self):
        """Calculate cost basis of position"""
        return self.shares * self.avg_cost
    
    def get_market_value(self):
        """Get current market value (would need real-time price)"""
        # This would integrate with yfinance for current price
        # For now, return cost basis
        return self.get_cost_basis()
    
    def get_pnl(self):
        """Calculate P&L for position"""
        return self.get_market_value() - self.get_cost_basis()
    
    def get_pnl_percentage(self):
        """Calculate P&L as percentage"""
        if self.avg_cost == 0:
            return 0
        return ((self.get_market_value() / self.get_cost_basis()) - 1) * 100
    
    def to_dict(self):
        return {
            'id': self.id,
            'ticker': self.ticker,
            'shares': self.shares,
            'avg_cost': self.avg_cost,
            'cost_basis': self.get_cost_basis(),
            'market_value': self.get_market_value(),
            'pnl': self.get_pnl(),
            'pnl_percentage': self.get_pnl_percentage(),
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }


class Trade(db.Model):
    """Trade model for storing trade history"""
    __tablename__ = 'trade'
    
    id = db.Column(db.Integer, primary_key=True)
    ticker = db.Column(db.String(10), nullable=False)
    trade_type = db.Column(db.String(4), nullable=False)  # 'BUY' or 'SELL'
    shares = db.Column(db.Float, nullable=False)
    price = db.Column(db.Float, nullable=False)
    total = db.Column(db.Float, nullable=False)
    fees = db.Column(db.Float, default=0.0)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Foreign key
    portfolio_id = db.Column(db.Integer, db.ForeignKey('portfolio.id'), nullable=False)
    
    def __repr__(self):
        return f'<Trade {self.trade_type} {self.ticker} {self.shares}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'ticker': self.ticker,
            'trade_type': self.trade_type,
            'shares': self.shares,
            'price': self.price,
            'total': self.total,
            'fees': self.fees,
            'notes': self.notes,
            'created_at': self.created_at.isoformat()
        }


class Alert(db.Model):
    """Alert model for storing price alerts"""
    __tablename__ = 'alert'
    
    id = db.Column(db.Integer, primary_key=True)
    ticker = db.Column(db.String(10), nullable=False)
    alert_type = db.Column(db.String(20), nullable=False)  # 'PRICE', 'PERCENTAGE', 'VOLUME'
    condition = db.Column(db.String(10), nullable=False)  # 'ABOVE', 'BELOW'
    target_value = db.Column(db.Float, nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    is_triggered = db.Column(db.Boolean, default=False)
    triggered_at = db.Column(db.DateTime)
    expires_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Foreign key
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    
    def __repr__(self):
        return f'<Alert {self.ticker} {self.condition} {self.target_value}>'
    
    def check_trigger(self, current_value):
        """Check if alert should be triggered"""
        if not self.is_active or self.is_triggered:
            return False
        
        if self.condition == 'ABOVE' and current_value >= self.target_value:
            return True
        elif self.condition == 'BELOW' and current_value <= self.target_value:
            return True
        
        return False
    
    def trigger(self):
        """Mark alert as triggered"""
        self.is_triggered = True
        self.triggered_at = datetime.utcnow()
        self.is_active = False
    
    def to_dict(self):
        return {
            'id': self.id,
            'ticker': self.ticker,
            'alert_type': self.alert_type,
            'condition': self.condition,
            'target_value': self.target_value,
            'is_active': self.is_active,
            'is_triggered': self.is_triggered,
            'triggered_at': self.triggered_at.isoformat() if self.triggered_at else None,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'created_at': self.created_at.isoformat()
        }


class PortfolioHistory(db.Model):
    """Portfolio history for tracking performance over time"""
    __tablename__ = 'portfolio_history'
    
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, nullable=False)
    total_value = db.Column(db.Float, nullable=False)
    cash_balance = db.Column(db.Float, nullable=False)
    positions_value = db.Column(db.Float, nullable=False)
    total_pnl = db.Column(db.Float, nullable=False)
    pnl_percentage = db.Column(db.Float, nullable=False)
    
    # Foreign key
    portfolio_id = db.Column(db.Integer, db.ForeignKey('portfolio.id'), nullable=False)
    
    # Unique constraint to prevent duplicate entries for same date
    __table_args__ = (
        db.UniqueConstraint('portfolio_id', 'date', name='unique_portfolio_date'),
    )
    
    def __repr__(self):
        return f'<PortfolioHistory {self.portfolio_id} {self.date} {self.total_value}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'date': self.date.isoformat(),
            'total_value': self.total_value,
            'cash_balance': self.cash_balance,
            'positions_value': self.positions_value,
            'total_pnl': self.total_pnl,
            'pnl_percentage': self.pnl_percentage
        }


# Database initialization and helper functions
def init_database(app):
    """Initialize database with app context"""
    with app.app_context():
        db.create_all()
        print("✅ Database tables created successfully")


def create_default_user():
    """Create default user for development"""
    from logger_config import setup_logger
    logger = setup_logger(__name__)
    
    # Check if default user exists
    default_user = User.query.filter_by(username='demo').first()
    
    if not default_user:
        # Create default user
        default_user = User(
            username='demo',
            email='demo@marketmind.com'
        )
        db.session.add(default_user)
        db.session.commit()
        logger.info("✅ Created default demo user")
        
        # Create default portfolio
        default_portfolio = Portfolio(
            name='Demo Portfolio',
            description='Default portfolio for demo user',
            starting_cash=10000.0,
            current_cash=10000.0,
            user_id=default_user.id
        )
        db.session.add(default_portfolio)
        db.session.commit()
        logger.info("✅ Created default demo portfolio")
        
        # Create default watchlist
        default_watchlist = Watchlist(
            name='Demo Watchlist',
            description='Default watchlist with popular stocks',
            is_public=True
        )
        default_watchlist.set_tickers(['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN'])
        db.session.add(default_watchlist)
        db.session.commit()
        
        # Add watchlist to user
        default_user.watchlists.append(default_watchlist)
        db.session.commit()
        logger.info("✅ Created default demo watchlist")
        
        return default_user
    
    return default_user


def get_or_create_user_portfolio(user_id, portfolio_name=None):
    """Get existing portfolio or create new one"""
    user = User.query.get(user_id)
    if not user:
        return None
    
    # Try to get existing portfolio
    if portfolio_name:
        portfolio = Portfolio.query.filter_by(user_id=user_id, name=portfolio_name).first()
        if portfolio:
            return portfolio
    
    # Create new portfolio
    portfolio = Portfolio(
        name=portfolio_name or 'Default Portfolio',
        starting_cash=10000.0,
        current_cash=10000.0,
        user_id=user_id
    )
    db.session.add(portfolio)
    db.session.commit()
    
    return portfolio


def update_portfolio_history(portfolio_id):
    """Update portfolio history for current date"""
    from logger_config import setup_logger
    logger = setup_logger(__name__)
    
    portfolio = Portfolio.query.get(portfolio_id)
    if not portfolio:
        return
    
    # Check if history already exists for today
    today = datetime.utcnow().date()
    existing = PortfolioHistory.query.filter_by(
        portfolio_id=portfolio_id,
        date=today
    ).first()
    
    if existing:
        # Update existing record
        existing.total_value = portfolio.get_total_value()
        existing.cash_balance = portfolio.current_cash
        existing.positions_value = portfolio.get_total_value() - portfolio.current_cash
        existing.total_pnl = portfolio.get_total_pnl()
        existing.pnl_percentage = portfolio.get_pnl_percentage()
    else:
        # Create new record
        history = PortfolioHistory(
            portfolio_id=portfolio_id,
            date=today,
            total_value=portfolio.get_total_value(),
            cash_balance=portfolio.current_cash,
            positions_value=portfolio.get_total_value() - portfolio.current_cash,
            total_pnl=portfolio.get_total_pnl(),
            pnl_percentage=portfolio.get_pnl_percentage()
        )
        db.session.add(history)
    
    db.session.commit()
    logger.info(f"✅ Updated portfolio history for portfolio {portfolio_id}")
