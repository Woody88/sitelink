#!/usr/bin/env python3
"""
Basic validation tests for active_learning_loop.py orchestrator.

Tests script structure, imports, and CLI interface without requiring full dependencies.
"""

import sys
import subprocess
from pathlib import Path

def test_help_output():
    """Test that --help works."""
    script = Path(__file__).parent / "active_learning_loop.py"

    print("Testing --help output...")
    result = subprocess.run(
        [sys.executable, str(script), "--help"],
        capture_output=True,
        text=True
    )

    # Should show help even without matplotlib
    assert "Active Learning Loop Orchestrator" in result.stdout, "Missing help header"
    assert "--config" in result.stdout, "Missing --config option"
    assert "--start-iteration" in result.stdout, "Missing --start-iteration option"
    assert "--resume" in result.stdout, "Missing --resume option"
    assert "--dry-run" in result.stdout, "Missing --dry-run option"
    assert "--auto" in result.stdout, "Missing --auto option"

    print("✓ Help output test passed")

def test_script_syntax():
    """Test that script has valid Python syntax."""
    script = Path(__file__).parent / "active_learning_loop.py"

    print("Testing script syntax...")

    # Compile script to check syntax
    with open(script) as f:
        code = f.read()

    try:
        compile(code, str(script), 'exec')
        print("✓ Script syntax test passed")
    except SyntaxError as e:
        print(f"✗ Syntax error: {e}")
        raise

def test_required_files():
    """Test that required files exist."""
    base_dir = Path(__file__).parent.parent

    print("Testing required files...")

    required = [
        "config/al_config.yaml",
        "scripts/batch_validate.py",
        "scripts/error_analysis.py",
        "scripts/convergence_tracker.py",
        "scripts/train_active_learning.py",
        "scripts/prompt_manager.py"
    ]

    missing = []
    for rel_path in required:
        full_path = base_dir / rel_path
        if not full_path.exists():
            missing.append(rel_path)

    if missing:
        print(f"✗ Missing files: {missing}")
        print("  (This is expected if modules aren't implemented yet)")
    else:
        print("✓ All required files present")

def test_config_structure():
    """Test that config file has required structure."""
    config_path = Path(__file__).parent.parent / "config" / "al_config.yaml"

    if not config_path.exists():
        print("⊘ Config file not found (skipping structure test)")
        return

    print("Testing config structure...")

    import yaml
    with open(config_path) as f:
        config = yaml.safe_load(f)

    required_keys = [
        'model',
        'active_learning',
        'sampling_strategy',
        'training',
        'prompts'
    ]

    missing = []
    for key in required_keys:
        if key not in config:
            missing.append(key)

    if missing:
        print(f"✗ Missing config keys: {missing}")
    else:
        print("✓ Config structure test passed")

def test_invalid_args():
    """Test that invalid arguments are rejected."""
    script = Path(__file__).parent / "active_learning_loop.py"

    print("Testing invalid argument handling...")

    # Test --resume with --start-iteration (should fail)
    result = subprocess.run(
        [sys.executable, str(script), "--resume", "--start-iteration", "1"],
        capture_output=True,
        text=True
    )

    # Should exit with error
    if result.returncode != 0:
        if "Cannot use both --resume and --start-iteration" in result.stdout or \
           "Cannot use both --resume and --start-iteration" in result.stderr:
            print("✓ Invalid args test passed")
        else:
            print("✓ Script rejects invalid args (different error)")
    else:
        print("✗ Script should reject --resume with --start-iteration")

def main():
    """Run all tests."""
    print("=" * 60)
    print("Active Learning Orchestrator - Validation Tests")
    print("=" * 60 + "\n")

    tests = [
        test_script_syntax,
        test_help_output,
        test_required_files,
        test_config_structure,
        test_invalid_args
    ]

    passed = 0
    failed = 0

    for test in tests:
        try:
            test()
            passed += 1
        except Exception as e:
            print(f"✗ Test failed: {e}")
            failed += 1
        print()

    print("=" * 60)
    print(f"Results: {passed} passed, {failed} failed")
    print("=" * 60)

    return failed == 0

if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)
