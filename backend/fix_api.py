#!/usr/bin/env python3
"""
Fix the API file to ensure proper environment variable usage
"""
import re
import os

# Read the file
with open('api.py', 'r') as f:
    content = f.read()

# Ensure environment variables are used (no hardcoded keys)
# This is a configuration check script, not a key injector

# Verify API keys are loaded from environment
if 'ALPHA_VANTAGE_API_KEY = os.getenv' not in content:
    print("WARNING: ALPHA_VANTAGE_API_KEY should use os.getenv")
else:
    print("✓ ALPHA_VANTAGE_API_KEY uses environment variable")

if 'NEWS_API_KEY = os.getenv' not in content:
    print("WARNING: NEWS_API_KEY should use os.getenv")
else:
    print("✓ NEWS_API_KEY uses environment variable")

print("\nSecurity check complete. Ensure .env file is configured.")
