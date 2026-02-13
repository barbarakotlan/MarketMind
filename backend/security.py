"""
Security utilities for MarketMind API
Provides input validation, sanitization, and rate limiting
"""
import re
from functools import wraps
from flask import request, jsonify
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# Ticker validation pattern (1-5 uppercase letters/numbers, optional dash/dot)
TICKER_PATTERN = re.compile(r'^[A-Z0-9][A-Z0-9\.\-]{0,4}$')

# Currency code pattern (3 uppercase letters)
CURRENCY_PATTERN = re.compile(r'^[A-Z]{3}$')

# Commodity futures pattern (1-5 chars + optional =F suffix)
COMMODITY_PATTERN = re.compile(r'^[A-Z]{1,5}(=F)?$')


def validate_ticker(ticker):
    """
    Validate stock ticker format
    
    Args:
        ticker: Stock ticker symbol
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    if not ticker:
        return False, "Ticker is required"
    
    ticker = ticker.upper().strip()
    
    if len(ticker) > 10:
        return False, "Ticker must be 10 characters or less"
    
    if not re.match(r'^[A-Z0-9\.\-\=]+$', ticker):
        return False, "Ticker contains invalid characters"
    
    return True, None


def validate_currency_code(code):
    """
    Validate currency code format
    
    Args:
        code: Currency code (e.g., USD, EUR)
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    if not code:
        return False, "Currency code is required"
    
    code = code.upper().strip()
    
    if not CURRENCY_PATTERN.match(code):
        return False, "Invalid currency code format (must be 3 letters)"
    
    return True, None


def validate_commodity_code(code):
    """
    Validate commodity futures code format
    
    Args:
        code: Commodity code (e.g., CL=F, GC=F)
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    if not code:
        return False, "Commodity code is required"
    
    code = code.upper().strip()
    
    if not COMMODITY_PATTERN.match(code):
        return False, "Invalid commodity code format"
    
    return True, None


def validate_integer(value, field_name, min_value=None, max_value=None):
    """
    Validate integer parameter
    
    Args:
        value: Value to validate
        field_name: Name of field for error messages
        min_value: Minimum allowed value
        max_value: Maximum allowed value
        
    Returns:
        Tuple of (is_valid, error_message, parsed_value)
    """
    try:
        parsed = int(value)
        
        if min_value is not None and parsed < min_value:
            return False, f"{field_name} must be at least {min_value}", None
        
        if max_value is not None and parsed > max_value:
            return False, f"{field_name} must be at most {max_value}", None
        
        return True, None, parsed
    
    except (ValueError, TypeError):
        return False, f"{field_name} must be a valid integer", None


def validate_float(value, field_name, min_value=None, max_value=None):
    """
    Validate float parameter
    
    Args:
        value: Value to validate
        field_name: Name of field for error messages
        min_value: Minimum allowed value
        max_value: Maximum allowed value
        
    Returns:
        Tuple of (is_valid, error_message, parsed_value)
    """
    try:
        parsed = float(value)
        
        if min_value is not None and parsed < min_value:
            return False, f"{field_name} must be at least {min_value}", None
        
        if max_value is not None and parsed > max_value:
            return False, f"{field_name} must be at most {max_value}", None
        
        return True, None, parsed
    
    except (ValueError, TypeError):
        return False, f"{field_name} must be a valid number", None


def sanitize_ticker(ticker):
    """
    Sanitize ticker input
    
    Args:
        ticker: Raw ticker input
        
    Returns:
        Sanitized ticker string
    """
    if not ticker:
        return ""
    
    # Convert to uppercase and strip whitespace
    sanitized = str(ticker).upper().strip()
    
    # Remove any potentially dangerous characters (but keep =, -, .)
    sanitized = re.sub(r'[^A-Z0-9\.\-\=]', '', sanitized)
    
    return sanitized


def validate_request_json(required_fields):
    """
    Decorator to validate JSON request body
    
    Args:
        required_fields: List of required field names
        
    Returns:
        Decorator function
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not request.is_json:
                return jsonify({"error": "Request must be JSON"}), 400
            
            data = request.get_json()
            
            # Check for required fields
            missing_fields = [field for field in required_fields if field not in data]
            if missing_fields:
                return jsonify({
                    "error": f"Missing required fields: {', '.join(missing_fields)}"
                }), 400
            
            return f(*args, **kwargs)
        
        return decorated_function
    return decorator


def validate_query_params(param_validators):
    """
    Decorator to validate query parameters
    
    Args:
        param_validators: Dict of {param_name: validator_function}
        
    Returns:
        Decorator function
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            errors = []
            
            for param_name, validator in param_validators.items():
                value = request.args.get(param_name)
                if value is not None:
                    is_valid, error = validator(value)
                    if not is_valid:
                        errors.append(error)
            
            if errors:
                return jsonify({"error": "; ".join(errors)}), 400
            
            return f(*args, **kwargs)
        
        return decorated_function
    return decorator


def setup_rate_limiting(app):
    """
    Setup rate limiting for Flask app
    
    Args:
        app: Flask application instance
        
    Returns:
        Limiter instance
    """
    limiter = Limiter(
        get_remote_address,
        app=app,
        default_limits=["200 per hour", "50 per minute"],
        storage_uri="memory://",
        strategy="fixed-window",
        headers_enabled=True
    )
    
    return limiter


# Rate limit tiers for different endpoint types
class RateLimits:
    """Rate limit configurations for different endpoint types"""
    
    # Light endpoints (lists, static data)
    LIGHT = "100 per minute"
    
    # Standard endpoints (stock data, predictions)
    STANDARD = "50 per minute"
    
    # Heavy endpoints (ML evaluation, backtesting)
    HEAVY = "10 per minute"
    
    # Write operations (paper trading, watchlist)
    WRITE = "20 per minute"


# Common validation functions for decorators
def ticker_validator(ticker):
    """Validator for ticker parameters"""
    return validate_ticker(ticker)


def currency_validator(code):
    """Validator for currency code parameters"""
    return validate_currency_code(code)


def positive_integer_validator(value):
    """Validator for positive integers"""
    is_valid, error, _ = validate_integer(value, "Value", min_value=1)
    return is_valid, error


if __name__ == "__main__":
    # Test validation functions
    print("Testing ticker validation:")
    print(validate_ticker("AAPL"))      # Valid
    print(validate_ticker("TSLA"))      # Valid
    print(validate_ticker("CL=F"))      # Valid
    print(validate_ticker("ABC123"))    # Invalid
    print(validate_ticker(""))          # Invalid
    
    print("\nTesting currency validation:")
    print(validate_currency_code("USD"))    # Valid
    print(validate_currency_code("EUR"))    # Valid
    print(validate_currency_code("USDD"))   # Invalid
    print(validate_currency_code("US"))     # Invalid
    
    print("\nTesting commodity validation:")
    print(validate_commodity_code("CL=F"))  # Valid
    print(validate_commodity_code("GC=F"))  # Valid
    print(validate_commodity_code("NG"))    # Valid
    print(validate_commodity_code("ABC123=F"))  # Invalid
    
    print("\nTesting integer validation:")
    print(validate_integer("10", "days", min_value=1, max_value=100))  # Valid
    print(validate_integer("0", "days", min_value=1))   # Invalid (too small)
    print(validate_integer("abc", "days"))              # Invalid (not int)
    
    print("\nTesting ticker sanitization:")
    print(repr(sanitize_ticker("  aapl  ")))      # "AAPL"
    print(repr(sanitize_ticker("ts<script>la")))  # "TSLA"
    print(repr(sanitize_ticker("CL=F")))          # "CL=F"
