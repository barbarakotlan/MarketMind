"""
Unit tests for security module
Tests input validation, sanitization, and security functions
"""
import unittest
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from security import (
    validate_ticker,
    validate_currency_code,
    validate_commodity_code,
    validate_integer,
    validate_float,
    sanitize_ticker
)


class TestTickerValidation(unittest.TestCase):
    """Test ticker validation function"""
    
    def test_valid_tickers(self):
        """Test valid ticker symbols"""
        valid_tickers = ['AAPL', 'TSLA', 'GOOGL', 'MSFT', 'BRK.B', 'CL=F', 'GC=F']
        for ticker in valid_tickers:
            is_valid, error = validate_ticker(ticker)
            self.assertTrue(is_valid, f"{ticker} should be valid but got error: {error}")
            self.assertIsNone(error)
    
    def test_invalid_tickers(self):
        """Test invalid ticker symbols"""
        # Empty ticker
        is_valid, error = validate_ticker('')
        self.assertFalse(is_valid)
        self.assertIsNotNone(error)
        
        # None ticker
        is_valid, error = validate_ticker(None)
        self.assertFalse(is_valid)
        self.assertIsNotNone(error)
        
        # Too long
        is_valid, error = validate_ticker('A' * 20)
        self.assertFalse(is_valid)
        self.assertIsNotNone(error)
        
        # Invalid characters
        is_valid, error = validate_ticker('ABC<script>')
        self.assertFalse(is_valid)
        self.assertIsNotNone(error)
    
    def test_sanitize_ticker(self):
        """Test ticker sanitization"""
        # Lowercase to uppercase
        self.assertEqual(sanitize_ticker('aapl'), 'AAPL')
        
        # Remove whitespace
        self.assertEqual(sanitize_ticker('  TSLA  '), 'TSLA')
        
        # Remove invalid characters (keeps only A-Z, 0-9, ., -, =)
        self.assertEqual(sanitize_ticker('AAPL<script>'), 'AAPLSCRIPT')
        
        # Preserve valid special chars
        self.assertEqual(sanitize_ticker('brk.b'), 'BRK.B')
        self.assertEqual(sanitize_ticker('cl=f'), 'CL=F')


class TestCurrencyValidation(unittest.TestCase):
    """Test currency code validation"""
    
    def test_valid_currencies(self):
        """Test valid currency codes"""
        valid_currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD']
        for currency in valid_currencies:
            is_valid, error = validate_currency_code(currency)
            self.assertTrue(is_valid, f"{currency} should be valid")
            self.assertIsNone(error)
    
    def test_invalid_currencies(self):
        """Test invalid currency codes"""
        # Too short
        is_valid, error = validate_currency_code('US')
        self.assertFalse(is_valid)
        
        # Too long
        is_valid, error = validate_currency_code('USDD')
        self.assertFalse(is_valid)
        
        # Empty
        is_valid, error = validate_currency_code('')
        self.assertFalse(is_valid)
        
        # Numbers
        is_valid, error = validate_currency_code('U2D')
        self.assertFalse(is_valid)


class TestCommodityValidation(unittest.TestCase):
    """Test commodity code validation"""
    
    def test_valid_commodities(self):
        """Test valid commodity codes"""
        valid_commodities = ['CL=F', 'GC=F', 'NG=F', 'SI=F', 'NG', 'CL']
        for commodity in valid_commodities:
            is_valid, error = validate_commodity_code(commodity)
            self.assertTrue(is_valid, f"{commodity} should be valid")
            self.assertIsNone(error)
    
    def test_invalid_commodities(self):
        """Test invalid commodity codes"""
        # Too long
        is_valid, error = validate_commodity_code('ABCDEF=F')
        self.assertFalse(is_valid)
        
        # Empty
        is_valid, error = validate_commodity_code('')
        self.assertFalse(is_valid)


class TestIntegerValidation(unittest.TestCase):
    """Test integer validation"""
    
    def test_valid_integers(self):
        """Test valid integer values"""
        is_valid, error, value = validate_integer('10', 'shares')
        self.assertTrue(is_valid)
        self.assertIsNone(error)
        self.assertEqual(value, 10)
        
        # With min/max
        is_valid, error, value = validate_integer('50', 'days', min_value=1, max_value=100)
        self.assertTrue(is_valid)
        self.assertEqual(value, 50)
    
    def test_invalid_integers(self):
        """Test invalid integer values"""
        # Not a number
        is_valid, error, value = validate_integer('abc', 'shares')
        self.assertFalse(is_valid)
        self.assertIsNotNone(error)
        self.assertIsNone(value)
        
        # Below minimum
        is_valid, error, value = validate_integer('0', 'shares', min_value=1)
        self.assertFalse(is_valid)
        self.assertIsNotNone(error)
        
        # Above maximum
        is_valid, error, value = validate_integer('200', 'days', max_value=100)
        self.assertFalse(is_valid)
        self.assertIsNotNone(error)


class TestFloatValidation(unittest.TestCase):
    """Test float validation"""
    
    def test_valid_floats(self):
        """Test valid float values"""
        is_valid, error, value = validate_float('10.5', 'price')
        self.assertTrue(is_valid)
        self.assertIsNone(error)
        self.assertEqual(value, 10.5)
        
        # With min/max
        is_valid, error, value = validate_float('99.99', 'price', min_value=0, max_value=100)
        self.assertTrue(is_valid)
        self.assertEqual(value, 99.99)
    
    def test_invalid_floats(self):
        """Test invalid float values"""
        # Not a number
        is_valid, error, value = validate_float('abc', 'price')
        self.assertFalse(is_valid)
        self.assertIsNotNone(error)
        
        # Below minimum
        is_valid, error, value = validate_float('-5', 'shares', min_value=0)
        self.assertFalse(is_valid)
        
        # Above maximum
        is_valid, error, value = validate_float('150', 'price', max_value=100)
        self.assertFalse(is_valid)


class TestSanitization(unittest.TestCase):
    """Test input sanitization"""
    
    def test_ticker_sanitization(self):
        """Test ticker sanitization removes dangerous characters"""
        # XSS attempt - removes < > ( ) characters
        self.assertEqual(sanitize_ticker('<script>alert(1)</script>'), 'SCRIPTALERT1SCRIPT')
        
        # SQL injection attempt - removes ' ; and space
        self.assertEqual(sanitize_ticker("AAPL'; DROP TABLE--"), 'AAPLDROPTABLE--')
        
        # Normal ticker unchanged (except uppercase)
        self.assertEqual(sanitize_ticker('aapl'), 'AAPL')
        
        # Preserve valid special characters
        self.assertEqual(sanitize_ticker('brk.b'), 'BRK.B')


def run_tests():
    """Run all tests and return results"""
    # Create test suite
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    # Add all test classes
    suite.addTests(loader.loadTestsFromTestCase(TestTickerValidation))
    suite.addTests(loader.loadTestsFromTestCase(TestCurrencyValidation))
    suite.addTests(loader.loadTestsFromTestCase(TestCommodityValidation))
    suite.addTests(loader.loadTestsFromTestCase(TestIntegerValidation))
    suite.addTests(loader.loadTestsFromTestCase(TestFloatValidation))
    suite.addTests(loader.loadTestsFromTestCase(TestSanitization))
    
    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # Print summary
    print("\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)
    print(f"Tests run: {result.testsRun}")
    print(f"Successes: {result.testsRun - len(result.failures) - len(result.errors)}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    print("="*70)
    
    return result.wasSuccessful()


if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
