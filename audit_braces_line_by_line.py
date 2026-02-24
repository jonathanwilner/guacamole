
import sys

def audit_braces_line_by_line(filename):
    with open(filename, 'r') as f:
        lines = f.readlines()

    level = 0
    for i, line in enumerate(lines):
        # Ignore comments
        stripped = line.strip()
        if stripped.startswith("/*") or stripped.startswith("*") or stripped.startswith("//"):
            continue
            
        old_level = level
        for char in line:
            if char == '{': level += 1
            if char == '}': level -= 1
        
        # We only care about lines where level is supposed to be 0 but isn't
        # or where level changes.
        if level != 0 and "static" in line and "(" in line and ")" in line and "{" in line:
             print(f"L{i+1} [LVL {old_level}->{level}] FUNCTION START: {stripped}")
        
        if level < 0:
            print(f"L{i+1} ERROR: Negative level {level}")
            level = 0

    print(f"Final Level: {level}")

if __name__ == "__main__":
    audit_braces_line_by_line(sys.argv[1])
