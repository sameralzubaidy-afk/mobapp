with open('p2p-kids-marketplace/src/screens/messaging/ChatScreen.tsx') as f:
    for idx,line in enumerate(f,1):
        if 130 <= idx <= 220:
            print(f"{idx:04d}: {line.rstrip()}" )
