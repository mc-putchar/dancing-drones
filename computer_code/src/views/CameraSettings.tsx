import React, { useState, useEffect, useRef, FormEventHandler } from 'react';
import { Accordion, Button, Card, Col, Form, Row} from 'react-bootstrap';
import { Tooltip } from 'react-tooltip'
import { socket } from '../shared/styles/scripts/socket';
import { is } from '@react-three/fiber/dist/declarations/src/core/utils';

interface CameraSettingsProps {
  cameraPoses: Array<object>;
  setCameraPoses: React.Dispatch<React.SetStateAction<Array<object>>>;
  toWorldCoordsMatrix: number[][];
  setToWorldCoordsMatrix: React.Dispatch<React.SetStateAction<number[][]>>;
  objectPoints: React.MutableRefObject<any[]>;
  objectPointErrors: React.MutableRefObject<any[]>;
  cameraStreamRunning: boolean;
  isTriangulatingPoints: boolean;
  setIsTriangulatingPoints: React.Dispatch<React.SetStateAction<boolean>>;
  resetPoints: () => void;
}

const CameraSettings = (props: CameraSettingsProps) => {
  const {
    cameraPoses,
    setCameraPoses,
    toWorldCoordsMatrix,
    setToWorldCoordsMatrix,
    objectPoints,
    objectPointErrors,
    cameraStreamRunning,
    isTriangulatingPoints,
    setIsTriangulatingPoints,
    resetPoints
  } = props;

  const [exposure, setExposure] = useState<number>(100);
  const [gain, setGain] = useState<number>(0);

  const [capturingPointsForPose, setCapturingPointsForPose] = useState(false);
  const [capturedPointsForPose, setCapturedPointsForPose] = useState("");
  
  const [isLocatingObjects, setIsLocatingObjects] = useState(false);

  const updateCameraSettings: FormEventHandler = (e) => {
    e.preventDefault();
    socket.emit("update-camera-settings", {
      exposure,
      gain,
    });
  };

  const isValidJson = (str: string) => {
    try {
      JSON.parse(str);
    } catch (e) {
      return false;
    }
    return true;
  };

  const capturePointsForPose = (startOrStop: string) => {
    if (startOrStop === "start") {
      setCapturedPointsForPose("");
    }
    socket.emit("capture-points", { startOrStop });
  };

  useEffect(() => {
    socket.on("image-points", (data) => {
      setCapturedPointsForPose(`${capturedPointsForPose}${JSON.stringify(data)},`)
    })

    return () => {
      socket.off("image-points")
    }
  }, [capturedPointsForPose])

  const calculateCameraPose = (cameraPoints: any[]) => {
    socket.emit("calculate-camera-pose", { cameraPoints });
  };

  const handleCameraPosesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const newCameraPoses = JSON.parse(event.target.value);
      console.log("Camera poses changed")
      setCameraPoses(newCameraPoses);
      // Emitir el evento al servidor con las nuevas poses
      socket.emit("calculate-camera-positions", { cameraPoses: newCameraPoses, toWorldCoordsMatrix: toWorldCoordsMatrix });
    } catch (e) {
      console.error("Error parsing camera poses: ", e);
    }
  };

  //Capture points
  const startLiveMocap = (startOrStop: string) => {
    socket.emit("triangulate-points", { startOrStop, cameraPoses, toWorldCoordsMatrix });
  };

  const rotateScene = (axis: string, increment: number) => {
    socket.emit("rotate-scene", { axis, increment });
  };

  useEffect(() => {
    socket.on("image-points", (data) => {
      setCapturedPointsForPose((prev) => `${prev}${JSON.stringify(data)},`);
    });

    return () => {
      socket.off("image-points");
    };
  }, []);

  useEffect(() => {
    socket.on("to-world-coords-matrix", (data) => {
      setToWorldCoordsMatrix(data["to_world_coords_matrix"]);
    });

    return () => {
      socket.off("to-world-coords-matrix");
    };
  }, []);
  

  return (
    <Card className='shadow-sm p-3 h-100'>
      <Row className='pt-3'>
        <Col xs="4">
          <Form onChange={updateCameraSettings} className='ps-3'>
            <Form.Group className="mb-1">
              <Form.Label>Exposure: {exposure}</Form.Label>
              <Form.Range value={exposure} onChange={(event) => setExposure(parseFloat(event.target.value))} />
            </Form.Group>
            <Form.Group className="mb-1">
              <Form.Label>Gain: {gain}</Form.Label>
              <Form.Range value={gain} onChange={(event) => setGain(parseFloat(event.target.value))} />
            </Form.Group>
          </Form>
        </Col>
      </Row>
      <Row>
        <Col xs="auto">
          <h4>Live Triangulation</h4>
        </Col>
        <Col>
          <Button
              size='sm'
              variant={isTriangulatingPoints ? "outline-danger" : "outline-primary"}
              disabled={!cameraStreamRunning}
              onClick={() => {
                  if (!isTriangulatingPoints) {
                      resetPoints();
                  }
              setIsTriangulatingPoints(!isTriangulatingPoints);
              startLiveMocap(isTriangulatingPoints ? "stop" : "start");
              }}
          >
              {isTriangulatingPoints ? "Stop" : "Start"}
          </Button>
        </Col>
      </Row>
      <Row>
        <Col xs="auto">
          <h4>Locate Objects</h4>
        </Col>
        <Col>
          <Button
            size='sm'
            variant={isLocatingObjects ? "outline-danger" : "outline-primary"}
            disabled={!cameraStreamRunning}
            onClick={() => {
              setIsLocatingObjects(!isLocatingObjects);
              socket.emit("locate-objects", { startOrStop: isLocatingObjects ? "stop" : "start" });
            }}
          >
            {isLocatingObjects ? "Stop" : "Start"}
          </Button>
        </Col>
      </Row>
      <Row>
        <Col xs="auto">
          <h4>Set Scale Using Points</h4>
        </Col>
        <Col>
          <Button
            size='sm'
            variant="outline-primary"
            disabled={!isTriangulatingPoints && objectPoints.current.length === 0}
            onClick={() => {
              socket.emit("determine-scale", { objectPoints: objectPoints.current, cameraPoses: cameraPoses });
            }}
          >
            Run
          </Button>
        </Col>
      </Row>
      <Row>
        <Col xs="auto">
          <h4>Acquire Floor</h4>
        </Col>
        <Col>
          <Button
            size='sm'
            variant="outline-primary"
            disabled={!isTriangulatingPoints && objectPoints.current.length === 0}
            onClick={() => {
              socket.emit("acquire-floor", { objectPoints: objectPoints.current, oldMatrix: toWorldCoordsMatrix });
            }}
          >
            Run
          </Button>
        </Col>
      </Row>
      <Row>
        <Col xs="auto">
          <h4>Set Origin</h4>
        </Col>
        <Col>
          <Button
            size='sm'
            variant="outline-primary"
            disabled={!isTriangulatingPoints && objectPoints.current.length === 0}
            onClick={() => {
              console.log(objectPoints.current[0][0])
              socket.emit("set-origin", { objectPoint: objectPoints.current[0][0], toWorldCoordsMatrix });
            }}
          >
            Run
          </Button>
        </Col>
      </Row>
      <Row>
        <Col xs="auto">
          <h4>Collect points for camera pose calibration</h4>
        </Col>
        <Col>
          <Tooltip id="collect-points-for-pose-button-tooltip" />
          <a data-tooltip-hidden={cameraStreamRunning} data-tooltip-variant='error' data-tooltip-id='collect-points-for-pose-button-tooltip' data-tooltip-content="Start camera stream first">
            <Button
              size='sm'
              variant={capturingPointsForPose ? "outline-danger" : "outline-primary"}
              disabled={!cameraStreamRunning}
              onClick={() => {
                setCapturingPointsForPose(!capturingPointsForPose);
                capturePointsForPose(capturingPointsForPose ? "stop" : "start");
              }}
            >
              {capturingPointsForPose ? "Stop" : "Start"}
            </Button>
          </a>
        </Col>
      </Row>
      <Row className='pt-3'>
        <Col>
          <Button
            size='sm'
            className='float-end'
            variant="outline-primary"
            disabled={!(isValidJson(`[${capturedPointsForPose.slice(0, -1)}]`) && JSON.parse(`[${capturedPointsForPose.slice(0, -1)}]`).length !== 0)}
            onClick={() => calculateCameraPose(JSON.parse(`[${capturedPointsForPose.slice(0, -1)}]`))}
          >
            Calculate Camera Pose with {isValidJson(`[${capturedPointsForPose.slice(0, -1)}]`) ? JSON.parse(`[${capturedPointsForPose.slice(0, -1)}]`).length : 0} points
          </Button>
        </Col>
      </Row>
      <Row className='pt-3'>
        <Col xs={4} className='pt-2'>
          Camera Poses:
        </Col>
        <Col>
          <Form.Control
            value={JSON.stringify(cameraPoses)}
            onChange={handleCameraPosesChange}
          />
        </Col>
      </Row>
      <Row>
        <Col xs={4} className='pt-2'>
          To World Matrix:
        </Col>
        <Col>
          <Form.Control
            value={JSON.stringify(toWorldCoordsMatrix)}
            onChange={(event) => setToWorldCoordsMatrix(JSON.parse(event.target.value))}
          />
        </Col>
      </Row>
      <Row>
        <Col xs="auto">
          <h4>Rotate Scene</h4>
        </Col>
        <Col>
          <div className="d-flex justify-content-between">
            <div>
              <Button size='sm' variant="outline-primary" onClick={() => rotateScene('x', 1)}>Rotate X +1</Button>
              <Button size='sm' variant="outline-primary" onClick={() => rotateScene('x', -1)}>Rotate X -1</Button>
            </div>
            <div>
              <Button size='sm' variant="outline-primary" onClick={() => rotateScene('y', 1)}>Rotate Y +1</Button>
              <Button size='sm' variant="outline-primary" onClick={() => rotateScene('y', -1)}>Rotate Y -1</Button>
            </div>
            <div>
              <Button size='sm' variant="outline-primary" onClick={() => rotateScene('z', 1)}>Rotate Z +1</Button>
              <Button size='sm' variant="outline-primary" onClick={() => rotateScene('z', -1)}>Rotate Z -1</Button>
            </div>
          </div>
        </Col>
      </Row>
    </Card>
  );
};

export default CameraSettings;
