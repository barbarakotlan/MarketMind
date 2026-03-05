#!/usr/bin/env python3
"""
Security Check Script for MarketMind
Run this script to verify security configurations before deployment
"""

import os
import sys

def check_environment_variables():
    """Check if required environment variables are set"""
    print("\n🔍 Checking Environment Variables...")
    print("=" * 50)
    
    required_vars = [
        ('FLASK_SECRET_KEY', 'critical'),
        ('ALPHA_VANTAGE_API_KEY', 'recommended'),
        ('NEWS_API_KEY', 'recommended'),
    ]
    
    missing_critical = []
    missing_recommended = []
    
    for var, level in required_vars:
        value = os.getenv(var)
        if value:
            masked = value[:4] + '*' * (len(value) - 4) if len(value) > 4 else '****'
            print(f"  ✓ {var}: {masked}")
        else:
            print(f"  ✗ {var}: NOT SET")
            if level == 'critical':
                missing_critical.append(var)
            else:
                missing_recommended.append(var)
    
    return missing_critical, missing_recommended

def check_hardcoded_secrets():
    """Scan for hardcoded secrets in Python files"""
    print("\n🔍 Scanning for Hardcoded Secrets...")
    print("=" * 50)
    
    suspicious_patterns = [
        'api_key',
        'apikey',
        'secret',
        'password',
        'token',
    ]
    
    found_issues = []
    
    for root, dirs, files in os.walk('.'):
        # Skip virtual environments and node_modules
        dirs[:] = [d for d in dirs if d not in ['venv', 'node_modules', '__pycache__', '.git']]
        
        for file in files:
            if file.endswith('.py'):
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()
                        lines = content.split('\n')
                        
                        for i, line in enumerate(lines, 1):
                            # Check for suspicious patterns with string literals
                            for pattern in suspicious_patterns:
                                if pattern in line.lower() and ('="' in line or "='" in line):
                                    # Skip os.getenv and environment variable usage
                                    if 'os.getenv' in line or 'os.environ' in line:
                                        continue
                                    # Skip comments
                                    if line.strip().startswith('#'):
                                        continue
                                    found_issues.append({
                                        'file': filepath,
                                        'line': i,
                                        'content': line.strip()
                                    })
                                    print(f"  ⚠️  {filepath}:{i}")
                                    print(f"     {line.strip()[:80]}")
                except Exception as e:
                    pass
    
    return found_issues

def check_cors_configuration():
    """Check CORS configuration"""
    print("\n🔍 Checking CORS Configuration...")
    print("=" * 50)
    
    cors_origins = os.getenv('CORS_ORIGINS', '')
    
    if not cors_origins:
        print("  ⚠️  CORS_ORIGINS not set - will use default localhost origins")
        print("     Set CORS_ORIGINS in production to restrict access")
        return False
    else:
        origins = [o.strip() for o in cors_origins.split(',')]
        print(f"  ✓ CORS_ORIGINS configured with {len(origins)} origin(s):")
        for origin in origins:
            print(f"     - {origin}")
        return True

def check_flask_environment():
    """Check Flask environment settings"""
    print("\n🔍 Checking Flask Environment...")
    print("=" * 50)
    
    env = os.getenv('FLASK_ENV', 'development')
    print(f"  FLASK_ENV: {env}")
    
    if env == 'production':
        secret_key = os.getenv('FLASK_SECRET_KEY')
        if not secret_key:
            print("  ✗ CRITICAL: FLASK_SECRET_KEY must be set in production!")
            return False
        else:
            print("  ✓ Production environment properly configured")
    else:
        print("  ℹ️  Running in development mode")
    
    return True

def main():
    """Run all security checks"""
    print("\n" + "=" * 60)
    print("🔒 MARKETMIND SECURITY CHECK")
    print("=" * 60)
    
    all_passed = True
    
    # Check environment variables
    missing_critical, missing_recommended = check_environment_variables()
    
    # Check for hardcoded secrets
    hardcoded_issues = check_hardcoded_secrets()
    
    # Check CORS
    cors_ok = check_cors_configuration()
    
    # Check Flask environment
    flask_ok = check_flask_environment()
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 SECURITY CHECK SUMMARY")
    print("=" * 60)
    
    if missing_critical:
        print(f"  ✗ CRITICAL: Missing environment variables: {', '.join(missing_critical)}")
        all_passed = False
    
    if missing_recommended:
        print(f"  ⚠️  RECOMMENDED: Missing environment variables: {', '.join(missing_recommended)}")
    
    if hardcoded_issues:
        print(f"  ✗ FOUND {len(hardcoded_issues)} potential hardcoded secrets")
        all_passed = False
    else:
        print("  ✓ No hardcoded secrets detected")
    
    if not cors_ok:
        print("  ⚠️  CORS not fully configured for production")
    
    if not flask_ok:
        all_passed = False
    
    print("\n" + "=" * 60)
    if all_passed:
        print("✅ SECURITY CHECK PASSED")
        print("=" * 60)
        return 0
    else:
        print("❌ SECURITY CHECK FAILED")
        print("=" * 60)
        print("\nPlease fix the issues above before deploying.")
        return 1

if __name__ == '__main__':
    sys.exit(main())
