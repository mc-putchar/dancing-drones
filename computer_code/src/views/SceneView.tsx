import React from 'react';
import { Card } from 'react-bootstrap'; // Asegúrate de importar Card de react-bootstrap
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import Points from '../components/Points';
import Objects from '../components/Objects';
import TrajectoryPlanningSetpoints from '../components/TrajectoryPlanningSetpoints';
import CameraWireframe from '../components/CameraWireframe';
import CameraPosition from '../components/CameraPosition';

interface SceneViewProps {
  cameraPoses: Array<object>;
  toWorldCoordsMatrix: number[][];
  cameraPositions: number[][];
  cameraDirections: number[][];
  objectPoints: React.MutableRefObject<number[][][]>;
  objectPointErrors: React.MutableRefObject<number[][]>;
  objectPointCount: number;
  filteredObjects: React.MutableRefObject<object[][]>;
  trajectoryPlanningSetpoints: number[][][];
}

const SceneView = (props: SceneViewProps) => {
  const {
    cameraPoses,
    toWorldCoordsMatrix,
    cameraPositions,
    cameraDirections,
    objectPoints,
    objectPointErrors,
    objectPointCount,
    filteredObjects,
    trajectoryPlanningSetpoints,
  } = props;

  return (
    <Card className='shadow-sm p-3' style={{ height: "1000px", width: '80%'}}>
      <Canvas orthographic camera={{ zoom: 1000, position: [0, 0, 10] }}>
        <ambientLight />
        {cameraPoses.map(({ R, t }, i) => (
          <CameraWireframe R={R} t={t} toWorldCoordsMatrix={toWorldCoordsMatrix} key={i} />
        ))}
        {/* <CameraPosition position={cameraPositions[0]} direction={cameraDirections[0]} key={0} /> */}
        {cameraPositions.map((position, i) => (
          <CameraPosition position={position} direction={cameraDirections[i]} key={i} />
        ))}
        <Points objectPointsRef={objectPoints} objectPointErrorsRef={objectPointErrors} count={objectPointCount} />
        <Objects filteredObjectsRef={filteredObjects} count={objectPointCount} />
        <TrajectoryPlanningSetpoints trajectoryPlanningSetpoints={trajectoryPlanningSetpoints} NUM_DRONES={2} />
        <OrbitControls />
        <axesHelper args={[0.2]} />
        <gridHelper args={[4, 4 * 10]} />
        <directionalLight />
      </Canvas>
    </Card>
  );
};

export default SceneView;
