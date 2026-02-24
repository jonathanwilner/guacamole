
import sys

def audit_braces(filename):
    with open(filename, 'r') as f:
        lines = f.readlines()

    level = 0
    for i, line in enumerate(lines):
        # Primitive brace counting (ignoring strings/comments for this pass)
        # This is usually sufficient for finding high-level nesting errors
        old_level = level
        level += line.count('{')
        level -= line.count('}')
        
        # Check if a function is being defined while we are already inside a block
        if "static" in line or "UINT" in line or "void" in line:
            if "(" in line and ")" in line and "{" in line and old_level > 0:
                print(f"POSSIBLE NESTED FUNCTION at line {i+1} (Level {old_level}): {line.strip()}")
        
        if level < 0:
            print(f"ERROR: Negative level at line {i+1}: {line.strip()}")
            level = 0

    print(f"Final Level: {level}")

if __name__ == "__main__":
    audit_braces(sys.argv[1])
