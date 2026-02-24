#!/bin/bash
# Check C syntax using gcc via nix-shell
FILE=$1
if [ -z "$FILE" ]; then
    echo "Usage: $0 <file.c>"
    exit 1
fi
nix-shell -p gcc --run "gcc -fsyntax-only -Iguacamole-server/src/protocols/rdp -Iguacamole-server/src/libguac $FILE"
