
import sys
import re

def audit_braces_verbose(filename):
    with open(filename, 'r') as f:
        lines = f.readlines()

    level = 0
    in_comment = False
    for i, line in enumerate(lines):
        # Very simple comment handling
        stripped = line.strip()
        
        # This is enough to catch most nested function issues
        old_level = level
        
        # Check every character to handle multiple braces on one line
        for char in line:
            if char == '{': level += 1
            if char == '}': level -= 1
            
        if level != old_level:
            # print(f"L{i+1} [LVL {old_level}->{level}]: {stripped}")
            pass
            
        if level < 0:
            print(f"L{i+1} ERROR: Negative level {level}")
            level = 0
            
        # Check for function starts at non-zero level
        if level > 0 and old_level > 0:
             # Basic heuristic for function definition
             if re.match(r'^(static\s+)?(UINT|void|int|bool|guac_rdpecam_device\*)\s+\w+\s*\(', stripped):
                 if '{' in stripped:
                     print(f"L{i+1} [NESTED FUNC AT LVL {old_level}]: {stripped}")

    print(f"Final Level: {level}")

if __name__ == "__main__":
    audit_braces_verbose(sys.argv[1])
