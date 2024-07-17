from fastapi import WebSocket

import json
import threading
import time
import cv2 as cv
import numpy as np


serialLock = threading.Lock()

async def arm_drone(data):
    global cameras_init
    if not cameras_init:
        return

    Cameras.instance().drone_armed = data["droneArmed"]
    for droneIndex in range(num_objects):
        serial_data = {
            "armed": data["droneArmed"][droneIndex],
        }
        with serialLock:
            ser.write(f"{str(droneIndex)}{json.dumps(serial_data)}".encode('utf-8'))
        time.sleep(0.01)

async def set_drone_pid(data, websocket):
    serial_data = {
        "pid": [float(x) for x in data["dronePID"]],
    }
    with serialLock:
        ser.write(f"{str(data['droneIndex'])}{json.dumps(serial_data)}".encode('utf-8'))
        time.sleep(0.01)
    await websocket.send_json({"status": "PID set"})

async def set_drone_setpoint(data, websocket):
    serial_data = {
        "setpoint": [float(x) for x in data["droneSetpoint"]],
    }
    with serialLock:
        ser.write(f"{str(data['droneIndex'])}{json.dumps(serial_data)}".encode('utf-8'))
        time.sleep(0.01)
    await websocket.send_json({"status": "Setpoint set"})

async def set_drone_trim(data, websocket):
    serial_data = {
        "trim": [int(x) for x in data["droneTrim"]],
    }
    with serialLock:
        ser.write(f"{str(data['droneIndex'])}{json.dumps(serial_data)}".encode('utf-8'))
        time.sleep(0.01)
    await websocket.send_json({"status": "Trim set"})

async def acquire_floor(data, websocket):
    object_points = np.array([item for sublist in data["objectPoints"] for item in sublist])
    print(object_points)

    tmp_A = []
    tmp_b = []

    for i in range(len(object_points)):
        tmp_A.append([object_points[i, 0], object_points[i, 1], 1])
        tmp_b.append(object_points[i, 2])

    b = np.matrix(tmp_b).T
    A = np.matrix(tmp_A)

    fit, residual, rnk, s = linalg.lstsq(A, b)
    fit = fit.T[0]

    plane_normal = np.array([[fit[0]], [fit[1]], [-1]])
    plane_normal = plane_normal / linalg.norm(plane_normal)

    up_normal = np.array([[0], [0], [1]], dtype=np.float32)
    plane = np.array([fit[0], fit[1], -1, fit[2]])

    print(plane)

    G = np.array([
        [np.dot(plane_normal.T, up_normal)[0][0], -linalg.norm(np.cross(plane_normal.T[0], up_normal.T[0])), 0],
        [linalg.norm(np.cross(plane_normal.T[0], up_normal.T[0])), np.dot(plane_normal.T, up_normal)[0][0], 0],
        [0, 0, 1]
    ])

    F = np.array([plane_normal.T[0], 
                  ((up_normal - np.dot(plane_normal.T, up_normal)[0][0] * plane_normal) / linalg.norm((up_normal - np.dot(plane_normal.T, up_normal)[0][0] * plane_normal))).T[0], 
                  np.cross(up_normal.T[0], plane_normal.T[0])]).T

    R = F @ G @ linalg.inv(F)
    R = R @ [[1, 0, 0], [0, -1, 0], [0, 0, 1]]

    new_transform = np.array(np.vstack((np.c_[R, [0, 0, 0]], [[0, 0, 0, 1]])))
    transformed_plane = new_transform @ plane

    await websocket.send_json({
        "event": "to-world-coords-matrix",
        "to_world_coords_matrix": new_transform.tolist(),
        "floor_plane": plane.tolist(),
        "transformed_floor_plane": transformed_plane.tolist()
    })

async def set_origin(data, websocket):
    cameras = Cameras.instance()
    object_point = np.array(data["objectPoint"])
    to_world_coords_matrix = np.array(data["toWorldCoordsMatrix"])
    transform_matrix = np.eye(4)

    object_point[1], object_point[2] = object_point[2], object_point[1]  # i dont fucking know why
    transform_matrix[:3, 3] = -object_point

    to_world_coords_matrix = transform_matrix @ to_world_coords_matrix
    cameras.to_world_coords_matrix = to_world_coords_matrix

    await websocket.send_json({
        "event": "to-world-coords-matrix",
        "to_world_coords_matrix": cameras.to_world_coords_matrix.tolist()
    })

