#!/usr/bin/env python3
 
from pseyepy import Camera, Display
from pathlib import Path
import cv2
import numpy as np
import os
import glob
import json
import time
import sys

n_samples = 42
wait_between_frames = 0.24
n_cams = 1
output_file = 'cam_params.json'

def round_values(matrix, decimals=8):
    return np.round(matrix, decimals).tolist()

if len(sys.argv) > 1:
    n_cams = sys.argv[1]
    print(f'Calibrating {n_cams} cameras')
if len(sys.argv) > 2:
    n_samples = int(sys.argv[2])

if n_cams == 1:
    print('Make sure camera is connected')
else:
    print(f"Connect ALL {n_cams} cameras")
out = '[\n'
# Initialize cameras
cams = Camera(fps=90, resolution=Camera.RES_SMALL, colour=False, gain=42, vflip=False)
Display(cams)

camera_params = []

for cam_index in range(int(n_cams)):
    input("Press Enter to continue...")
    print(f"Collecting {n_samples} sample frames from camera {cam_index}:")

    img_dir = f"cam_{cam_index}"
    img_calibrated_dir = f'{img_dir}_c'
    Path(img_dir).mkdir(exist_ok=True)
    Path(img_calibrated_dir).mkdir(exist_ok=True)

    input("Press Enter when ready to proceed...")
    for i in range(n_samples):
        frame, timestamp = cams.read(cam_index)
        filename = f'cam_{cam_index}/image_{i}.jpg'
        cv2.imwrite(filename, frame)
        time.sleep(wait_between_frames)

    print("Collected samples")
    print("Calculating calibration params")

    # cam_images_folder_name = 'cam_1'
    Path(img_calibrated_dir).mkdir(exist_ok=True)

    # Defining the dimensions of checkerboard
    # CHECKERBOARD = (6,9)
    CHECKERBOARD = (5,6)
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.001)
    
    # Creating vector to store vectors of 3D points for each checkerboard image
    objpoints = []
    # Creating vector to store vectors of 2D points for each checkerboard image
    imgpoints = [] 
    
    
    # Defining the world coordinates for 3D points
    objp = np.zeros((1, CHECKERBOARD[0] * CHECKERBOARD[1], 3), np.float32)
    objp[0,:,:2] = np.mgrid[0:CHECKERBOARD[0], 0:CHECKERBOARD[1]].T.reshape(-1, 2)
    prev_img_shape = None
    
    # Extracting path of individual image stored in a given directory
    images = glob.glob(f'./{img_dir}/*.jpg')
    for fname in images:
        img = cv2.imread(fname)
        gray = cv2.cvtColor(img,cv2.COLOR_BGR2GRAY)
        # Find the chess board corners
        # If desired number of corners are found in the image then ret = true
        # ret, corners = cv2.findChessboardCorners(gray, CHECKERBOARD, cv2.CALIB_CB_ADAPTIVE_THRESH + cv2.CALIB_CB_FAST_CHECK + cv2.CALIB_CB_NORMALIZE_IMAGE)
        ret, corners = cv2.findChessboardCorners(gray, CHECKERBOARD, cv2.CALIB_CB_ADAPTIVE_THRESH + cv2.CALIB_CB_NORMALIZE_IMAGE)
        
        """
        If desired number of corner are detected,
        we refine the pixel coordinates and display 
        them on the images of checker board
        """
        if ret == True:
            objpoints.append(objp)
            # refining pixel coordinates for given 2d points.
            corners2 = cv2.cornerSubPix(gray, corners, (11,11),(-1,-1), criteria)
            
            imgpoints.append(corners2)
    
            # Draw and display the corners
            img = cv2.drawChessboardCorners(img, CHECKERBOARD, corners2, ret)
        
        # cv2.imshow('img',img)
        # cv2.waitKey(0)
        
        new_frame_name = img_calibrated_dir + '/' + os.path.basename(fname)
        # print(new_frame_name)
        cv2.imwrite(new_frame_name, img)

    
    # cv2.destroyAllWindows()
    
    h,w = img.shape[:2]
    
    """
    Performing camera calibration by 
    passing the value of known 3D points (objpoints)
    and corresponding pixel coordinates of the 
    detected corners (imgpoints)
    """
    ret, mtx, dist, rvecs, tvecs = cv2.calibrateCamera(objpoints, imgpoints, gray.shape[::-1], None, None)

    # cam_params = '\n{\n "intrinsic_matrix": ['
    # for m in mtx:
    #     cam_params += f'{[i for i in m]},'
    # cam_params += '],\n "distortion_coef": ['
    # for d in dist:
    #     cam_params += f'{[i for i in d]}'
    # cam_params += '],\n "rotation": 0\n}'
    # out += cam_params
    # if cam_index != int(n_cams) - 1:
    #     out += ','
    mtx = round_values(mtx)
    dist = round_values(dist)

    print("Camera matrix : \n")
    print(mtx)
    print("distortion coefficients : \n")
    print(dist)

    params = {
        "intrinsic_matrix": mtx,
        "distortion_coef": dist,
        "rotation": 0
    }

    if params is not None:
        camera_params.append(params)

    print(f"Finished calibrating camera {cam_index}")


# Clean up
cams.end()

if camera_params is not None:
    with open(output_file, 'w') as file:
        json.dump(camera_params, file, indent=4)

print(f'Finished camera calibrations. Check output in {output_file}')
