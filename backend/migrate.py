"""
Database migration script for MarketMind
Handles database initialization, migrations, and seed data
"""
import os
import sys
from datetime import datetime, timedelta
import json

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from flask import Flask
from database import db, init_database, create_default_user, update_portfolio_history
from logger_config import setup_logger

logger = setup_logger('migrate')


def create_app():
    """Create Flask app for migration context"""
    app = Flask(__name__)
    
    # Database configuration
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///marketmind.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    # Initialize database
    db.init_app(app)
    
    return app


def reset_database():
    """Reset database - drop all tables and recreate"""
    logger.info("🔄 Resetting database...")
    
    app = create_app()
    with app.app_context():
        # Drop all tables
        db.drop_all()
        logger.info("🗑️  Dropped all tables")
        
        # Create all tables
        db.create_all()
        logger.info("✅ Created all tables")
        
        # Create default data
        create_default_user()
        logger.info("✅ Created default user and data")
        
        logger.info("🎉 Database reset complete!")


def init_database_with_seed():
    """Initialize database with seed data"""
    logger.info("🌱 Initializing database with seed data...")
    
    app = create_app()
    with app.app_context():
        # Create tables
        db.create_all()
        logger.info("✅ Created database tables")
        
        # Create default user
        default_user = create_default_user()
        
        # Create additional sample data
        create_sample_data(default_user)
        
        logger.info("🎉 Database initialized with seed data!")


def create_sample_data(default_user):
    """Create sample data for testing"""
    from database import Portfolio, Watchlist, Position, Trade, Alert
    
    # Create sample portfolio with some positions
    portfolio = Portfolio(
        name='Tech Portfolio',
        description='Focus on technology stocks',
        starting_cash=50000.0,
        current_cash=35000.0,
        user_id=default_user.id
    )
    db.session.add(portfolio)
    db.session.commit()
    
    # Add some positions
    positions = [
        {'ticker': 'AAPL', 'shares': 50, 'avg_cost': 150.0},
        {'ticker': 'GOOGL', 'shares': 20, 'avg_cost': 2800.0},
        {'ticker': 'MSFT', 'shares': 30, 'avg_cost': 300.0},
    ]
    
    for pos_data in positions:
        position = Position(
            ticker=pos_data['ticker'],
            shares=pos_data['shares'],
            avg_cost=pos_data['avg_cost'],
            portfolio_id=portfolio.id
        )
        db.session.add(position)
    
    # Add some trade history
    trades = [
        {'ticker': 'AAPL', 'type': 'BUY', 'shares': 50, 'price': 150.0, 'notes': 'Initial investment'},
        {'ticker': 'GOOGL', 'type': 'BUY', 'shares': 20, 'price': 2800.0, 'notes': 'Tech exposure'},
        {'ticker': 'MSFT', 'type': 'BUY', 'shares': 30, 'price': 300.0, 'notes': 'Cloud computing play'},
    ]
    
    for trade_data in trades:
        trade = Trade(
            ticker=trade_data['ticker'],
            trade_type=trade_data['type'],
            shares=trade_data['shares'],
            price=trade_data['price'],
            total=trade_data['shares'] * trade_data['price'],
            notes=trade_data['notes'],
            portfolio_id=portfolio.id
        )
        db.session.add(trade)
    
    # Create sample watchlists
    watchlists = [
        {
            'name': 'Growth Stocks',
            'description': 'High-growth technology stocks',
            'tickers': ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'NVDA', 'AMD', 'META']
        },
        {
            'name': 'Dividend Stocks',
            'description': 'Stable dividend-paying stocks',
            'tickers': ['JNJ', 'KO', 'PG', 'MCD', 'VZ', 'T', 'XOM']
        },
        {
            'name': 'ETFs',
            'description': 'Popular exchange-traded funds',
            'tickers': ['SPY', 'QQQ', 'VTI', 'VOO', 'IWM', 'EFA', 'GLD']
        }
    ]
    
    for wl_data in watchlists:
        watchlist = Watchlist(
            name=wl_data['name'],
            description=wl_data['description'],
            is_public=True
        )
        watchlist.set_tickers(wl_data['tickers'])
        db.session.add(watchlist)
        default_user.watchlists.append(watchlist)
    
    # Create sample alerts
    alerts = [
        {'ticker': 'AAPL', 'type': 'PRICE', 'condition': 'ABOVE', 'target': 200.0},
        {'ticker': 'TSLA', 'type': 'PERCENTAGE', 'condition': 'BELOW', 'target': -10.0},
        {'ticker': 'GOOGL', 'type': 'PRICE', 'condition': 'BELOW', 'target': 2500.0},
    ]
    
    for alert_data in alerts:
        alert = Alert(
            ticker=alert_data['ticker'],
            alert_type=alert_data['type'],
            condition=alert_data['condition'],
            target_value=alert_data['target'],
            user_id=default_user.id
        )
        db.session.add(alert)
    
    # Create portfolio history for last 30 days
    from database import PortfolioHistory
    import random
    
    base_value = portfolio.get_total_value()
    for i in range(30):
        date = datetime.utcnow().date() - timedelta(days=i)
        
        # Simulate portfolio value fluctuation
        variance = random.uniform(-0.05, 0.05)  # +/- 5% daily variance
        value = base_value * (1 + variance)
        
        # Check if history already exists
        existing = PortfolioHistory.query.filter_by(
            portfolio_id=portfolio.id,
            date=date
        ).first()
        
        if not existing:
            history = PortfolioHistory(
                portfolio_id=portfolio.id,
                date=date,
                total_value=value,
                cash_balance=portfolio.current_cash,
                positions_value=value - portfolio.current_cash,
                total_pnl=value - portfolio.starting_cash,
                pnl_percentage=((value / portfolio.starting_cash) - 1) * 100
            )
            db.session.add(history)
    
    db.session.commit()
    logger.info("✅ Created sample data")