async def change_camera_settings(data, websocket):
    cameras = Cameras.instance()
    cameras.edit_settings(data["exposure"], data["gain"])
    await websocket.send_json({"status": "Camera settings updated"})

async def capture_points(data, websocket):
    start_or_stop = data["startOrStop"]
    cameras = Cameras.instance()

    if start_or_stop == "start":
        cameras.start_capturing_points()
        await websocket.send_json({"status": "Started capturing points"})
    elif start_or_stop == "stop":
        cameras.stop_capturing_points()
        await websocket.send_json({"status": "Stopped capturing points"})

def rotation_matrix(axis, angle_degrees):
    angle_radians = np.radians(angle_degrees)
    if axis == 'x':
        return np.array([
            [1, 0, 0],
            [0, np.cos(angle_radians), -np.sin(angle_radians)],
            [0, np.sin(angle_radians), np.cos(angle_radians)]
        ])
    elif axis == 'y':
        return np.array([
            [np.cos(angle_radians), 0, np.sin(angle_radians)],
            [0, 1, 0],
            [-np.sin(angle_radians), 0, np.cos(angle_radians)]
        ])
    elif axis == 'z':
        return np.array([
            [np.cos(angle_radians), -np.sin(angle_radians), 0],
            [np.sin(angle_radians), np.cos(angle_radians), 0],
            [0, 0, 1]
        ])

async def rotate_scene(data, websocket):
    axis = data['axis']
    increment = data['increment']
    angle = 1 * increment  # 1 degree increment or decrement

    cameras = Cameras.instance()
    to_world_coords_matrix = np.array(cameras.to_world_coords_matrix)

    rotation_part = to_world_coords_matrix[:3, :3]
    rotation = rotation_matrix(axis, angle)
    new_rotation_part = rotation @ rotation_part

    to_world_coords_matrix[:3, :3] = new_rotation_part
    cameras.to_world_coords_matrix = to_world_coords_matrix

    await websocket.send_json({
        "event": "to-world-coords-matrix",
        "to_world_coords_matrix": to_world_coords_matrix.tolist()
    })

    print(f"Rotated scene around {axis} axis by {angle} degrees")

async def calculate_camera_positions(data, websocket):
    print("Calculate camera positions")
    cameras = Cameras.instance()
    camera_poses = data["cameraPoses"]
    to_world_coords_matrix = np.array(data["toWorldCoordsMatrix"])
    cameras.to_world_coords_matrix = to_world_coords_matrix
    print(to_world_coords_matrix)

    camera_positions = []
    camera_directions = []
    for i in range(len(camera_poses)):
        t = np.array(camera_poses[i]["t"])
        R = np.array(camera_poses[i]["R"])

        # Invert z axis (Threejs uses (x, z, y) and z is to the outside of the screen)
        t = np.array([[1, 0, 0], [0, -1, 0], [0, 0, 1]]) @ t
        R = np.array([[1, 0, 0], [0, -1, 0], [0, 0, 1]]) @ R

        # Convert position to homogeneous coordinates
        position_homogeneous = np.append(t, 1)
        position_transformed = to_world_coords_matrix @ position_homogeneous
        position = position_transformed[:3].tolist()

        # Calculate direction and transform (without translation component)
        direction = (R @ np.array([0, 0, 1])).tolist()
        direction_homogeneous = np.append(direction, 0)
        direction_transformed = to_world_coords_matrix @ direction_homogeneous
        direction = direction_transformed[:3].tolist()

        # Store the transformed positions and directions
        camera_positions.append(position)
        camera_directions.append(direction)

    cameras.camera_positions = camera_positions
    cameras.camera_directions = camera_directions

    print("Camera positions: ", camera_positions)

    await websocket.send_json({
        "event": "camera-positions",
        "camera_positions": camera_positions,
        "camera_directions": camera_directions
    })

