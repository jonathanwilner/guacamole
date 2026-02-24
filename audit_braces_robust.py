
def audit_braces(file_path):
    with open(file_path, 'r') as f:
        level = 0
        for i, line in enumerate(f, 1):
            # Remove comments and string literals to avoid false positives
            # Simple heuristic: ignore content within double quotes and /* */
            # (Note: this is a simple heuristic, but usually enough for C braces)
            clean_line = ""
            in_string = False
            in_comment = False
            j = 0
            while j < len(line):
                if not in_comment and not in_string and line[j:j+2] == '/*':
                    in_comment = True
                    j += 2
                    continue
                if in_comment and line[j:j+2] == '*/':
                    in_comment = False
                    j += 2
                    continue
                if not in_comment and line[j] == '"':
                    in_string = not in_string
                if not in_comment and not in_string:
                    clean_line += line[j]
                j += 1
            
            for char in clean_line:
                if char == '{':
                    level += 1
                elif char == '}':
                    level -= 1
                    if level < 0:
                        print(f"ERROR: Level became negative at line {i}: {line.strip()}")
                        return i
        print(f"Final level: {level}")
        return level

if __name__ == "__main__":
    import sys
    audit_braces(sys.argv[1])
