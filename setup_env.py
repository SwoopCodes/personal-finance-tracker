#!/usr/bin/env python3
import secrets
import os
from pathlib import Path

# Generate secure key
secret_key = secrets.token_urlsafe(32)

# Write .env with explicit UTF-8 encoding
env_path = Path('.env')
env_content = f'SECRET_KEY="{secret_key}"\n'

# Write with UTF-8 encoding (works on all platforms)
with open(env_path, 'w', encoding='utf-8') as f:
    f.write(env_content)

print(f"✅ Created .env file with secure SECRET_KEY")
print(f"📝 Key: {secret_key}")
