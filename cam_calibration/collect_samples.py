from pseyepy import Camera, Display
from pathlib import Path
import cv2  # OpenCV for image handling
import time
import sys

cam_index = 42
if len(sys.argv) > 1:
    cam_index = sys.argv[1]
    print(f"Collecting samples for camera {cam_index}:")

img_dir = f"cam_{cam_index}"
Path(img_dir).mkdir(exist_ok=True)
input("Press a key when ready to proceed...")

# Initialize camera
# cams = Camera(fps=60, resolution=Camera.RES_LARGE)  # wrong camera mode
cams = Camera(fps=90, resolution=Camera.RES_SMALL, colour=False, gain=42, vflip=False)  # camera mode which is used in main mocap logic

for i in range(30):  # Capture 30 images
    frame, timestamp = cams.read()
    filename = f'{img_dir}/image_{i}.jpg'
    cv2.imwrite(filename, frame)
    time.sleep(0.5)  # Wait a second between captures

# Clean up
cams.end()
print("Done collecting samples")
