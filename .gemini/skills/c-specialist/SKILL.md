---
name: c-specialist
description: Expert guidance for C code development, structural integrity, and syntax verification. Use when dealing with complex C files, brace imbalances, or persistent compilation errors that suggest structural nesting issues.
---

# C Specialist

This skill provides robust workflows for maintaining C code quality and structural integrity.

## Core Workflows

### 1. Fixing Brace Imbalances & Structural Issues
When you encounter "invalid storage class" or "expected declaration" errors that suggest a brace mismatch:

1. **Format First**: Use `clang-format` to normalize indentation. This makes imbalances visually obvious.
   ```bash
   ./scripts/format.sh path/to/file.c
   ```
2. **Audit Braces**: Use a line-by-line brace counter (e.g., `audit_braces_robust.py`) to find where the nesting level becomes negative.
3. **Verify Syntax**: Run a syntax-only check to confirm the structure is sound.
   ```bash
   ./scripts/check-syntax.sh path/to/file.c
   ```

### 2. Memory Safety in Guacamole
- **Avoid pointer casts in `guac_mem_free()`**: The `guac_mem_free` macro requires an lvalue. Casting a pointer (e.g., `guac_mem_free((void*)ptr)`) creates an rvalue and causes a compiler error.
- **Constant Pointers**: To free a `const char*`, use a helper function that casts to `char*` internally before calling `guac_mem_free`.

## Bundled Resources

- `scripts/format.sh`: Runs `clang-format` via `nix-shell`.
- `scripts/check-syntax.sh`: Runs `gcc -fsyntax-only` via `nix-shell`.
