"use client";

import { FormEventHandler, useState, createRef, Ref, useRef, useEffect } from 'react';
import { Button, Card, Col, Container, Row } from 'react-bootstrap';
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
import Chart from './components/chart';
import TrajectoryPlanningSetpoints from './components/TrajectoryPlanningSetpoints';
import CameraPosition from './components/CameraPosition';

import CameraStream from './views/CameraStream';
import CameraSettings from './views/CameraSettings';
import ThreeJSChart from './views/SceneView';

const TRAJECTORY_PLANNING_TIMESTEP = 0.05
const LAND_Z_HEIGHT = 0.075
const NUM_DRONES = 1

export default function App() {
  const [cameraStreamRunning, setCameraStreamRunning] = useState(false);

  const objectPoints = useRef<number[][][]>([])
  const filteredObjects = useRef<object[][]>([])
  const droneSetpointHistory = useRef<number[][]>([])
  const objectPointErrors = useRef<Array<Array<number>>>([])
  const objects = useRef<Array<Array<Object>>>([])
  const [objectPointCount, setObjectPointCount] = useState(0);

  const [cameraPoses, setCameraPoses] = useState<Array<object>>([{ "R": [[1, 0, 0], [0, 1, 0], [0, 0, 1]], "t": [0, 0, 0] }, { "R": [[-0.0008290000610233772, -0.7947131755287576, 0.6069845808584402], [0.7624444396180684, 0.3922492478955913, 0.5146056781855716], [-0.6470531579819294, 0.46321862674804054, 0.6055994671226776]], "t": [-2.6049886186449047, -2.173986915510569, 0.7303458563542193] }, { "R": [[-0.9985541623963866, -0.028079891357569067, -0.045837806036037466], [-0.043210651917521686, -0.08793122558361385, 0.9951888962042462], [-0.03197537054848707, 0.995730696156702, 0.0865907408997996]], "t": [0.8953888630067902, -3.4302652822708373, 3.70967106300893] }, { "R": [[-0.4499864100408215, 0.6855400696798954, -0.5723172578577878], [-0.7145273934510732, 0.10804105689305427, 0.6912146801345055], [0.5356891214002657, 0.7199735709654319, 0.4412201517663212]], "t": [2.50141072072536, -2.313616767292231, 1.8529907514099284] }])
  const [toWorldCoordsMatrix, setToWorldCoordsMatrix] = useState<number[][]>([[0.9941338485260931, 0.0986512964608827, -0.04433748889242502, 0.9938296704767513], [-0.0986512964608827, 0.659022672138982, -0.7456252673517598, 2.593331619023365], [0.04433748889242498, -0.7456252673517594, -0.6648888236128887, 2.9576262456228286], [0, 0, 0, 1]])

  const [cameraPositions, setCameraPositions] = useState<number[][]>([]);
  const [cameraDirections, setCameraDirections] = useState<number[][]>([]);

  const [currentDroneIndex, setCurrentDroneIndex] = useState(0)
  const [droneArmed, setDroneArmed] = useState(Array.apply(null, Array(NUM_DRONES)).map(() => (false)))
  const [dronePID, setDronePID] = useState(["1", "0", "0", "1.5", "0", "0", "0.3", "0.1", "0.05", "0.2", "0.03", "0.05", "0.3", "0.1", "0.05", "28", "-0.035"])
  const [droneSetpoint, setDroneSetpoint] = useState(Array.apply(null, Array(NUM_DRONES)).map(() => (["0", "0", "0"])))
  const [droneSetpointWithMotion, setDroneSetpointWithMotion] = useState([0, 0, 0])
  const [droneTrim, setDroneTrim] = useState(["0", "0", "0", "0"])

  const [motionPreset, setMotionPreset] = useState(["setpoint", "setpoint"])

  const [trajectoryPlanningMaxVel, setTrajectoryPlanningMaxVel] = useState(["1", "1", "1"])
  const [trajectoryPlanningMaxAccel, setTrajectoryPlanningMaxAccel] = useState(["1", "1", "1"])
  const [trajectoryPlanningMaxJerk, setTrajectoryPlanningMaxJerk] = useState(["0.5", "0.5", "0.5"])
  // const [trajectoryPlanningWaypoints, setTrajectoryPlanningWaypoints] = useState("[0.2,0.2,0.5,true],\n[-0.2,0.2,0.5,true],\n[-0.2,0.2,0.8,true],\n[-0.2,-0.2,0.8,true],\n[-0.2,-0.2,0.5,true],\n[0.2,-0.2,0.5,true],\n[0.2,-0.2,0.8,true],\n[0.2,0.2,0.8,true],\n[0.2,0.2,0.5,true]\n]")
  const [trajectoryPlanningWaypoints, setTrajectoryPlanningWaypoints] = useState("[\n[0.2,0.2,0.6,0,0,0.8,true],\n[-0.2,0.2,0.6,0.2,0.2,0.6,true],\n[-0.2,-0.2,0.5,0,0,0.4,true],\n[0.2,-0.2,0.5,-0.2,-0.2,0.6,true],\n[0.2,0.2,0.5,0,0,0.8,true]\n]")
  const [trajectoryPlanningSetpoints, setTrajectoryPlanningSetpoints] = useState<number[][][]>([])
  const [trajectoryPlanningRunStartTimestamp, setTrajectoryPlanningRunStartTimestamp] = useState(0)

  useEffect(() => {
    let count = 0
    socket.emit("arm-drone", { droneArmed, count, currentDroneIndex })
    const pingInterval = setInterval(() => {
      count += 1
      socket.emit("arm-drone", { droneArmed, count, currentDroneIndex })
    }, 500)

    return () => {
      clearInterval(pingInterval)
    }
  }, [droneArmed])

  useEffect(() => {
    for (let droneIndex = 0; droneIndex < NUM_DRONES; droneIndex++) {
      socket.emit("set-drone-pid", { dronePID, droneIndex })
    }
  }, [dronePID])

  useEffect(() => {
    socket.emit("set-drone-trim", { droneTrim, droneIndex: currentDroneIndex })
  }, [droneTrim])

  useEffect(() => {
    let timestamp = Date.now() / 1000
    let motionIntervals: NodeJS.Timer[] = []

    for (let droneIndex = 0; droneIndex < NUM_DRONES; droneIndex++) {
      if (motionPreset[droneIndex] !== "setpoint") {
        motionIntervals.push(setInterval(() => {
          timestamp = Date.now() / 1000
          let tempDroneSetpoint = [] as number[]

          switch (motionPreset[droneIndex]) {
            case "none": {
              break;
            }

            case "circle": {
              const radius = 0.3
              const period = 10

              let tempDroneSetpoint: number[] = []

              // drones doing circles demo
              switch (droneIndex) {
                case 0: {
                  tempDroneSetpoint = [
                    radius * Math.cos(timestamp * 2 * Math.PI / period),
                    radius * Math.sin(timestamp * 2 * Math.PI / period),
                    parseFloat(droneSetpoint[droneIndex][2])
                  ]
                  break;
                }

                case 1: {
                  tempDroneSetpoint = [
                    0,
                    radius * Math.cos(timestamp * 2 * Math.PI / period),
                    parseFloat(droneSetpoint[droneIndex][2]) + radius * Math.sin(timestamp * 2 * Math.PI / period)
                  ]
                  break;
                }
              }
              tempDroneSetpoint.map(x => x.toFixed(3))
              socket.emit("set-drone-setpoint", { "droneSetpoint": tempDroneSetpoint, droneIndex })
              break;
            }

            case "square": {
              const size = 0.2
              const period = 20
              let offset = [0, 0]
              switch (Math.floor((timestamp * 4) / period) % 4) {
                case 0:
                  offset = [1, 1]
                  break
                case 1:
                  offset = [1, -1]
                  break
                case 2:
                  offset = [-1, -1]
                  break
                case 3:
                  offset = [-1, 1]
                  break
              }

              tempDroneSetpoint = [
                parseFloat(droneSetpoint[droneIndex][0]) + (offset[0] * size),
                parseFloat(droneSetpoint[droneIndex][1]) + (offset[1] * size),
                parseFloat(droneSetpoint[droneIndex][2])
              ]
              tempDroneSetpoint.map(x => x.toFixed(3))
              socket.emit("set-drone-setpoint", { "droneSetpoint": tempDroneSetpoint, droneIndex })
              break;
            }

            case "plannedTrajectory": {
              const index = Math.floor((timestamp - trajectoryPlanningRunStartTimestamp) / TRAJECTORY_PLANNING_TIMESTEP)
              if (index < trajectoryPlanningSetpoints.length) {
                tempDroneSetpoint = trajectoryPlanningSetpoints[droneIndex][index]
                tempDroneSetpoint.map(x => x.toFixed(3))
                socket.emit("set-drone-setpoint", { "droneSetpoint": tempDroneSetpoint, droneIndex })
              }
              else {
                let newMotionPreset = motionPreset.slice()
                newMotionPreset[droneIndex] = "setpoint"
                setMotionPreset(newMotionPreset)
              }
              break;
            }

            default:
              break;
          }

          if (droneIndex === currentDroneIndex) {
            setDroneSetpointWithMotion(tempDroneSetpoint)
          }
        }, TRAJECTORY_PLANNING_TIMESTEP * 1000))
      }
      else {
        if (droneIndex === currentDroneIndex) {
          setDroneSetpointWithMotion(droneSetpoint[droneIndex].map(x => parseFloat(x)))
        }
        socket.emit("set-drone-setpoint", { "droneSetpoint": droneSetpoint[droneIndex], droneIndex })
      }
    }

    return () => {
      motionIntervals.forEach(motionInterval => {
        clearInterval(motionInterval)
      })
    }
  }, [motionPreset, droneSetpoint, trajectoryPlanningRunStartTimestamp])

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
      if (data["filtered_objects"].length != 0) {
        filteredObjects.current.push(data["filtered_objects"])
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

  const planTrajectory = async (waypoints: object, maxVel: number[], maxAccel: number[], maxJerk: number[], timestep: number) => {
    const location = window.location.hostname;
    const settings = {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        waypoints,
        maxVel,
        maxAccel,
        maxJerk,
        timestep
      })
    };
    const fetchResponse = await fetch(`http://localhost:3001/api/trajectory-planning`, settings);
    const data = await fetchResponse.json();

    return data.setpoints
  }

  const wait = async (ms: number) => new Promise(r => setTimeout(r, ms))

  const moveToPos = async (pos: number[], droneIndex: number) => {
    console.log(filteredObjects.current[filteredObjects.current.length - 1][droneIndex])
    const waypoints = [
      filteredObjects.current[filteredObjects.current.length - 1][droneIndex]["pos"].concat([true]),
      pos.concat([true])
    ]
    const setpoints = await planTrajectory(
      waypoints,
      trajectoryPlanningMaxVel.map(x => parseFloat(x)),
      trajectoryPlanningMaxAccel.map(x => parseFloat(x)),
      trajectoryPlanningMaxJerk.map(x => parseFloat(x)),
      TRAJECTORY_PLANNING_TIMESTEP
    )

    for await (const [i, setpoint] of setpoints.entries()) {
      setpoint.map(x => x.toFixed(3))
      socket.emit("set-drone-setpoint", { "droneSetpoint": setpoint, droneIndex })
      setDroneSetpointWithMotion(setpoint)

      // if (land && i > 0.75*setpoints.length && filteredObjects.current[filteredObjects.current.length-1]["vel"][2] >= -0.2) {
      //   setDroneArmed(false)
      // }

      await wait(TRAJECTORY_PLANNING_TIMESTEP * 1000)
    }
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
            <CameraSettings
              cameraPoses={cameraPoses}
              setCameraPoses={setCameraPoses}
              toWorldCoordsMatrix={toWorldCoordsMatrix}
              setToWorldCoordsMatrix={setToWorldCoordsMatrix}
              objectPoints={objectPoints}
              cameraStreamRunning={cameraStreamRunning}
            />
          </Col>
          <Col style={{width: '80%'}}>
            <ThreeJSChart
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
