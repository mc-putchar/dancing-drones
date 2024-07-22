import React, { useState, useEffect } from 'react';
import { Button, Card, Col, Container, Row, Form } from 'react-bootstrap';
import { socket } from '../shared/styles/scripts/socket';

const TRAJECTORY_PLANNING_TIMESTEP = 0.05;
const LAND_Z_HEIGHT = 0.075;

interface ControlDroneViewProps {
  NUM_DRONES: number;
  currentDroneIndex: number;
  setCurrentDroneIndex: React.Dispatch<React.SetStateAction<number>>;
  droneArmed: boolean[];
  setDroneArmed: React.Dispatch<React.SetStateAction<boolean[]>>;
  droneSetpoint: string[][];
  setDroneSetpoint: React.Dispatch<React.SetStateAction<string[][]>>;
  motionPreset: string[];
  setMotionPreset: React.Dispatch<React.SetStateAction<string[]>>;
  dronePID: string[];
  setDronePID: React.Dispatch<React.SetStateAction<string[]>>;
  moveToPos: (pos: number[], droneIndex: number) => Promise<void>;
}

const ControlDroneView = (props: ControlDroneViewProps) => {
  const {
    NUM_DRONES,
    currentDroneIndex,
    setCurrentDroneIndex,
    droneArmed,
    setDroneArmed,
    droneSetpoint,
    setDroneSetpoint,
    motionPreset,
    setMotionPreset,
    dronePID,
    setDronePID,
    moveToPos

  } = props;

  const [droneTrim, setDroneTrim] = useState(["0", "0", "0", "0"])

  useEffect(() => {
    console.log(droneTrim)
    socket.emit("set-drone-trim", { droneTrim, droneIndex: currentDroneIndex })
  }, [droneTrim])

  return (
    <Container fluid>
        <Row>
          <Col>
            <Card className='shadow-sm p-3'>
              <Row>
                <Col xs="4">
                  <Form.Select value={currentDroneIndex} onChange={(e) => setCurrentDroneIndex(parseInt(e.target.value))} size='sm'>
                    <option value="0">Drone 0</option>
                    <option value="1">Drone 1</option>
                  </Form.Select>
                </Col>
              </Row>
              {Array.from(Array(NUM_DRONES).keys()).map((droneIndex) => (
                <React.Fragment key={droneIndex}>
                  <Row className='pt-4'>
                    <Col xs="3">
                      <h5>Drone {droneIndex}</h5>
                    </Col>
                    <Col className='text-center'>
                      X
                    </Col>
                    <Col className='text-center'>
                      Y
                    </Col>
                    <Col className='text-center'>
                      Z
                    </Col>
                  </Row>
                  <Row>
                    <Col xs={3} className='pt-2'>
                      Setpoint
                    </Col>
                    <Col>
                      <Form.Control
                        value={droneSetpoint[droneIndex][0]}
                        onChange={(event) => {
                          let newDroneSetpoint = droneSetpoint.slice();
                          newDroneSetpoint[droneIndex][0] = event.target.value;
                          setDroneSetpoint(newDroneSetpoint);
                        }}
                      />
                    </Col>
                    <Col>
                      <Form.Control
                        value={droneSetpoint[droneIndex][1]}
                        onChange={(event) => {
                          let newDroneSetpoint = droneSetpoint.slice();
                          newDroneSetpoint[droneIndex][1] = event.target.value;
                          setDroneSetpoint(newDroneSetpoint);
                        }}
                      />
                    </Col>
                    <Col>
                      <Form.Control
                        value={droneSetpoint[droneIndex][2]}
                        onChange={(event) => {
                          let newDroneSetpoint = droneSetpoint.slice();
                          newDroneSetpoint[droneIndex][2] = event.target.value;
                          setDroneSetpoint(newDroneSetpoint);
                        }}
                      />
                    </Col>
                  </Row>
                  <Row className='pt-3'>
                    <Col>
                      <Button
                        size='sm'
                        variant={droneArmed[droneIndex] ? "outline-danger" : "outline-primary"}
                        onClick={() => {
                          let newDroneArmed = droneArmed.slice();
                          newDroneArmed[droneIndex] = !newDroneArmed[droneIndex];
                          setDroneArmed(newDroneArmed);
                        }}
                      >
                        {droneArmed[droneIndex] ? "Disarm" : "Arm"}
                      </Button>
                    </Col>
                    <Col>
                      <Button
                        size='sm'
                        onClick={() => {
                          let newMotionPreset = motionPreset.slice();
                          newMotionPreset[droneIndex] = "setpoint";
                          setMotionPreset(newMotionPreset);
                        }}
                      >
                        Setpoint
                      </Button>
                    </Col>
                    <Col>
                      <Button
                        size='sm'
                        onClick={() => {
                          let newMotionPreset = motionPreset.slice();
                          newMotionPreset[droneIndex] = "circle";
                          setMotionPreset(newMotionPreset);
                        }}
                      >
                        Circle
                      </Button>
                    </Col>
                    <Col>
                      <Button
                        size='sm'
                        onClick={() => {
                          let newMotionPreset = motionPreset.slice();
                          newMotionPreset[droneIndex] = "square";
                          setMotionPreset(newMotionPreset);
                        }}
                      >
                        Square
                      </Button>
                    </Col>
                    <Col>
                      <Button
                        size='sm'
                        onClick={async () => {
                          await moveToPos([0, 0, LAND_Z_HEIGHT], droneIndex);

                          let newDroneArmed = droneArmed.slice();
                          newDroneArmed[droneIndex] = false;
                          setDroneArmed(newDroneArmed);

                          let newMotionPreset = motionPreset.slice();
                          newMotionPreset[droneIndex] = "setpoint";
                          setMotionPreset(newMotionPreset);
                        }}
                      >
                        Land
                      </Button>
                    </Col>
                  </Row>
                </React.Fragment>
              ))}
              <Row className='pt-3'>
                <Col xs={{ offset: 2 }} className='text-center'>
                  Pos P
                </Col>
                <Col className='text-center'>
                  Pos I
                </Col>
                <Col className='text-center'>
                  Pos D
                </Col>
              </Row>
              <Row className='pt-2'>
                <Col xs={2} className='pt-2 text-end'>
                  XY
                </Col>
                <Col>
                  <Form.Control
                    value={dronePID[0]}
                    onChange={(event) => {
                      let newDronePID = dronePID.slice();
                      newDronePID[0] = event.target.value;
                      setDronePID(newDronePID);
                    }}
                  />
                </Col>
                <Col>
                  <Form.Control
                    value={dronePID[1]}
                    onChange={(event) => {
                      let newDronePID = dronePID.slice();
                      newDronePID[1] = event.target.value;
                      setDronePID(newDronePID);
                    }}
                  />
                </Col>
                <Col>
                  <Form.Control
                    value={dronePID[2]}
                    onChange={(event) => {
                      let newDronePID = dronePID.slice();
                      newDronePID[2] = event.target.value;
                      setDronePID(newDronePID);
                    }}
                  />
                </Col>
              </Row>
              <Row className='pt-3'>
                <Col xs={2} className='pt-2 text-end'>
                  Z
                </Col>
                <Col>
                  <Form.Control
                    value={dronePID[3]}
                    onChange={(event) => {
                      let newDronePID = dronePID.slice();
                      newDronePID[3] = event.target.value;
                      setDronePID(newDronePID);
                    }}
                  />
                </Col>
                <Col>
                  <Form.Control
                    value={dronePID[4]}
                    onChange={(event) => {
                      let newDronePID = dronePID.slice();
                      newDronePID[4] = event.target.value;
                      setDronePID(newDronePID);
                    }}
                  />
                </Col>
                <Col>
                  <Form.Control
                    value={dronePID[5]}
                    onChange={(event) => {
                      let newDronePID = dronePID.slice();
                      newDronePID[5] = event.target.value;
                      setDronePID(newDronePID);
                    }}
                  />
                </Col>
              </Row>
              <Row className='pt-3'>
                <Col xs={2} className='pt-2 text-end'>
                  YAW
                </Col>
                <Col>
                  <Form.Control
                    value={dronePID[6]}
                    onChange={(event) => {
                      let newDronePID = dronePID.slice();
                      newDronePID[6] = event.target.value;
                      setDronePID(newDronePID);
                    }}
                  />
                </Col>
                <Col>
                  <Form.Control
                    value={dronePID[7]}
                    onChange={(event) => {
                      let newDronePID = dronePID.slice();
                      newDronePID[7] = event.target.value;
                      setDronePID(newDronePID);
                    }}
                  />
                </Col>
                <Col>
                  <Form.Control
                    value={dronePID[8]}
                    onChange={(event) => {
                      let newDronePID = dronePID.slice();
                      newDronePID[8] = event.target.value;
                      setDronePID(newDronePID);
                    }}
                  />
                </Col>
              </Row>
              <Row className='pt-3'>
                <Col xs={{ offset: 2 }} className='text-center'>
                  Vel P
                </Col>
                <Col className='text-center'>
                  Vel I
                </Col>
                <Col className='text-center'>
                  Vel D
                </Col>
              </Row>
              <Row className='pt-2'>
                <Col xs={2} className='pt-2 text-end'>
                  XY
                </Col>
                <Col>
                  <Form.Control
                    value={dronePID[9]}
                    onChange={(event) => {
                      let newDronePID = dronePID.slice();
                      newDronePID[9] = event.target.value;
                      setDronePID(newDronePID);
                    }}
                  />
                </Col>
                <Col>
                  <Form.Control
                    value={dronePID[10]}
                    onChange={(event) => {
                      let newDronePID = dronePID.slice();
                      newDronePID[10] = event.target.value;
                      setDronePID(newDronePID);
                    }}
                  />
                </Col>
                <Col>
                  <Form.Control
                    value={dronePID[11]}
                    onChange={(event) => {
                      let newDronePID = dronePID.slice();
                      newDronePID[11] = event.target.value;
                      setDronePID(newDronePID);
                    }}
                  />
                </Col>
              </Row>
              <Row className='pt-3'>
                <Col xs={2} className='pt-2 text-end'>
                  Z
                </Col>
                <Col>
                  <Form.Control
                    value={dronePID[12]}
                    onChange={(event) => {
                      let newDronePID = dronePID.slice();
                      newDronePID[12] = event.target.value;
                      setDronePID(newDronePID);
                    }}
                  />
                </Col>
                <Col>
                  <Form.Control
                    value={dronePID[13]}
                    onChange={(event) => {
                      let newDronePID = dronePID.slice();
                      newDronePID[13] = event.target.value;
                      setDronePID(newDronePID);
                    }}
                  />
                </Col>
                <Col>
                  <Form.Control
                    value={dronePID[14]}
                    onChange={(event) => {
                      let newDronePID = dronePID.slice();
                      newDronePID[14] = event.target.value;
                      setDronePID(newDronePID);
                    }}
                  />
                </Col>
              </Row>
              <Row>
                <Col>
                  <Row className="mt-3 mb-1">
                    <Col xs={4}>
                      <Form.Label>X Trim: {droneTrim[0]}</Form.Label>
                    </Col>
                    <Col>
                      <Form.Range value={droneTrim[0]} min={-800} max={800} onChange={(event) => {
                        let newDroneTrim = droneTrim.slice();
                        newDroneTrim[0] = event.target.value;
                        setDroneTrim(newDroneTrim);
                      }} />
                    </Col>
                  </Row>
                  <Row className="mb-1">
                    <Col xs={4}>
                      <Form.Label>Y Trim: {droneTrim[1]}</Form.Label>
                    </Col>
                    <Col>
                      <Form.Range value={droneTrim[1]} min={-800} max={800} onChange={(event) => {
                        let newDroneTrim = droneTrim.slice();
                        newDroneTrim[1] = event.target.value;
                        setDroneTrim(newDroneTrim);
                      }} />
                    </Col>
                  </Row>
                  <Row className="mb-1">
                    <Col xs={4}>
                      <Form.Label>Z Trim: {droneTrim[2]}</Form.Label>
                    </Col>
                    <Col>
                      <Form.Range value={droneTrim[2]} min={-800} max={800} onChange={(event) => {
                        let newDroneTrim = droneTrim.slice();
                        newDroneTrim[2] = event.target.value;
                        setDroneTrim(newDroneTrim);
                      }} />
                    </Col>
                  </Row>
                  <Row className="mb-1">
                    <Col xs={4}>
                      <Form.Label>Yaw Trim: {droneTrim[3]}</Form.Label>
                    </Col>
                    <Col>
                      <Form.Range value={droneTrim[3]} min={-800} max={800} onChange={(event) => {
                        let newDroneTrim = droneTrim.slice();
                        newDroneTrim[3] = event.target.value;
                        setDroneTrim(newDroneTrim);
                      }} />
                    </Col>
                  </Row>
                </Col>
              </Row>
              <Row className='pt-3'>
                <Col className='pt-2'>
                  Ground Effect Coef.
                </Col>
                <Col>
                  <Form.Control
                    value={dronePID[15]}
                    onChange={(event) => {
                      let newDronePID = dronePID.slice();
                      newDronePID[15] = event.target.value;
                      setDronePID(newDronePID);
                    }}
                  />
                </Col>
                <Col className='pt-2'>
                  Ground Effect Offset
                </Col>
                <Col>
                  <Form.Control
                    value={dronePID[16]}
                    onChange={(event) => {
                      let newDronePID = dronePID.slice();
                      newDronePID[16] = event.target.value;
                      setDronePID(newDronePID);
                    }}
                  />
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>
    </Container>
  );
}

export default ControlDroneView;
