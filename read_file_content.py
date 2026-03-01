
import sys

def read_file(file_path):
    try:
        with open(file_path, 'r') as file:
            print(file.read())
    except Exception as e:
        print(f"Error reading file: {e}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        read_file(sys.argv[1])
    else:
        print("Please provide a file path")
