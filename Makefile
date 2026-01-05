# Hololive Notifier - Makefile
# Build with mandatory lint checks and security audit

.PHONY: all check fmt lint audit test build dev clean install-tools help bump-version bump-patch bump-minor bump-major

# Default: bump version, full check, then build
all: bump-version check build

# === Version Management ===
bump-version:
	@echo "[VERSION] Auto-incrementing patch version..."
	@python scripts/bump-version.py patch

bump-patch:
	@python scripts/bump-version.py patch

bump-minor:
	@python scripts/bump-version.py minor

bump-major:
	@python scripts/bump-version.py major

# === Tool Installation ===
install-tools:
	@echo "[INSTALL] Rust development tools..."
	cargo install cargo-audit
	rustup component add clippy rustfmt
	@echo "[OK] Tools installed"

# === Code Quality Checks ===

# Format check (no modification)
fmt-check:
	@echo "[CHECK] rustfmt..."
	cd src-tauri && cargo fmt --check
	@echo "[OK] Format check passed"

# Apply formatting
fmt:
	@echo "[FMT] Applying rustfmt..."
	cd src-tauri && cargo fmt
	@echo "[OK] Formatting done"

# Clippy lint (warnings as errors)
lint:
	@echo "[LINT] Clippy..."
	cd src-tauri && cargo clippy --all-targets --all-features -- -D warnings
	@echo "[OK] Clippy passed"

# Security vulnerability audit
audit:
	@echo "[AUDIT] cargo-audit..."
	cd src-tauri && cargo audit
	@echo "[OK] Security audit passed"

# Full check (fmt + lint + audit)
check: fmt-check lint audit
	@echo "[OK] All checks passed"

# Fast check (no audit - for CI)
check-fast: fmt-check lint
	@echo "[OK] Fast check passed"

# === Tests ===
test:
	@echo "[TEST] Running tests..."
	cd src-tauri && cargo test
	@echo "[OK] Tests passed"

# === Build ===

# Dev build (with fast check)
dev: check-fast
	@echo "[DEV] Starting dev server..."
	npm run tauri dev

# Release build (with full check)
build: check
	@echo "[BUILD] Release build..."
	npm run tauri build
	@echo "[OK] Build complete"

# Rust only build (no checks, quick verify)
build-rust:
	@echo "[BUILD] Rust debug..."
	cd src-tauri && cargo build
	@echo "[OK] Rust build complete"

# Rust release build
build-rust-release:
	@echo "[BUILD] Rust release..."
	cd src-tauri && cargo build --release
	@echo "[OK] Rust release build complete"

# === Cleanup ===
clean:
	@echo "[CLEAN] Removing build artifacts..."
	cd src-tauri && cargo clean
	rm -rf dist
	@echo "[OK] Clean complete"

# === Frontend ===
frontend-lint:
	@echo "[LINT] Frontend ESLint..."
	npm run lint 2>/dev/null || echo "[WARN] ESLint not configured"

frontend-build:
	@echo "[BUILD] Frontend..."
	npm run build:frontend
	@echo "[OK] Frontend build complete"

# === CI/CD Targets ===

# CI full check (with tests)
ci: check test
	@echo "[OK] CI check complete"

# Pre-commit hook
pre-commit: fmt-check lint
	@echo "[OK] Pre-commit check passed"

# === Help ===
help:
	@echo "Hololive Notifier Makefile"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Main targets:"
	@echo "  all            - Bump version, full check, then build (default)"
	@echo "  dev            - Start dev server (with fast check)"
	@echo "  build          - Release build (with full check)"
	@echo "  check          - Full check (fmt + lint + audit)"
	@echo "  check-fast     - Fast check (no audit)"
	@echo ""
	@echo "Version management:"
	@echo "  bump-patch     - Increment patch version (0.1.0 -> 0.1.1)"
	@echo "  bump-minor     - Increment minor version (0.1.0 -> 0.2.0)"
	@echo "  bump-major     - Increment major version (0.1.0 -> 1.0.0)"
	@echo ""
	@echo "Individual checks:"
	@echo "  fmt-check      - Format check"
	@echo "  fmt            - Apply formatting"
	@echo "  lint           - Clippy check"
	@echo "  audit          - Security vulnerability audit"
	@echo "  test           - Run tests"
	@echo ""
	@echo "Other:"
	@echo "  install-tools  - Install dev tools"
	@echo "  clean          - Remove build artifacts"
	@echo "  ci             - CI full check"
	@echo "  pre-commit     - Pre-commit hook"

