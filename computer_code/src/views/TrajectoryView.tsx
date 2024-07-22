import React, { useState } from 'react';
import { Button, Card, Col, Form, Row } from 'react-bootstrap';

interface TrajectoryViewProps {
  NUM_DRONES: number;
  droneArmed: boolean[];
  trajectoryPlanningMaxVel: string[];
  setTrajectoryPlanningMaxVel: React.Dispatch<React.SetStateAction<string[]>>;
  trajectoryPlanningMaxAccel: string[];
  setTrajectoryPlanningMaxAccel: React.Dispatch<React.SetStateAction<string[]>>;
  trajectoryPlanningMaxJerk: string[];
  setTrajectoryPlanningMaxJerk: React.Dispatch<React.SetStateAction<string[]>>;
  trajectoryPlanningRunStartTimestamp: number;
  setTrajectoryPlanningRunStartTimestamp: React.Dispatch<React.SetStateAction<number>>;
  motionPreset: string[];
  setMotionPreset: React.Dispatch<React.SetStateAction<string[]>>;

  moveToPos: (
    pos: number[],
    droneIndex: number
  ) => Promise<void>;

  planTrajectory: (
    waypoints: object,
    maxVel: number[],
    maxAccel: number[],
    maxJerk: number[],
    timestep: number
  ) => Promise<number[][]>;
}

