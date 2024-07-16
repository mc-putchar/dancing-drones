import React, {useState, useEffect} from 'react';
import { Accordion, Card, Button, Row, Col } from 'react-bootstrap';
import { socket } from '../shared/styles/scripts/socket';

interface CameraStreamProps {
  cameraStreamRunning: boolean;
  setCameraStreamRunning: React.Dispatch<React.SetStateAction<boolean>>;
}

const CameraStream = (props: CameraStreamProps) => {
  const { cameraStreamRunning, setCameraStreamRunning } = props;
  const buttonVariant = cameraStreamRunning ? "outline-danger" : "outline-primary";

  const [fps, setFps] = useState(0);

  useEffect(() => {
    socket.on("fps", data => {
      setFps(data["fps"])
    })

    return () => {
      socket.off("fps")
    }
  }, [])

  return (
    <Accordion defaultActiveKey="0">
      <Accordion.Item eventKey="0">
        <Accordion.Header>
          <h4 className="mb-0">Camera Stream</h4>
        </Accordion.Header>
        <Accordion.Body>
          <Card className='shadow-sm p-3'>
            <Row>
              <Col>
                <Button
                  size='sm'
                  className='me-3'
                  variant={buttonVariant}
                  onClick={() => setCameraStreamRunning(!cameraStreamRunning)}
                >
                  {cameraStreamRunning ? "Stop" : "Start"}
                </Button>
                <span>FPS: {fps}</span>
              </Col>
            </Row>
            <Row className='mt-2 mb-1' style={{ height: "320px" }}>
              <Col>
                <img src={cameraStreamRunning ? "http://localhost:3001/api/camera-stream" : ""} alt="Camera Stream" />
              </Col>
            </Row>
          </Card>
        </Accordion.Body>
      </Accordion.Item>
    </Accordion>
  );
}

export default CameraStream;