async def calculate_camera_pose(data, websocket):
    cameras = Cameras.instance()
    image_points = np.array(data["cameraPoints"])
    image_points_t = image_points.transpose((1, 0, 2))

    camera_poses = [{
        "R": np.eye(3),
        "t": np.array([[0],[0],[0]], dtype=np.float32)
    }]

    camera_positions = []
    camera_directions = []

    for camera_i in range(0, cameras.num_cameras-1):
        camera1_image_points = image_points_t[camera_i]
        camera2_image_points = image_points_t[camera_i+1]
        not_none_indicies = np.where(np.all(camera1_image_points != None, axis=1) & np.all(camera2_image_points != None, axis=1))[0]
        camera1_image_points = np.take(camera1_image_points, not_none_indicies, axis=0).astype(np.float32)
        camera2_image_points = np.take(camera2_image_points, not_none_indicies, axis=0).astype(np.float32)

        F, _ = cv.findFundamentalMat(camera1_image_points, camera2_image_points, cv.FM_RANSAC, 1, 0.99999)
        E = essential_from_fundamental(F, cameras.get_camera_params(0)["intrinsic_matrix"], cameras.get_camera_params(1)["intrinsic_matrix"])
        possible_Rs, possible_ts = motion_from_essential(E)

        R = None
        t = None
        max_points_infront_of_camera = 0
        for i in range(0, 4):
            object_points = triangulate_points(np.hstack([np.expand_dims(camera1_image_points, axis=1), np.expand_dims(camera2_image_points, axis=1)]), np.concatenate([[camera_poses[-1]], [{"R": possible_Rs[i], "t": possible_ts[i]}]]))
            object_points_camera_coordinate_frame = np.array([possible_Rs[i].T @ object_point for object_point in object_points])

            points_infront_of_camera = np.sum(object_points[:,2] > 0) + np.sum(object_points_camera_coordinate_frame[:,2] > 0)

            if points_infront_of_camera > max_points_infront_of_camera:
                max_points_infront_of_camera = points_infront_of_camera
                R = possible_Rs[i]
                t = possible_ts[i]

        R = R @ camera_poses[-1]["R"]
        t = camera_poses[-1]["t"] + (camera_poses[-1]["R"] @ t)

        camera_poses.append({
            "R": R,
            "t": t
        })

        position = t.flatten()
        camera_positions.append(position)

        direction = R @ np.array([0, 0, 1])
        camera_directions.append(direction)

    cameras.camera_positions = camera_positions
    cameras.camera_directions = camera_directions

    camera_poses = bundle_adjustment(image_points, camera_poses, websocket)

    object_points = triangulate_points(image_points, camera_poses)
    error = np.mean(calculate_reprojection_errors(image_points, object_points, camera_poses))

    await websocket.send_json({
        "event": "camera-pose",
        "camera_poses": camera_pose_to_serializable(camera_poses)
    })

async def start_or_stop_locating_objects(data, websocket):
    cameras = Cameras.instance()
    start_or_stop = data["startOrStop"]

    if start_or_stop == "start":
        cameras.start_locating_objects()
    elif start_or_stop == "stop":
        cameras.stop_locating_objects()

async def determine_scale(data, websocket):
    object_points = data["objectPoints"]
    camera_poses = data["cameraPoses"]
    actual_distance = 0.15
    observed_distances = []

    for object_points_i in object_points:
        if len(object_points_i) != 2:
            continue

        object_points_i = np.array(object_points_i)

        observed_distances.append(np.sqrt(np.sum((object_points_i[0] - object_points_i[1])**2)))

    scale_factor = actual_distance / np.mean(observed_distances)
    for i in range(len(camera_poses)):
        camera_poses[i]["t"] = (np.array(camera_poses[i]["t"]) * scale_factor).tolist()

    await websocket.send_json({
        "event": "camera-pose",
        "error": None,
        "camera_poses": camera_poses
    })

async def live_mocap(data, websocket):
    cameras = Cameras.instance()
    start_or_stop = data["startOrStop"]
    camera_poses = data["cameraPoses"]
    cameras.to_world_coords_matrix = np.array(data["toWorldCoordsMatrix"])

    if start_or_stop == "start":
        cameras.start_triangulating_points(camera_poses)
    elif start_or_stop == "stop":
        cameras.stop_triangulating_points()

