import {toggleStream} from './hooks.js';
import * as THREE from './three.module.js';
import {OrbitControls} from './OrbitControls.js';

// Three.js initialization
function initThreeJS() {
	const container = document.getElementById("threejs-container");
	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
	const renderer = new THREE.WebGLRenderer();
	renderer.setSize(container.clientWidth, container.clientHeight);
	container.appendChild(renderer.domElement);

	const controls = new OrbitControls(camera, renderer.domElement);
	controls.enableDamping = true;
	controls.dampingFactor = 0.25;
	controls.screenSpacePanning = false;
	controls.maxPolarAngle = Math.PI / 2;

	const gridHelper = new THREE.GridHelper(10, 10);
	scene.add(gridHelper);

	const axesHelper = new THREE.AxesHelper(5);
	scene.add(axesHelper);

	camera.position.set(0, 5, 5);
	controls.update();

	function animate() {
	  requestAnimationFrame(animate);
	  controls.update();
	  renderer.render(scene, camera);
	}

	animate();
}


document.getElementById("startStreamBtn").addEventListener("click", toggleStream);
document.addEventListener("DOMContentLoaded", initThreeJS);
