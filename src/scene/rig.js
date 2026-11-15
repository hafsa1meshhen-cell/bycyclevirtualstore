import * as THREE from 'three';

const _cam = new THREE.Vector3();
const _off = new THREE.Vector3();
const _dir = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0);

/** Helpers for moving the XR player rig (a Group that contains the camera). */
export function cameraWorldPos(camera, out = new THREE.Vector3()) {
  return camera.getWorldPosition(out);
}

/** Rotate the rig around the camera's current world position (comfortable turning). */
export function rotateRigAroundCamera(player, camera, angle) {
  camera.getWorldPosition(_cam);
  _off.subVectors(player.position, _cam).setY(0).applyAxisAngle(Y, angle);
  player.position.set(_cam.x + _off.x, player.position.y, _cam.z + _off.z);
  player.rotation.y += angle;
  player.updateMatrixWorld(true);
}

/** Translate the rig so the camera ends up above (x, z). */
export function moveRigCameraTo(player, camera, x, z) {
  camera.getWorldPosition(_cam);
  player.position.x += x - _cam.x;
  player.position.z += z - _cam.z;
  player.updateMatrixWorld(true);
}

/** Current camera heading (yaw) in world space. */
export function cameraWorldYaw(camera) {
  camera.getWorldDirection(_dir);
  return Math.atan2(-_dir.x, -_dir.z);
}
