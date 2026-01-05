#!/usr/bin/env python3
"""
bump-version.py
Patch version auto-increment and sync to all config files
Cross-platform compatible (Windows/Linux/macOS)
"""

import sys
import re
from pathlib import Path

def main():
    bump_type = sys.argv[1] if len(sys.argv) > 1 else "patch"
    
    if bump_type not in ("patch", "minor", "major"):
        print(f"ERROR: Invalid bump type: {bump_type} (expected patch|minor|major)", file=sys.stderr)
        sys.exit(1)
    
    project_root = Path(__file__).parent.parent
    version_file = project_root / "VERSION"
    
    if not version_file.exists():
        print(f"ERROR: VERSION file not found at {version_file}", file=sys.stderr)
        sys.exit(1)
    
    # Read current version
    current_version = version_file.read_text().strip()
    parts = current_version.split(".")
    
    if len(parts) != 3:
        print(f"ERROR: Invalid version format: {current_version} (expected X.Y.Z)", file=sys.stderr)
        sys.exit(1)
    
    major, minor, patch = int(parts[0]), int(parts[1]), int(parts[2])
    
    # Bump version
    if bump_type == "major":
        major += 1
        minor = 0
        patch = 0
    elif bump_type == "minor":
        minor += 1
        patch = 0
    else:  # patch
        patch += 1
    
    new_version = f"{major}.{minor}.{patch}"
    print(f"[VERSION] {current_version} -> {new_version} ({bump_type})")
    
    # Update VERSION file
    version_file.write_text(new_version)
    
    # Update package.json
    package_json = project_root / "package.json"
    if package_json.exists():
        content = package_json.read_text(encoding="utf-8")
        content = re.sub(r'"version"\s*:\s*"[^"]*"', f'"version": "{new_version}"', content)
        package_json.write_text(content, encoding="utf-8")
    
    # Update tauri.conf.json
    tauri_conf = project_root / "src-tauri" / "tauri.conf.json"
    if tauri_conf.exists():
        content = tauri_conf.read_text(encoding="utf-8")
        content = re.sub(r'"version"\s*:\s*"[^"]*"', f'"version": "{new_version}"', content)
        tauri_conf.write_text(content, encoding="utf-8")
    
    # Update Cargo.toml
    cargo_toml = project_root / "src-tauri" / "Cargo.toml"
    if cargo_toml.exists():
        content = cargo_toml.read_text(encoding="utf-8")
        content = re.sub(r'^version\s*=\s*"[^"]*"', f'version = "{new_version}"', content, flags=re.MULTILINE)
        cargo_toml.write_text(content, encoding="utf-8")
    
    print(f"[OK] Version updated to {new_version} in all files")

if __name__ == "__main__":
    main()
