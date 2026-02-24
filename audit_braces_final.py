import sys
import re

def audit_functions(filename):
    with open(filename, 'r') as f:
        lines = f.readlines()

    level = 0
    func_pattern = re.compile(r'^(static\s+)?(UINT|void|int|bool|guac_rdpecam_device\*|BOOL|static void\*)\s+\w+\s*\(')
    
    for i, line in enumerate(lines):
        stripped = line.strip()
        
        # Primitive comment handling for trace
        clean_line = line.split('//')[0]
        if '/*' in clean_line and '*/' in clean_line:
            clean_line = clean_line.split('/*')[0] + clean_line.split('*/')[1]
        elif '/*' in clean_line:
            clean_line = clean_line.split('/*')[0]
        elif '*/' in clean_line:
            clean_line = clean_line.split('*/')[1]

        if func_pattern.match(stripped):
            print(f"L{i+1} [LVL {level}] FUNC: {stripped}")
            
        old_level = level
        for char in clean_line:
            if char == '{': level += 1
            if char == '}': level -= 1
            
        if level < 0:
            print(f"L{i+1} ERROR: Negative level {level}")
            level = 0

    print(f"Final level: {level}")

if __name__ == "__main__":
    audit_functions(sys.argv[1])
