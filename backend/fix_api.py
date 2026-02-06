#!/usr/bin/env python3
"""
Fix the API file to add ALPHA_VANTAGE_API_KEY
"""
import re

# Read the file
with open('api.py', 'r') as f:
    content = f.read()

# Find the position after CORS(app)
pattern = r"app = Flask\(__name__\)\nCORS\(app\)\n"
replacement = r"app = Flask(__name__)\nCORS(app)\n\n# --- CONFIGURATION ---\nNEWS_API_KEY = os.getenv('NEWS_API_KEY')\nALPHA_VANTAGE_API_KEY = '5V7UVP5V02D45MF1'\n"

# Replace the pattern
new_content = re.sub(pattern, replacement, content)

# Write back to file
with open('api.py', 'w') as f:
    f.write(new_content)

print("Fixed api.py")
