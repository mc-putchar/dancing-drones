import React from 'react';
import { Vector3 } from 'three';
import { Line } from '@react-three/drei';

interface CameraPositionProps {
  position: number[];
  direction: number[];
}

const CameraPosition: React.FC<CameraPositionProps> = ({ position, direction }) => {
  const origin = new Vector3(position[0], position[1], position[2]);
  const dir = new Vector3(direction[0], direction[1], direction[2]).normalize();
  const endpoint = origin.clone().add(dir);

  return (
    <>
      <mesh position={origin}>
        <sphereGeometry args={[0.05, 32, 32]} />
        <meshBasicMaterial color="red" />
      </mesh>
      <Line
        points={[origin, endpoint]}
        color="blue"
        lineWidth={2}
      />
    </>
  );
};

export default CameraPosition;
