def trace_braces_verbose(file_path, start_line):
    with open(file_path, 'r') as f:
        level = 0
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
                    level += 1
                elif char == '}':
                    level -= 1
            
            if i >= start_line:
                if level != old_level:
                    print(f"L{i}: {old_level} -> {level} ('{clean_line.strip()}')")
        print(f"Final level: {level}")

if __name__ == "__main__":
    import sys
    trace_braces_verbose(sys.argv[1], int(sys.argv[2]))
