"use client";

import { FormEventHandler, useState, createRef, Ref, useRef, useEffect } from 'react';
import { Button, ButtonGroup, Card, Col, Container, Row } from 'react-bootstrap';
import Toolbar from './components/Toolbar';
import Form from 'react-bootstrap/Form';
import { Tooltip } from 'react-tooltip'
import CameraWireframe from './components/CameraWireframe';
import { io } from 'socket.io-client';
import { Canvas, useFrame } from '@react-three/fiber'
import { Stats, OrbitControls } from '@react-three/drei'
import Points from './components/Points';
import { socket } from './shared/styles/scripts/socket';
import { matrix, mean, multiply, rotationMatrix } from 'mathjs';
import Objects from './components/Objects';
import Chart from './components/Chart';
import TrajectoryPlanningSetpoints from './components/TrajectoryPlanningSetpoints';
import CameraPosition from './components/CameraPosition';

import CameraStream from './views/CameraStream';
import CameraSettings from './views/CameraSettings';
import ControlPanel from './views/ControlPanel';
import SceneView from './views/SceneView';
import { Scene } from 'three';

const NUM_DRONES = 1

export default function App() {
  enum ControlView {
    CameraSettings,
    ControlDrone,
    GenerateTrajectory,
  }

  const [cameraStreamRunning, setCameraStreamRunning] = useState(false);

  const [isTriangulatingPoints, setIsTriangulatingPoints] = useState(false);

  const objectPoints = useRef<number[][][]>([])
  const filteredObjects = useRef<object[][]>([])
  const droneSetpointHistory = useRef<number[][]>([])
  const objectPointErrors = useRef<Array<Array<number>>>([])
  const objects = useRef<Array<Array<Object>>>([])
  const [objectPointCount, setObjectPointCount] = useState(0);

  const [cameraPoses, setCameraPoses] = useState<Array<object>>([{"R":[[1,0,0],[0,1,0],[0,0,1]],"t":[0,0,0]},{"R":[[-0.16346976675864877,-0.42175206694110606,0.8918535919010351],[0.4083755578879685,0.7939982753879756,0.4503289268974524],[-0.898057369590364,0.4378263727915729,0.04243852274303628]],"t":[-1.934442819517861,-0.7776297904231453,1.8553212149426448]},{"R":[[-0.995468747679551,-0.08771685482663796,0.036711384782236865],[-0.0226908879439435,0.5940481837660478,0.8041093700290873],[-0.09234227632900507,0.7996327336618874,-0.5933467748785657]],"t":[0.05316977872682252,-1.4731903376565618,3.0738369310477305]},{"R":[[0.01901733753075885,0.44381921278087044,-0.8959145312136698],[-0.6118588305706265,0.7138563836676237,0.34064326640890435],[0.7907383336641689,0.5416950893847486,0.2851303523135734]],"t":[1.5544899623116852,-0.5968091261387606,1.3600406318652503]}])
  const [toWorldCoordsMatrix, setToWorldCoordsMatrix] = useState<number[][]>([[0.9948540418685592,-0.02410358006532853,-0.09840961744578682,0.1509028388496545],[-0.02052169721586784,0.903219950955305,-0.4286870421877468,1.5167138793041937],[-0.09921842228725493,-0.4285005689895093,-0.8980773725322871,1.654975669493927],[0,0,0,1]]
  )

  const [cameraPositions, setCameraPositions] = useState<number[][]>([]);
  const [cameraDirections, setCameraDirections] = useState<number[][]>([]);

  const [currentDroneIndex, setCurrentDroneIndex] = useState(0)
  const [droneArmed, setDroneArmed] = useState(Array.apply(null, Array(NUM_DRONES)).map(() => (false)))
  const [dronePID, setDronePID] = useState(["1", "0", "0", "1.5", "0", "0", "0.3", "0.1", "0.05", "0.2", "0.03", "0.05", "0.3", "0.1", "0.05", "28", "-0.035"])
  const [droneSetpointWithMotion, setDroneSetpointWithMotion] = useState([0, 0, 0])

  const [trajectoryPlanningSetpoints, setTrajectoryPlanningSetpoints] = useState<number[][][]>([])

  const [currentControlView, setCurrentControlView] = useState<ControlView>(ControlView.CameraSettings);

  useEffect(() => {
    socket.on("to-world-coords-matrix", (data) => {
      setToWorldCoordsMatrix(data["to_world_coords_matrix"])
      setObjectPointCount(objectPointCount + 1)
    })

    return () => {
      socket.off("to-world-coords-matrix")
    }
  }, [objectPointCount])

  useEffect(() => {
    socket.on("object-points", (data) => {
      objectPoints.current.push(data["object_points"])
      console.log(data["object_points"])
      if (data["filtered_objects"].length != 0) {
        filteredObjects.current.push(data["filtered_objects"])
        console.log(data["filtered_objects"]["pos"])
        
      }
      objectPointErrors.current.push(data["errors"])
      objects.current.push(data["objects"])
      droneSetpointHistory.current.push(droneSetpointWithMotion)
      setObjectPointCount(objectPointCount + 1)
    })

    return () => {
      socket.off("object-points")
    }
  }, [objectPointCount])

  useEffect(() => {
    // Escuchar el evento "camera-positions" del servidor
    socket.on("camera-positions", (data) => {
      setCameraPositions(data.camera_positions);
      setCameraDirections(data.camera_directions);
      console.log(data.camera_positions)
      console.log(data.camera_directions)
    });

    return () => {
      socket.off("camera-positions");
    };
  }, [])

  useEffect(() => {
    socket.on("camera-pose", data => {
      console.log(data["camera_poses"])
      setCameraPoses(data["camera_poses"])
    })

    return () => {
      socket.off("camera-pose")
    }
  }, [])

  const resetPoints = () => {
    objectPoints.current = []
    filteredObjects.current = []
    objectPointErrors.current = []
    objects.current = []
    droneSetpointHistory.current = []
    setObjectPointCount(0)
  }

  return (
    <Container fluid>
      <Row className="mt-3 mb-3 flex-nowrap" style={{ alignItems: 'center' }}>
        <Col className="ms-4" style={{ width: 'fit-content' }} md="auto">
          <h2>Dancing drones</h2>
        </Col>
        <Col>
          <Toolbar />
        </Col>
      </Row>
      <Row>
        <Col>
          <CameraStream 
            cameraStreamRunning={cameraStreamRunning} 
            setCameraStreamRunning={setCameraStreamRunning}
          />
        </Col>
      </Row>
      <Row className='pt-3'>
          <Col xs={4} style={{width: '30%'}}>
            <ButtonGroup>
              <Button 
                variant={currentControlView === ControlView.CameraSettings ? "primary" : "secondary"}
                className="me-2" 
                onClick={() => setCurrentControlView(ControlView.CameraSettings)}>
                Camera Settings
              </Button>
              <Button 
                variant={currentControlView === ControlView.ControlDrone ? "primary" : "secondary"}
                className="me-2" 
                onClick={() => setCurrentControlView(ControlView.ControlDrone)}>
                Control Drone
                </Button>
              <Button 
                variant={currentControlView === ControlView.GenerateTrajectory ? "primary" : "secondary"}
                className="me-2" 
                onClick={() => setCurrentControlView(ControlView.GenerateTrajectory)}>
                Generate Trajectory
              </Button>
              {/* Agrega más botones según sea necesario */}
            </ButtonGroup>
            {currentControlView === ControlView.CameraSettings && (
              <CameraSettings
                cameraPoses={cameraPoses}
                setCameraPoses={setCameraPoses}
                toWorldCoordsMatrix={toWorldCoordsMatrix}
                setToWorldCoordsMatrix={setToWorldCoordsMatrix}
                objectPoints={objectPoints}
                objectPointErrors={objectPointErrors}
                cameraStreamRunning={cameraStreamRunning}
                isTriangulatingPoints={isTriangulatingPoints}
                setIsTriangulatingPoints={setIsTriangulatingPoints}
                resetPoints={resetPoints}
              />
            )}
              <div style={{display: (currentControlView === ControlView.ControlDrone ||
                currentControlView === ControlView.GenerateTrajectory) ? 'block' : 'none' }}>
                <ControlPanel
                  ControlView={ControlView}
                  currentControlView={currentControlView}
                  NUM_DRONES={NUM_DRONES}
                  currentDroneIndex={currentDroneIndex}
                  setCurrentDroneIndex={setCurrentDroneIndex}
                  droneArmed={droneArmed}
                  setDroneArmed={setDroneArmed}
                  dronePID={dronePID}
                  setDronePID={setDronePID}
                  droneSetpointWithMotion={droneSetpointWithMotion}
                  setDroneSetpointWithMotion={setDroneSetpointWithMotion}
                  filteredObjects={filteredObjects}
                  trajectoryPlanningSetpoints={trajectoryPlanningSetpoints}
                />
              </div>
            
            {/* {currentControlView === ControlView.AnotherComponent && <AnotherComponent />} */}
            {/* Agrega más condicionales según sea necesario */}
          </Col>
          <Col style={{width: '80%'}}>
            <SceneView
              NUM_DRONES={NUM_DRONES}
              cameraPoses={cameraPoses}
              toWorldCoordsMatrix={toWorldCoordsMatrix}
              cameraPositions={cameraPositions}
              cameraDirections={cameraDirections}
              objectPoints={objectPoints}
              objectPointErrors={objectPointErrors}
              objectPointCount={objectPointCount}
              filteredObjects={filteredObjects}
              trajectoryPlanningSetpoints={trajectoryPlanningSetpoints}
            />
          </Col>
      </Row>

      <Row className='pt-3'>
        <Col style={{height: '1000px'}}>
          <Card className='shadow-sm p-3' style={{height: '1000px'}}>
            <Chart filteredObjectsRef={filteredObjects} droneSetpointHistoryRef={droneSetpointHistory} objectPointCount={objectPointCount} dronePID={dronePID.map(x => parseFloat(x))} droneArmed={droneArmed} currentDroneIndex={currentDroneIndex} />
          </Card>
        </Col>
      </Row>
      {/* ... otras filas y componentes */}
  </Container>

    // <Container fluid>
    //   <Row className="mt-3 mb-3 flex-nowrap" style={{ alignItems: 'center' }}>
    //     <Col className="ms-4" style={{ width: 'fit-content' }} md="auto">
    //       <h2>MoCap</h2>
    //     </Col>
    //     <Col>
    //       <Toolbar />
    //     </Col>
    //   </Row>
    //   <Row className='pt-3'>
    //     <Col xs={4}>
    //       <Card className='shadow-sm p-3 h-100'>
    //         <Row>
    //           <Col>
    //             <h4>Generate Trajectory</h4>
    //           </Col>
    //         </Row>
    //         <Row className='pt-1'>
    //           <Col xs={{ offset: 3 }} className='text-center'>
    //             X
    //           </Col>
    //           <Col className='text-center'>
    //             Y
    //           </Col>
    //           <Col className='text-center'>
    //             Z
    //           </Col>
    //         </Row>
    //         <Row className='pt-2'>
    //           <Col xs={3} className='pt-2 text-end'>
    //             Max Vel
    //           </Col>
    //           <Col>
    //             <Form.Control
    //               value={trajectoryPlanningMaxVel[0]}
    //               onChange={(event) => {
    //                 let newTrajectoryPlanningMaxVel = trajectoryPlanningMaxVel.slice()
    //                 newTrajectoryPlanningMaxVel[0] = event.target.value
    //                 setTrajectoryPlanningMaxVel(newTrajectoryPlanningMaxVel)
    //               }}
    //             />
    //           </Col>
    //           <Col>
    //             <Form.Control
    //               value={trajectoryPlanningMaxVel[1]}
    //               onChange={(event) => {
    //                 let newTrajectoryPlanningMaxVel = trajectoryPlanningMaxVel.slice()
    //                 newTrajectoryPlanningMaxVel[1] = event.target.value
    //                 setTrajectoryPlanningMaxVel(newTrajectoryPlanningMaxVel)
    //               }}
    //             />
    //           </Col>
    //           <Col>
    //             <Form.Control
    //               value={trajectoryPlanningMaxVel[2]}
    //               onChange={(event) => {
    //                 let newTrajectoryPlanningMaxVel = trajectoryPlanningMaxVel.slice()
    //                 newTrajectoryPlanningMaxVel[2] = event.target.value
    //                 setTrajectoryPlanningMaxVel(newTrajectoryPlanningMaxVel)
    //               }}
    //             />
    //           </Col>
    //         </Row>
    //         <Row className='pt-2'>
    //           <Col xs={3} className='pt-2 text-end'>
    //             Max Accel
    //           </Col>
    //           <Col>
    //             <Form.Control
    //               value={trajectoryPlanningMaxAccel[0]}
    //               onChange={(event) => {
    //                 let newTrajectoryPlanningMaxAccel = trajectoryPlanningMaxAccel.slice()
    //                 newTrajectoryPlanningMaxAccel[0] = event.target.value
    //                 setTrajectoryPlanningMaxAccel(newTrajectoryPlanningMaxAccel)
    //               }}
    //             />
    //           </Col>
    //           <Col>
    //             <Form.Control
    //               value={trajectoryPlanningMaxAccel[1]}
    //               onChange={(event) => {
    //                 let newTrajectoryPlanningMaxAccel = trajectoryPlanningMaxAccel.slice()
    //                 newTrajectoryPlanningMaxAccel[1] = event.target.value
    //                 setTrajectoryPlanningMaxAccel(newTrajectoryPlanningMaxAccel)
    //               }}
    //             />
    //           </Col>
    //           <Col>
    //             <Form.Control
    //               value={trajectoryPlanningMaxAccel[2]}
    //               onChange={(event) => {
    //                 let newTrajectoryPlanningMaxAccel = trajectoryPlanningMaxAccel.slice()
    //                 newTrajectoryPlanningMaxAccel[2] = event.target.value
    //                 setTrajectoryPlanningMaxAccel(newTrajectoryPlanningMaxAccel)
    //               }}
    //             />
    //           </Col>
    //         </Row>
    //         <Row className='pt-2'>
    //           <Col xs={3} className='pt-2 text-end'>
    //             Max Jerk
    //           </Col>
    //           <Col>
    //             <Form.Control
    //               value={trajectoryPlanningMaxJerk[0]}
    //               onChange={(event) => {
    //                 let newTrajectoryPlanningMaxJerk = trajectoryPlanningMaxJerk.slice()
    //                 newTrajectoryPlanningMaxJerk[0] = event.target.value
    //                 setTrajectoryPlanningMaxJerk(newTrajectoryPlanningMaxJerk)
    //               }}
    //             />
    //           </Col>
    //           <Col>
    //             <Form.Control
    //               value={trajectoryPlanningMaxJerk[1]}
    //               onChange={(event) => {
    //                 let newTrajectoryPlanningMaxJerk = trajectoryPlanningMaxJerk.slice()
    //                 newTrajectoryPlanningMaxJerk[1] = event.target.value
    //                 setTrajectoryPlanningMaxJerk(newTrajectoryPlanningMaxJerk)
    //               }}
    //             />
    //           </Col>
    //           <Col>
    //             <Form.Control
    //               value={trajectoryPlanningMaxJerk[2]}
    //               onChange={(event) => {
    //                 let newTrajectoryPlanningMaxJerk = trajectoryPlanningMaxJerk.slice()
    //                 newTrajectoryPlanningMaxJerk[2] = event.target.value
    //                 setTrajectoryPlanningMaxJerk(newTrajectoryPlanningMaxJerk)
    //               }}
    //             />
    //           </Col>
    //         </Row>
    //         <Row className='pt-3'>
    //           <Col>
    //             Waypoints <code>[drone index, x, y, z, stop at waypoint]</code>
    //           </Col>
    //         </Row>
    //         <Row className='pt-1'>
    //           <Col>
    //             <Form.Control
    //               as="textarea"
    //               rows={5}
    //               value={trajectoryPlanningWaypoints}
    //               onChange={(event) => setTrajectoryPlanningWaypoints(event.target.value)}
    //             />
    //           </Col>
    //         </Row>
    //         <Row className='pt-3'>
    //           <Col>
    //             <Button
    //               size='sm'
    //               className='float-end'
    //               variant={droneArmed ? "outline-danger" : "outline-primary"}
    //               onClick={async () => {
    //                 setMotionPreset(new Array(NUM_DRONES).fill("none"))
    //                 const initPos = JSON.parse(trajectoryPlanningWaypoints)[0].slice(0, 3)
    //                 await Promise.all(Array.from(Array(NUM_DRONES).keys()).map(async (droneIndex) => {
    //                   await moveToPos(initPos, droneIndex)
    //                 }))
    //                 setTrajectoryPlanningRunStartTimestamp(Date.now() / 1000)
    //                 setMotionPreset(new Array(NUM_DRONES).fill("plannedTrajectory"))
    //               }}
    //             >
    //               Run
    //             </Button>
    //             <Button
    //               size='sm'
    //               className='float-end me-2'
    //               variant={droneArmed ? "outline-danger" : "outline-primary"}
    //               onClick={async () => {
    //                 const tempSetpoints = await planTrajectory(
    //                   JSON.parse(trajectoryPlanningWaypoints),
    //                   trajectoryPlanningMaxVel.map(x => parseFloat(x)),
    //                   trajectoryPlanningMaxAccel.map(x => parseFloat(x)),
    //                   trajectoryPlanningMaxJerk.map(x => parseFloat(x)),
    //                   TRAJECTORY_PLANNING_TIMESTEP
    //                 )
    //                 setTrajectoryPlanningSetpoints(tempSetpoints)
    //               }}
    //             >
    //               Preview
    //             </Button>
    //           </Col>
    //         </Row>
    //       </Card>
    //     </Col>
    //     <Col xs={4}>
    //       <Card className='shadow-sm p-3 h-100'>
    //         <Row>
    //           <Col xs="auto">







    //             <h4>Control Drone</h4>
    //           </Col>
    //           <Col xs="3">
    //             <Form.Select value={currentDroneIndex} onChange={(e) => setCurrentDroneIndex(parseInt(e.target.value))} size='sm'>
    //               <option value="0">Drone 0</option>
    //               <option value="1">Drone 1</option>
    //             </Form.Select>
    //           </Col>
    //         </Row>
    //         {Array.from(Array(NUM_DRONES).keys()).map((droneIndex) => (
    //           <>
    //             <Row className='pt-4'>
    //               <Col xs="3">
    //                 <h5>Drone {droneIndex}</h5>
    //               </Col>
    //               <Col className='text-center'>
    //                 X
    //               </Col>
    //               <Col className='text-center'>
    //                 Y
    //               </Col>
    //               <Col className='text-center'>
    //                 Z
    //               </Col>
    //             </Row>
    //             <Row>
    //               <Col xs={3} className='pt-2'>
    //                 Setpoint
    //               </Col>
    //               <Col>
    //                 <Form.Control
    //                   value={droneSetpoint[droneIndex][0]}
    //                   onChange={(event) => {
    //                     let newDroneSetpoint = droneSetpoint.slice()
    //                     newDroneSetpoint[droneIndex][0] = event.target.value
    //                     setDroneSetpoint(newDroneSetpoint)
    //                   }}
    //                 />
    //               </Col>
    //               <Col>
    //                 <Form.Control
    //                   value={droneSetpoint[droneIndex][1]}
    //                   onChange={(event) => {
    //                     let newDroneSetpoint = droneSetpoint.slice()
    //                     newDroneSetpoint[droneIndex][1] = event.target.value
    //                     setDroneSetpoint(newDroneSetpoint)
    //                   }}
    //                 />
    //               </Col>
    //               <Col>
    //                 <Form.Control
    //                   value={droneSetpoint[droneIndex][2]}
    //                   onChange={(event) => {
    //                     let newDroneSetpoint = droneSetpoint.slice()
    //                     newDroneSetpoint[droneIndex][2] = event.target.value
    //                     setDroneSetpoint(newDroneSetpoint)
    //                   }}
    //                 />
    //               </Col>
    //             </Row>
    //             <Row className='pt-3'>
    //               <Col>
    //                 <Button
    //                   size='sm'
    //                   variant={droneArmed[droneIndex] ? "outline-danger" : "outline-primary"}
    //                   disabled={!isTriangulatingPoints}
    //                   onClick={() => {
    //                     let newDroneArmed = droneArmed.slice()
    //                     newDroneArmed[droneIndex] = !newDroneArmed[droneIndex]
    //                     setDroneArmed(newDroneArmed);
    //                   }
    //                   }>
    //                   {droneArmed[droneIndex] ? "Disarm" : "Arm"}
    //                 </Button>
    //               </Col>
    //               <Col>
    //                 <Button
    //                   size='sm'
    //                   onClick={() => {
    //                     let newMotionPreset = motionPreset.slice()
    //                     newMotionPreset[droneIndex] = "setpoint"
    //                     setMotionPreset(newMotionPreset);
    //                   }
    //                   }>
    //                   Setpoint
    //                 </Button>
    //               </Col>
    //               <Col>
    //                 <Button
    //                   size='sm'
    //                   onClick={() => {
    //                     let newMotionPreset = motionPreset.slice()
    //                     newMotionPreset[droneIndex] = "circle"
    //                     setMotionPreset(newMotionPreset);
    //                   }
    //                   }>
    //                   Circle
    //                 </Button>
    //               </Col>
    //               <Col>
    //                 <Button
    //                   size='sm'
    //                   onClick={() => {
    //                     let newMotionPreset = motionPreset.slice()
    //                     newMotionPreset[droneIndex] = "square"
    //                     setMotionPreset(newMotionPreset);
    //                   }
    //                   }>
    //                   Square
    //                 </Button>
    //               </Col>
    //               <Col>
    //                 <Button
    //                   size='sm'
    //                   onClick={async () => {
    //                     await moveToPos([0, 0, LAND_Z_HEIGHT], droneIndex)

    //                     let newDroneArmed = droneArmed.slice()
    //                     newDroneArmed[droneIndex] = false
    //                     setDroneArmed(newDroneArmed);

    //                     let newMotionPreset = motionPreset.slice()
    //                     newMotionPreset[droneIndex] = "setpoint"
    //                     setMotionPreset(newMotionPreset);
    //                   }
    //                   }>
    //                   Land
    //                 </Button>
    //               </Col>
    //             </Row>
    //           </>
    //         ))}
    //         <Row className='pt-3'>
    //           <Col xs={{ offset: 2 }} className='text-center'>
    //             Pos P
    //           </Col>
    //           <Col className='text-center'>
    //             Pos I
    //           </Col>
    //           <Col className='text-center'>
    //             Pos D
    //           </Col>
    //         </Row>
    //         <Row className='pt-2'>
    //           <Col xs={2} className='pt-2 text-end'>
    //             XY
    //           </Col>
    //           <Col>
    //             <Form.Control
    //               value={dronePID[0]}
    //               onChange={(event) => {
    //                 let newDronePID = dronePID.slice()
    //                 newDronePID[0] = event.target.value
    //                 setDronePID(newDronePID)
    //               }}
    //             />
    //           </Col>
    //           <Col>
    //             <Form.Control
    //               value={dronePID[1]}
    //               onChange={(event) => {
    //                 let newDronePID = dronePID.slice()
    //                 newDronePID[1] = event.target.value
    //                 setDronePID(newDronePID)
    //               }}
    //             />
    //           </Col>
    //           <Col>
    //             <Form.Control
    //               value={dronePID[2]}
    //               onChange={(event) => {
    //                 let newDronePID = dronePID.slice()
    //                 newDronePID[2] = event.target.value
    //                 setDronePID(newDronePID)
    //               }}
    //             />
    //           </Col>
    //         </Row>
    //         <Row className='pt-3'>
    //           <Col xs={2} className='pt-2 text-end'>
    //             Z
    //           </Col>
    //           <Col>
    //             <Form.Control
    //               value={dronePID[3]}
    //               onChange={(event) => {
    //                 let newDronePID = dronePID.slice()
    //                 newDronePID[3] = event.target.value
    //                 setDronePID(newDronePID)
    //               }}
    //             />
    //           </Col>
    //           <Col>
    //             <Form.Control
    //               value={dronePID[4]}
    //               onChange={(event) => {
    //                 let newDronePID = dronePID.slice()
    //                 newDronePID[4] = event.target.value
    //                 setDronePID(newDronePID)
    //               }}
    //             />
    //           </Col>
    //           <Col>
    //             <Form.Control
    //               value={dronePID[5]}
    //               onChange={(event) => {
    //                 let newDronePID = dronePID.slice()
    //                 newDronePID[5] = event.target.value
    //                 setDronePID(newDronePID)
    //               }}
    //             />
    //           </Col>
    //         </Row>
    //         <Row className='pt-3'>
    //           <Col xs={2} className='pt-2 text-end'>
    //             YAW
    //           </Col>
    //           <Col>
    //             <Form.Control
    //               value={dronePID[6]}
    //               onChange={(event) => {
    //                 let newDronePID = dronePID.slice()
    //                 newDronePID[6] = event.target.value
    //                 setDronePID(newDronePID)
    //               }}
    //             />
    //           </Col>
    //           <Col>
    //             <Form.Control
    //               value={dronePID[7]}
    //               onChange={(event) => {
    //                 let newDronePID = dronePID.slice()
    //                 newDronePID[7] = event.target.value
    //                 setDronePID(newDronePID)
    //               }}
    //             />
    //           </Col>
    //           <Col>
    //             <Form.Control
    //               value={dronePID[8]}
    //               onChange={(event) => {
    //                 let newDronePID = dronePID.slice()
    //                 newDronePID[8] = event.target.value
    //                 setDronePID(newDronePID)
    //               }}
    //             />
    //           </Col>
    //         </Row>
    //         <Row className='pt-3'>
    //           <Col xs={{ offset: 2 }} className='text-center'>
    //             Vel P
    //           </Col>
    //           <Col className='text-center'>
    //             Vel I
    //           </Col>
    //           <Col className='text-center'>
    //             Vel D
    //           </Col>
    //         </Row>
    //         <Row className='pt-2'>
    //           <Col xs={2} className='pt-2 text-end'>
    //             XY
    //           </Col>
    //           <Col>
    //             <Form.Control
    //               value={dronePID[9]}
    //               onChange={(event) => {
    //                 let newDronePID = dronePID.slice()
    //                 newDronePID[9] = event.target.value
    //                 setDronePID(newDronePID)
    //               }}
    //             />
    //           </Col>
    //           <Col>
    //             <Form.Control
    //               value={dronePID[10]}
    //               onChange={(event) => {
    //                 let newDronePID = dronePID.slice()
    //                 newDronePID[10] = event.target.value
    //                 setDronePID(newDronePID)
    //               }}
    //             />
    //           </Col>
    //           <Col>
    //             <Form.Control
    //               value={dronePID[11]}
    //               onChange={(event) => {
    //                 let newDronePID = dronePID.slice()
    //                 newDronePID[11] = event.target.value
    //                 setDronePID(newDronePID)
    //               }}
    //             />
    //           </Col>
    //         </Row>
    //         <Row className='pt-3'>
    //           <Col xs={2} className='pt-2 text-end'>
    //             Z
    //           </Col>
    //           <Col>
    //             <Form.Control
    //               value={dronePID[12]}
    //               onChange={(event) => {
    //                 let newDronePID = dronePID.slice()
    //                 newDronePID[12] = event.target.value
    //                 setDronePID(newDronePID)
    //               }}
    //             />
    //           </Col>
    //           <Col>
    //             <Form.Control
    //               value={dronePID[13]}
    //               onChange={(event) => {
    //                 let newDronePID = dronePID.slice()
    //                 newDronePID[13] = event.target.value
    //                 setDronePID(newDronePID)
    //               }}
    //             />
    //           </Col>
    //           <Col>
    //             <Form.Control
    //               value={dronePID[14]}
    //               onChange={(event) => {
    //                 let newDronePID = dronePID.slice()
    //                 newDronePID[14] = event.target.value
    //                 setDronePID(newDronePID)
    //               }}
    //             />
    //           </Col>
    //         </Row>
    //         <Row>
    //           <Col>
    //             <Row className="mt-3 mb-1">
    //               <Col xs={4}>
    //                 <Form.Label>X Trim: {droneTrim[0]}</Form.Label>
    //               </Col>
    //               <Col>
    //                 <Form.Range value={droneTrim[0]} min={-800} max={800} onChange={(event) => {
    //                   let newDroneTrim = droneTrim.slice()
    //                   newDroneTrim[0] = event.target.value
    //                   setDroneTrim(newDroneTrim)
    //                 }} />
    //               </Col>
    //             </Row>
    //             <Row className="mb-1">
    //               <Col xs={4}>
    //                 <Form.Label>Y Trim: {droneTrim[1]}</Form.Label>
    //               </Col>
    //               <Col>
    //                 <Form.Range value={droneTrim[1]} min={-800} max={800} onChange={(event) => {
    //                   let newDroneTrim = droneTrim.slice()
    //                   newDroneTrim[1] = event.target.value
    //                   setDroneTrim(newDroneTrim)
    //                 }} />
    //               </Col>
    //             </Row>
    //             <Row className="mb-1">
    //               <Col xs={4}>
    //                 <Form.Label>Z Trim: {droneTrim[2]}</Form.Label>
    //               </Col>
    //               <Col>
    //                 <Form.Range value={droneTrim[2]} min={-800} max={800} onChange={(event) => {
    //                   let newDroneTrim = droneTrim.slice()
    //                   newDroneTrim[2] = event.target.value
    //                   setDroneTrim(newDroneTrim)
    //                 }} />
    //               </Col>
    //             </Row>
    //             <Row className="mb-1">
    //               <Col xs={4}>
    //                 <Form.Label>Yaw Trim: {droneTrim[3]}</Form.Label>
    //               </Col>
    //               <Col>
    //                 <Form.Range value={droneTrim[3]} min={-800} max={800} onChange={(event) => {
    //                   let newDroneTrim = droneTrim.slice()
    //                   newDroneTrim[3] = event.target.value
    //                   setDroneTrim(newDroneTrim)
    //                 }} />
    //               </Col>
    //             </Row>
    //           </Col>
    //         </Row>
    //         <Row className='pt-3'>
    //           <Col className='pt-2'>
    //             Ground Effect Coef.
    //           </Col>
    //           <Col>
    //             <Form.Control
    //               value={dronePID[15]}
    //               onChange={(event) => {
    //                 let newDronePID = dronePID.slice()
    //                 newDronePID[15] = event.target.value
    //                 setDronePID(newDronePID)
    //               }}
    //             />
    //           </Col>
    //           <Col className='pt-2'>
    //             Ground Effect Offset
    //           </Col>
    //           <Col>
    //             <Form.Control
    //               value={dronePID[16]}
    //               onChange={(event) => {
    //                 let newDronePID = dronePID.slice()
    //                 newDronePID[16] = event.target.value
    //                 setDronePID(newDronePID)
    //               }}
    //             />
    //           </Col>
    //         </Row>
    //       </Card>
    //     </Col>
    //   </Row>
    //   <Row className='pt-3'>
    //     <Col>
    //       <Card className='shadow-sm p-3'>
    //         <Chart filteredObjectsRef={filteredObjects} droneSetpointHistoryRef={droneSetpointHistory} objectPointCount={objectPointCount} dronePID={dronePID.map(x => parseFloat(x))} droneArmed={droneArmed} currentDroneIndex={currentDroneIndex} />
    //       </Card>
    //     </Col>
    //   </Row>
    //   <Row className='pt-3'>
    //     <Col>
    //       <Card className='shadow-sm p-3'>
    //         <Row>
    //           <Col xs="auto">
    //             {/* <h4>Scene Viewer {objectPointErrors.current.length !== 0 ? mean(objectPointErrors.current.flat()) : ""}</h4> */}
    //           </Col>
    //         </Row>
    //         <Row>
    //           <Col style={{ height: "1000px" }}>
    //             <Canvas orthographic camera={{ zoom: 1000, position: [0, 0, 10] }}>
    //               <ambientLight />
    //               {cameraPoses.map(({ R, t }, i) => (
    //                 <CameraWireframe R={R} t={t} toWorldCoordsMatrix={toWorldCoordsMatrix} key={i} />
    //               ))}
    //               {cameraPositions.map((position, i) => (
    //                 <CameraPosition position={position} direction={cameraDirections[i]} key={i} />
    //               ))}
    //               <Points objectPointsRef={objectPoints} objectPointErrorsRef={objectPointErrors} count={objectPointCount} />
    //               <Objects filteredObjectsRef={filteredObjects} count={objectPointCount} />
    //               <TrajectoryPlanningSetpoints trajectoryPlanningSetpoints={trajectoryPlanningSetpoints} NUM_DRONES={NUM_DRONES} />
    //               <OrbitControls />
    //               <axesHelper args={[0.2]} />
    //               <gridHelper args={[4, 4 * 10]} />
    //               <directionalLight />
    //             </Canvas>
    //           </Col>
    //         </Row>
    //       </Card>
    //     </Col>
    //   </Row>
    // </Container>
  )
}