def backup_database():
    """Backup database to JSON file"""
    logger.info("💾 Creating database backup...")
    
    app = create_app()
    with app.app_context():
        from database import User, Portfolio, Position, Trade, Watchlist, Alert, PortfolioHistory
        
        backup_data = {
            'timestamp': datetime.utcnow().isoformat(),
            'users': [],
            'portfolios': [],
            'positions': [],
            'trades': [],
            'watchlists': [],
            'alerts': [],
            'portfolio_history': []
        }
        
        # Backup users
        for user in User.query.all():
            backup_data['users'].append(user.to_dict())
        
        # Backup portfolios
        for portfolio in Portfolio.query.all():
            backup_data['portfolios'].append(portfolio.to_dict())
        
        # Backup positions
        for position in Position.query.all():
            backup_data['positions'].append(position.to_dict())
        
        # Backup trades
        for trade in Trade.query.all():
            backup_data['trades'].append(trade.to_dict())
        
        # Backup watchlists
        for watchlist in Watchlist.query.all():
            backup_data['watchlists'].append(watchlist.to_dict())
        
        # Backup alerts
        for alert in Alert.query.all():
            backup_data['alerts'].append(alert.to_dict())
        
        # Backup portfolio history
        for history in PortfolioHistory.query.all():
            backup_data['portfolio_history'].append(history.to_dict())
        
        # Save to file
        backup_file = f"backup_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
        with open(backup_file, 'w') as f:
            json.dump(backup_data, f, indent=2)
        
        logger.info(f"✅ Database backed up to {backup_file}")
        
        return backup_file


