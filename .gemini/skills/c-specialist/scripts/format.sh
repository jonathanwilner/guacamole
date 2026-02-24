#!/bin/bash
# Format C code using clang-format via nix-shell
FILE=$1
if [ -z "$FILE" ]; then
    echo "Usage: $0 <file.c>"
    exit 1
fi
nix-shell -p clang-tools --run "clang-format -i $FILE"
echo "Formatted $FILE"
