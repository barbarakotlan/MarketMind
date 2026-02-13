"""
Centralized logging configuration for MarketMind backend
Provides structured logging with file rotation and console output
"""
import logging
import logging.handlers
import os
from datetime import datetime

# Create logs directory if it doesn't exist
LOGS_DIR = os.path.join(os.path.dirname(__file__), 'logs')
os.makedirs(LOGS_DIR, exist_ok=True)

# Log file paths
ERROR_LOG = os.path.join(LOGS_DIR, 'error.log')
INFO_LOG = os.path.join(LOGS_DIR, 'info.log')
DEBUG_LOG = os.path.join(LOGS_DIR, 'debug.log')

# Custom formatter with more details
class DetailedFormatter(logging.Formatter):
    """Custom formatter with timestamp, level, module, and message"""
    
    def format(self, record):
        # Add timestamp
        record.timestamp = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')
        
        # Color codes for console output
        colors = {
            'DEBUG': '\033[36m',    # Cyan
            'INFO': '\033[32m',     # Green
            'WARNING': '\033[33m',  # Yellow
            'ERROR': '\033[31m',    # Red
            'CRITICAL': '\033[35m'  # Magenta
        }
        reset = '\033[0m'
        
        # Add color for console output (not for file)
        if hasattr(self, 'use_color') and self.use_color:
            levelname = f"{colors.get(record.levelname, '')}{record.levelname}{reset}"
            record.levelname = levelname
        
        return super().format(record)


def setup_logger(name='marketmind', level=logging.INFO):
    """
    Setup centralized logger with file rotation and console output
    
    Args:
        name: Logger name
        level: Logging level (default: INFO)
    
    Returns:
        Configured logger instance
    """
    logger = logging.getLogger(name)
    logger.setLevel(level)
    
    # Clear any existing handlers
    logger.handlers = []
    
    # Format string
    log_format = '%(timestamp)s | %(levelname)-8s | %(name)s.%(funcName)s:%(lineno)d | %(message)s'
    
    # 1. Console Handler (with colors)
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_formatter = DetailedFormatter(log_format)
    console_formatter.use_color = True
    console_handler.setFormatter(console_formatter)
    logger.addHandler(console_handler)
    
    # 2. Info File Handler (rotating)
    info_handler = logging.handlers.RotatingFileHandler(
        INFO_LOG,
        maxBytes=10*1024*1024,  # 10MB
        backupCount=5
    )
    info_handler.setLevel(logging.INFO)
    info_handler.setFormatter(DetailedFormatter(log_format))
    logger.addHandler(info_handler)
    
    # 3. Error File Handler (rotating)
    error_handler = logging.handlers.RotatingFileHandler(
        ERROR_LOG,
        maxBytes=10*1024*1024,  # 10MB
        backupCount=5
    )
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(DetailedFormatter(log_format))
    logger.addHandler(error_handler)
    
    # 4. Debug File Handler (rotating) - only in debug mode
    if level == logging.DEBUG:
        debug_handler = logging.handlers.RotatingFileHandler(
            DEBUG_LOG,
            maxBytes=10*1024*1024,  # 10MB
            backupCount=3
        )
        debug_handler.setLevel(logging.DEBUG)
        debug_handler.setFormatter(DetailedFormatter(log_format))
        logger.addHandler(debug_handler)
    
    # Prevent log propagation to root logger
    logger.propagate = False
    
    return logger


def log_api_request(logger, endpoint, method, params=None, status='started'):
    """
    Log API request with consistent format
    
    Args:
        logger: Logger instance
        endpoint: API endpoint
        method: HTTP method
        params: Request parameters
        status: Request status
    """
    params_str = f" | Params: {params}" if params else ""
    logger.info(f"API {method} {endpoint} | Status: {status}{params_str}")


def log_api_error(logger, endpoint, error, ticker=None):
    """
    Log API error with context
    
    Args:
        logger: Logger instance
        endpoint: API endpoint
        error: Error message or exception
        ticker: Optional ticker symbol
    """
    ticker_str = f" | Ticker: {ticker}" if ticker else ""
    logger.error(f"API Error {endpoint}{ticker_str} | {str(error)}", exc_info=True)


def log_data_fetch(logger, source, ticker, status, details=None):
    """
    Log data fetching operations
    
    Args:
        logger: Logger instance
        source: Data source (yfinance, Alpha Vantage, etc.)
        ticker: Ticker symbol
        status: Fetch status (success, failed, cached)
        details: Additional details
    """
    details_str = f" | {details}" if details else ""
    logger.info(f"Data Fetch [{source}] {ticker} | Status: {status}{details_str}")


def log_model_prediction(logger, model_name, ticker, status, metrics=None):
    """
    Log ML model predictions
    
    Args:
        logger: Logger instance
        model_name: Name of ML model
        ticker: Ticker symbol
        status: Prediction status
        metrics: Optional prediction metrics
    """
    metrics_str = f" | Metrics: {metrics}" if metrics else ""
    logger.info(f"ML Prediction [{model_name}] {ticker} | Status: {status}{metrics_str}")


# Create default logger instance
default_logger = setup_logger()


if __name__ == "__main__":
    # Test the logging system
    test_logger = setup_logger('test', logging.DEBUG)
    
    test_logger.debug("This is a debug message")
    test_logger.info("This is an info message")
    test_logger.warning("This is a warning message")
    test_logger.error("This is an error message")
    test_logger.critical("This is a critical message")
    
    # Test helper functions
    log_api_request(test_logger, '/predict/AAPL', 'GET', {'days': 7}, 'started')
    log_data_fetch(test_logger, 'yfinance', 'AAPL', 'success', 'Fetched 100 rows')
    log_model_prediction(test_logger, 'Random Forest', 'AAPL', 'success', {'mae': 2.5})
    
    try:
        raise ValueError("Test exception")
    except Exception as e:
        log_api_error(test_logger, '/predict/AAPL', e, 'AAPL')
    
    print(f"\nLogs written to:")
    print(f"  - {INFO_LOG}")
    print(f"  - {ERROR_LOG}")
    print(f"  - {DEBUG_LOG}")
