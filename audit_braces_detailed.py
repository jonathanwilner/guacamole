
def audit_braces_detailed(file_path):
    with open(file_path, 'r') as f:
        level = 0
        current_func_start = 1
        for i, line in enumerate(f, 1):
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
            
            old_level = level
            for char in clean_line:
                if char == '{':
                    if level == 0:
                        current_func_start = i
                    level += 1
                elif char == '}':
                    level -= 1
                    if level == 0:
                        print(f"Block ending at L{i} (started L{current_func_start})")
                    if level < 0:
                        print(f"L{i}: Level {level} (NEGATIVE ERROR)")
                        level = 0 # reset for debugging

        print(f"Final level: {level}")
        return level

if __name__ == "__main__":
    import sys
    audit_braces_detailed(sys.argv[1])