const TrajectoryView = (props: TrajectoryViewProps) => {
  const {
    NUM_DRONES,
    droneArmed,
    trajectoryPlanningMaxVel,
    setTrajectoryPlanningMaxVel,
    trajectoryPlanningMaxAccel,
    setTrajectoryPlanningMaxAccel,
    trajectoryPlanningMaxJerk,
    setTrajectoryPlanningMaxJerk,
    trajectoryPlanningRunStartTimestamp,
    setTrajectoryPlanningRunStartTimestamp,
    motionPreset,
    setMotionPreset,
    moveToPos,
    planTrajectory,
  } = props;
  
  // const [trajectoryPlanningWaypoints, setTrajectoryPlanningWaypoints] = useState("[0.2,0.2,0.5,true],\n[-0.2,0.2,0.5,true],\n[-0.2,0.2,0.8,true],\n[-0.2,-0.2,0.8,true],\n[-0.2,-0.2,0.5,true],\n[0.2,-0.2,0.5,true],\n[0.2,-0.2,0.8,true],\n[0.2,0.2,0.8,true],\n[0.2,0.2,0.5,true]\n]")
  const [trajectoryPlanningWaypoints, setTrajectoryPlanningWaypoints] = useState("[\n[0.2,0.2,0.6,0,0,0.8,true],\n[-0.2,0.2,0.6,0.2,0.2,0.6,true],\n[-0.2,-0.2,0.5,0,0,0.4,true],\n[0.2,-0.2,0.5,-0.2,-0.2,0.6,true],\n[0.2,0.2,0.5,0,0,0.8,true]\n]")
  
  return (
    <Card className='shadow-sm p-3 h-100'>
      <Row className='pt-1'>
        <Col xs={{ offset: 3 }} className='text-center'>
          X
        </Col>
        <Col className='text-center'>
          Y
        </Col>
        <Col className='text-center'>
          Z
        </Col>
      </Row>
      <Row className='pt-2'>
        <Col xs={3} className='pt-2 text-end'>
          Max Vel
        </Col>
        <Col>
          <Form.Control
            value={trajectoryPlanningMaxVel[0]}
            onChange={(event) => {
              let newTrajectoryPlanningMaxVel = trajectoryPlanningMaxVel.slice()
              newTrajectoryPlanningMaxVel[0] = event.target.value
              setTrajectoryPlanningMaxVel(newTrajectoryPlanningMaxVel)
            }}
          />
        </Col>
        <Col>
          <Form.Control
            value={trajectoryPlanningMaxVel[1]}
            onChange={(event) => {
              let newTrajectoryPlanningMaxVel = trajectoryPlanningMaxVel.slice()
              newTrajectoryPlanningMaxVel[1] = event.target.value
              setTrajectoryPlanningMaxVel(newTrajectoryPlanningMaxVel)
            }}
          />
        </Col>
        <Col>
          <Form.Control
            value={trajectoryPlanningMaxVel[2]}
            onChange={(event) => {
              let newTrajectoryPlanningMaxVel = trajectoryPlanningMaxVel.slice()
              newTrajectoryPlanningMaxVel[2] = event.target.value
              setTrajectoryPlanningMaxVel(newTrajectoryPlanningMaxVel)
            }}
          />
        </Col>
      </Row>
      <Row className='pt-2'>
        <Col xs={3} className='pt-2 text-end'>
          Max Accel
        </Col>
        <Col>
          <Form.Control
            value={trajectoryPlanningMaxAccel[0]}
            onChange={(event) => {
              let newTrajectoryPlanningMaxAccel = trajectoryPlanningMaxAccel.slice()
              newTrajectoryPlanningMaxAccel[0] = event.target.value
              setTrajectoryPlanningMaxAccel(newTrajectoryPlanningMaxAccel)
            }}
          />
        </Col>
        <Col>
          <Form.Control
            value={trajectoryPlanningMaxAccel[1]}
            onChange={(event) => {
              let newTrajectoryPlanningMaxAccel = trajectoryPlanningMaxAccel.slice()
              newTrajectoryPlanningMaxAccel[1] = event.target.value
              setTrajectoryPlanningMaxAccel(newTrajectoryPlanningMaxAccel)
            }}
          />
        </Col>
        <Col>
          <Form.Control
            value={trajectoryPlanningMaxAccel[2]}
            onChange={(event) => {
              let newTrajectoryPlanningMaxAccel = trajectoryPlanningMaxAccel.slice()
              newTrajectoryPlanningMaxAccel[2] = event.target.value
              setTrajectoryPlanningMaxAccel(newTrajectoryPlanningMaxAccel)
            }}
          />
        </Col>
      </Row>
      <Row className='pt-2'>
        <Col xs={3} className='pt-2 text-end'>
          Max Jerk
        </Col>
        <Col>
          <Form.Control
            value={trajectoryPlanningMaxJerk[0]}
            onChange={(event) => {
              let newTrajectoryPlanningMaxJerk = trajectoryPlanningMaxJerk.slice()
              newTrajectoryPlanningMaxJerk[0] = event.target.value
              setTrajectoryPlanningMaxJerk(newTrajectoryPlanningMaxJerk)
            }}
          />
        </Col>
        <Col>
          <Form.Control
            value={trajectoryPlanningMaxJerk[1]}
            onChange={(event) => {
              let newTrajectoryPlanningMaxJerk = trajectoryPlanningMaxJerk.slice()
              newTrajectoryPlanningMaxJerk[1] = event.target.value
              setTrajectoryPlanningMaxJerk(newTrajectoryPlanningMaxJerk)
            }}
          />
        </Col>
        <Col>
          <Form.Control
            value={trajectoryPlanningMaxJerk[2]}
            onChange={(event) => {
              let newTrajectoryPlanningMaxJerk = trajectoryPlanningMaxJerk.slice()
              newTrajectoryPlanningMaxJerk[2] = event.target.value
              setTrajectoryPlanningMaxJerk(newTrajectoryPlanningMaxJerk)
            }}
          />
        </Col>
      </Row>
      <Row className='pt-3'>
        <Col>
          Waypoints <code>[drone index, x, y, z, stop at waypoint]</code>
        </Col>
      </Row>
      <Row className='pt-1'>
        <Col>
          <Form.Control
            as="textarea"
            rows={5}
            value={trajectoryPlanningWaypoints}
            onChange={(event) => setTrajectoryPlanningWaypoints(event.target.value)}
          />
        </Col>
      </Row>
      <Row className='pt-3'>
        <Col>
          <Button
            size='sm'
            className='float-end'
            variant={droneArmed ? "outline-danger" : "outline-primary"}
            onClick={async () => {
              setMotionPreset(new Array(NUM_DRONES).fill("none"))
              const initPos = JSON.parse(trajectoryPlanningWaypoints)[0].slice(0, 3)
              await Promise.all(Array.from(Array(NUM_DRONES).keys()).map(async (droneIndex) => {
                await moveToPos(initPos, droneIndex)
              }))
              setTrajectoryPlanningRunStartTimestamp(Date.now() / 1000)
              setMotionPreset(new Array(NUM_DRONES).fill("plannedTrajectory"))
            }}
          >
            Run
          </Button>
          <Button
            size='sm'
            className='float-end me-2'
            variant={droneArmed ? "outline-danger" : "outline-primary"}
            onClick={async () => {
              const tempSetpoints = await planTrajectory(
                JSON.parse(trajectoryPlanningWaypoints),
                trajectoryPlanningMaxVel.map(x => parseFloat(x)),
                trajectoryPlanningMaxAccel.map(x => parseFloat(x)),
                trajectoryPlanningMaxJerk.map(x => parseFloat(x)),
                TRAJECTORY_PLANNING_TIMESTEP
              )
              setTrajectoryPlanningSetpoints(tempSetpoints)
            }}
          >
            Preview
          </Button>
        </Col>
      </Row>
    </Card>
  );
}

export default TrajectoryView;
