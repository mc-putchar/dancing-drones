import React, {useState, useEffect} from 'react';
import { Button, Card, Col, Form, Row, Accordion } from 'react-bootstrap';

import { socket } from '../shared/styles/scripts/socket.ts';

import ControlDroneView from './ControlDroneView.tsx';
import TrajectoryView from './TrajectoryView.tsx';

const TRAJECTORY_PLANNING_TIMESTEP = 0.05
const LAND_Z_HEIGHT = 0.075

interface ControlPanelProps {
  ControlView: any,
  currentControlView: any,
  NUM_DRONES: number,
  currentDroneIndex: number,
  setCurrentDroneIndex: React.Dispatch<React.SetStateAction<number>>,
  droneArmed: boolean[],
  setDroneArmed: React.Dispatch<React.SetStateAction<boolean[]>>,
  dronePID: string[],
  setDronePID: React.Dispatch<React.SetStateAction<string[]>>,
  droneSetpointWithMotion: number[],
  setDroneSetpointWithMotion: React.Dispatch<React.SetStateAction<number[]>>,
  filteredObjects: React.MutableRefObject<object[][]>,
  trajectoryPlanningSetpoints: number[][][],
}

  const ControlPanel = (props: ControlPanelProps) => {
    const {
      ControlView,
      currentControlView,
      NUM_DRONES,
      currentDroneIndex,
      setCurrentDroneIndex,
      droneArmed,
      setDroneArmed,
      dronePID,
      setDronePID,
      droneSetpointWithMotion,
      setDroneSetpointWithMotion,
      filteredObjects,
      trajectoryPlanningSetpoints,
    } = props

    const [droneSetpoint, setDroneSetpoint] = useState(Array.apply(null, Array(NUM_DRONES)).map(() => (["0", "0", "0"])))

    const [motionPreset, setMotionPreset] = useState(["setpoint", "setpoint"])

    const [trajectoryPlanningMaxVel, setTrajectoryPlanningMaxVel] = useState(["1", "1", "1"])
    const [trajectoryPlanningMaxAccel, setTrajectoryPlanningMaxAccel] = useState(["1", "1", "1"])
    const [trajectoryPlanningMaxJerk, setTrajectoryPlanningMaxJerk] = useState(["0.5", "0.5", "0.5"])

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
  
    // Prepares and sends the set of points to the backend.
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
      <Card className='shadow-sm p-3 h-100'>
        <div style={{display: (currentControlView === ControlView.ControlDrone) ? 'block' : 'none' }}> 
          <ControlDroneView
            NUM_DRONES={NUM_DRONES}
            currentDroneIndex={currentDroneIndex}
            setCurrentDroneIndex={setCurrentDroneIndex}
            droneArmed={droneArmed}
            setDroneArmed={setDroneArmed}
            droneSetpoint={droneSetpoint}
            setDroneSetpoint={setDroneSetpoint}
            motionPreset={motionPreset}
            setMotionPreset={setMotionPreset}
            dronePID={dronePID}
            setDronePID={setDronePID}
            moveToPos={moveToPos}
          />
        </div>
        <div style={{display: (currentControlView === ControlView.GenerateTrajectory) ? 'block' : 'none' }}> 
          <TrajectoryView
            NUM_DRONES={NUM_DRONES}
            droneArmed={droneArmed}
            trajectoryPlanningMaxVel={trajectoryPlanningMaxVel}
            setTrajectoryPlanningMaxVel={setTrajectoryPlanningMaxVel}
            trajectoryPlanningMaxAccel={trajectoryPlanningMaxAccel}
            setTrajectoryPlanningMaxAccel={setTrajectoryPlanningMaxAccel}
            trajectoryPlanningMaxJerk={trajectoryPlanningMaxJerk}
            setTrajectoryPlanningMaxJerk={setTrajectoryPlanningMaxJerk}
            trajectoryPlanningRunStartTimestamp={trajectoryPlanningRunStartTimestamp}
            setTrajectoryPlanningRunStartTimestamp={setTrajectoryPlanningRunStartTimestamp}
            motionPreset={motionPreset}
            setMotionPreset={setMotionPreset}
            moveToPos={moveToPos}
            planTrajectory={planTrajectory}
          />
        </div>
      </Card>
    )
  }
  

export default ControlPanel;
