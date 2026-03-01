
try:
    with open('p2p-kids-marketplace/src/screens/profile/ProfileScreen.tsx', 'r') as f:
        lines = f.readlines()
        # Print lines 500-540 (0-indexed: 499-539)
        for i in range(499, 540):
            if i < len(lines):
                print(f"{i+1}: {lines[i]}", end='')
except Exception as e:
    print(f"Error: {e}")