def restore_database(backup_file):
    """Restore database from JSON backup"""
    logger.info(f"🔄 Restoring database from {backup_file}...")
    
    if not os.path.exists(backup_file):
        logger.error(f"❌ Backup file {backup_file} not found")
        return False
    
    app = create_app()
    with app.app_context():
        from database import User, Portfolio, Position, Trade, Watchlist, Alert, PortfolioHistory
        
        # Load backup data
        with open(backup_file, 'r') as f:
            backup_data = json.load(f)
        
        # Clear existing data
        db.drop_all()
        db.create_all()
        
        # Restore data (in correct order to handle foreign keys)
        
        # Restore users
        for user_data in backup_data['users']:
            user = User(
                username=user_data['username'],
                email=user_data['email'],
                created_at=datetime.fromisoformat(user_data['created_at']),
                is_active=user_data['is_active']
            )
            db.session.add(user)
        
        db.session.commit()
        
        # Restore watchlists
        for wl_data in backup_data['watchlists']:
            watchlist = Watchlist(
                name=wl_data['name'],
                description=wl_data['description'],
                is_public=wl_data['is_public'],
                created_at=datetime.fromisoformat(wl_data['created_at'])
            )
            watchlist.set_tickers(wl_data['tickers'])
            db.session.add(watchlist)
        
        db.session.commit()
        
        # Restore portfolios
        for port_data in backup_data['portfolios']:
            portfolio = Portfolio(
                name=port_data['name'],
                description=port_data['description'],
                starting_cash=port_data['starting_cash'],
                current_cash=port_data['current_cash'],
                is_active=port_data['is_active'],
                created_at=datetime.fromisoformat(port_data['created_at']),
                updated_at=datetime.fromisoformat(port_data['updated_at']),
                user_id=port_data['user_id']
            )
            db.session.add(portfolio)
        
        db.session.commit()
        
        # Restore positions
        for pos_data in backup_data['positions']:
            position = Position(
                ticker=pos_data['ticker'],
                shares=pos_data['shares'],
                avg_cost=pos_data['avg_cost'],
                created_at=datetime.fromisoformat(pos_data['created_at']),
                updated_at=datetime.fromisoformat(pos_data['updated_at']),
                portfolio_id=pos_data['portfolio_id']
            )
            db.session.add(position)
        
        db.session.commit()
        
        # Restore trades
        for trade_data in backup_data['trades']:
            trade = Trade(
                ticker=trade_data['ticker'],
                trade_type=trade_data['trade_type'],
                shares=trade_data['shares'],
                price=trade_data['price'],
                total=trade_data['total'],
                fees=trade_data['fees'],
                notes=trade_data['notes'],
                created_at=datetime.fromisoformat(trade_data['created_at']),
                portfolio_id=trade_data['portfolio_id']
            )
            db.session.add(trade)
        
        db.session.commit()
        
        # Restore alerts
        for alert_data in backup_data['alerts']:
            alert = Alert(
                ticker=alert_data['ticker'],
                alert_type=alert_data['alert_type'],
                condition=alert_data['condition'],
                target_value=alert_data['target_value'],
                is_active=alert_data['is_active'],
                is_triggered=alert_data['is_triggered'],
                triggered_at=datetime.fromisoformat(alert_data['triggered_at']) if alert_data['triggered_at'] else None,
                expires_at=datetime.fromisoformat(alert_data['expires_at']) if alert_data['expires_at'] else None,
                created_at=datetime.fromisoformat(alert_data['created_at']),
                user_id=alert_data['user_id']
            )
            db.session.add(alert)
        
        db.session.commit()
        
        # Restore portfolio history
        for hist_data in backup_data['portfolio_history']:
            history = PortfolioHistory(
                portfolio_id=hist_data['portfolio_id'],
                date=datetime.fromisoformat(hist_data['date']).date(),
                total_value=hist_data['total_value'],
                cash_balance=hist_data['cash_balance'],
                positions_value=hist_data['positions_value'],
                total_pnl=hist_data['total_pnl'],
                pnl_percentage=hist_data['pnl_percentage']
            )
            db.session.add(history)
        
        db.session.commit()
        
        logger.info("✅ Database restored successfully")
        return True


def show_database_info():
    """Show database statistics and information"""
    app = create_app()
    with app.app_context():
        from database import User, Portfolio, Position, Trade, Watchlist, Alert, PortfolioHistory
        
        print("\n" + "="*60)
        print("📊 DATABASE INFORMATION")
        print("="*60)
        
        print(f"Users: {User.query.count()}")
        print(f"Portfolios: {Portfolio.query.count()}")
        print(f"Positions: {Position.query.count()}")
        print(f"Trades: {Trade.query.count()}")
        print(f"Watchlists: {Watchlist.query.count()}")
        print(f"Alerts: {Alert.query.count()}")
        print(f"Portfolio History Records: {PortfolioHistory.query.count()}")
        
        # Show sample data
        print("\n📋 SAMPLE DATA:")
        print("-" * 40)
        
        # Show users
        users = User.query.limit(3).all()
        for user in users:
            print(f"User: {user.username} ({user.email})")
            portfolios = Portfolio.query.filter_by(user_id=user.id).all()
            for portfolio in portfolios:
                print(f"  Portfolio: {portfolio.name} - ${portfolio.get_total_value():.2f}")
        
        # Show watchlists
        watchlists = Watchlist.query.limit(3).all()
        for wl in watchlists:
            print(f"Watchlist: {wl.name} - {len(wl.get_tickers())} tickers")
        
        print("="*60)


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='MarketMind Database Migration Tool')
    parser.add_argument('command', choices=[
        'init', 'reset', 'seed', 'backup', 'restore', 'info'
    ], help='Command to run')
    parser.add_argument('--file', help='File for backup/restore operations')
    
    args = parser.parse_args()
    
    if args.command == 'init':
        init_database_with_seed()
    elif args.command == 'reset':
        reset_database()
    elif args.command == 'seed':
        init_database_with_seed()
    elif args.command == 'backup':
        backup_database()
    elif args.command == 'restore':
        if not args.file:
            print("❌ Please specify backup file with --file")
            sys.exit(1)
        restore_database(args.file)
    elif args.command == 'info':
        show_database_info()
    else:
        print("❌ Unknown command")
        parser.print_help()
