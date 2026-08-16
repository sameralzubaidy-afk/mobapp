
import os

file_path = '/Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/src/screens/profile/ProfileScreen.tsx'

try:
    with open(file_path, 'r') as f:
        lines = f.readlines()
        
        start_line = 480
        end_line = 550
        
        if len(lines) < start_line:
             print(f"File shorter than {start_line} lines. Total: {len(lines)}")
        else:
            print(f"--- Lines {start_line}-{end_line} ---")
            for i in range(start_line-1, min(len(lines), end_line)):
                 print(f"{i+1}: {lines[i]}", end='')
                 
except Exception as e:
    print(f"Error: {e}")
