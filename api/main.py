from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

import cv2 as cv
import json
import threading
import time
import serial

from helpers import (camera_pose_to_serializable, calculate_reprojection_errors,
    bundle_adjustment, Cameras, triangulate_points, essential_from_fundamental,
    motion_from_essential, get_serial_ports)
from websocket import (arm_drone, set_drone_pid, set_drone_setpoint,
    set_drone_trim, acquire_floor, set_origin, change_camera_settings,
    capture_points, rotate_scene, calculate_camera_positions, calculate_camera_pose,
    start_or_stop_locating_objects, determine_scale, live_mocap)

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")
origins = ['*']
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=['*'],
    allow_headers=['*'],
)

cameras_init = False
num_objects = 1
serialLock = threading.Lock()
ser = None
def serial_worker():
    global ser
    serial_ports = get_serial_ports()
    for port in serial_ports:
        print(" port: " + str(port))
    try:
        with serialLock:
            ser = serial.Serial(serial_ports[0], 1000000, write_timeout=1)
    except Exception as e:
        print(f"Serial exception: {e}")


@app.on_event('startup')
async def startup():
    serial_thread = threading.Thread(target=serial_worker)
    serial_thread.daemon = True
    serial_thread.start()
    # socketio.run(app, port=3001, debug=True, use_reloader=False)
    # websocket = WebSocket(scope=scope, receive=receive, send=send)

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()
            event = data.get("event")
            if event == "arm-drone":
                await arm_drone(data)
            elif event == 'set-drone-pid':
                await set_drone_pid(data, websocket)
            elif event == 'set-drone-setpoint':
                await set_drone_setpoint(data, websocket)
            elif event == 'set-drone-trim':
                await set_drone_trim(data, websocket)
            elif event == 'acquire-floor':
                await acquire_floor(data, websocket)
            elif event == 'set-origin':
                await set_origin(data, websocket)
            elif event == 'update-camera-settings':
                await change_camera_settings(data, websocket)
            elif event == 'capture-points':
                await capture_points(data, websocket)
            elif event == 'rotate-scene':
                await rotate_scene(data, websocket)
            elif event == 'calculate-camera-positions':
                await calculate_camera_positions(data, websocket)
            elif event == 'calculate-camera-pose':
                await calculate_camera_pose(data, websocket)
            elif event == 'locate-objects':
                await start_or_stop_locating_objects(data, websocket)
            elif event == 'determine-scale':
                await determine_scale(data, websocket)
            elif event == 'triangulate-points':
                await live_mocap(data, websocket)
                
    except WebSocketDisconnect:
        print("Client disconnected")


@app.get("/")
async def index(request: Request, response_class=HTMLResponse):
    context = {
        'title': "Dancing Drones",
        'number_of_drones': num_objects,
    }
    return templates.TemplateResponse(request=request, name="index.html", context=context)


@app.get("/api/camera-stream", include_in_schema=False)
async def stream_video():
    cameras = Cameras.instance()
    cameras.set_socketio(socketio)
    cameras.set_ser(ser)
    cameras.set_serialLock(serialLock)
    cameras.set_num_objects(num_objects)
    global cameras_init
    cameras_init = True

    def gen_frames():
        frequency = 150
        loop_interval = 1.0 / frequency
        last_run_time = 0
        i = 0
        while True:
            time_now = time.time()
            i = (i+1)%10
            if i == 0:
                socketio.emit("fps", {"fps": round(1/(time_now - last_run_time))})
            if time_now - last_run_time < loop_interval:
                time.sleep(last_run_time - time_now + loop_interval)
            last_run_time = time.time()
            frames = cameras.get_frames()
            jpeg_frame = cv.imencode('.jpg', frames)[1].tobytes()
            yield (b'--frame\r\n' b'Content-Type: image/jpeg\r\n\r\n' + 
                bytearray(jpeg_frame) + b'\r\n')

    return StreamingResponse(
        gen_frames(),
        media_type='multipart/x-mixed-replace; boundary=frame'
    )


@app.post("/api/trajectory-planning")
async def trajectory_planning_api(request: Request):
    data = json.loads(request.data)

    waypoint_groups = [] # grouped by continuious movement (no stopping)
    for waypoint in data["waypoints"]:
        stop_at_waypoint = waypoint[-1]
        if stop_at_waypoint:
            waypoint_groups.append([waypoint[:3*num_objects]])
        else:
            waypoint_groups[-1].append(waypoint[:3*num_objects])
    
    setpoints = []
    for i in range(0, len(waypoint_groups)-1):
        start_pos = waypoint_groups[i][0]
        end_pos = waypoint_groups[i+1][0]
        waypoints = waypoint_groups[i][1:]
        setpoints += plan_trajectory(start_pos, end_pos, waypoints, data["maxVel"], data["maxAccel"], data["maxJerk"], data["timestep"])

    return json.dumps({
        "setpoints": setpoints
    })

def plan_trajectory(start_pos, end_pos, waypoints, max_vel, max_accel, max_jerk, timestep):
    otg = Ruckig(3*num_objects, timestep, len(waypoints))  # DoFs, timestep, number of waypoints
    inp = InputParameter(3*num_objects)
    out = OutputParameter(3*num_objects, len(waypoints))

    inp.current_position = start_pos
    inp.current_velocity = [0,0,0]*num_objects
    inp.current_acceleration = [0,0,0]*num_objects

    inp.target_position = end_pos
    inp.target_velocity = [0,0,0]*num_objects
    inp.target_acceleration = [0,0,0]*num_objects

    inp.intermediate_positions = waypoints

    inp.max_velocity = max_vel*num_objects
    inp.max_acceleration = max_accel*num_objects
    inp.max_jerk = max_jerk*num_objects

    setpoints = []
    res = Result.Working
    while res == Result.Working:
        res = otg.update(inp, out)
        setpoints.append(copy.copy(out.new_position))
        out.pass_to_input(inp)

    return setpoints

