
import sys
import os

file_path = '/Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/src/screens/profile/ProfileScreen.tsx'

try:
    with open(file_path, 'r') as f:
        lines = f.readlines()
        
        start_line = 480
        end_line = 550
        
        if start_line > len(lines):
             print(f"File only has {len(lines)} lines.")
        else:
            selected_lines = lines[start_line-1:end_line]
            for i, line in enumerate(selected_lines):
                print(f"{start_line + i}: {line}", end='')

except FileNotFoundError:
    print(f"File not found: {file_path}")
    # Try to verify if we are in the right place
    print(f"I am in {os.getcwd()}")
    try:
        print(f"Listing p2p-kids-marketplace: {os.listdir('p2p-kids-marketplace')}")
    except:
        print("Cannot list p2p-kids-marketplace")

except Exception as e:
    print(f"Error: {e}")
