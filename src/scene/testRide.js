import * as THREE from 'three';
import { moveRigCameraTo, rotateRigAroundCamera, cameraWorldYaw } from './rig.js';

const ease = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const FLY = 1.4;
const ORBIT = 7.5;

/**
 * "Test Ride": a cinematic camera fly-around of a bike.
 * Desktop: animates the camera. VR: gently moves/turns the player rig.
 */
export function createTestRide({ camera, player, renderer }) {
  const fromPos = new THREE.Vector3();
  const fromQuat = new THREE.Quaternion();
  const lookQuat = new THREE.Quaternion();
  const tmpM = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const s = {
    active: false,
    owner: null,
    product: null,
    t: 0,
    xr: false,
    center: new THREE.Vector3(),
    theta0: 0,
    r0: 3.8,
    rMin: 2.5,
    lift: 1.0,
    lastTheta: 0,
    onEnd: null,
  };

  function orbitPoint(u, out) {
    const bump = Math.sin(Math.PI * u);
    const th = s.theta0 + Math.PI * 2 * ease(u);
    const r = s.r0 - (s.r0 - s.rMin) * bump;
    out.set(s.center.x + Math.sin(th) * r, 1.6 + s.lift * bump, s.center.z + Math.cos(th) * r);
    return th;
  }
  function lookAtQuat(from, out) {
    tmpM.lookAt(from, s.center, camera.up);
    return out.setFromRotationMatrix(tmpM);
  }

  return {
    get active() {
      return s.active;
    },
    get owner() {
      return s.owner;
    },
    get product() {
      return s.product;
    },
    start(owner, product, approach, onEnd) {
      s.active = true;
      s.owner = owner;
      s.product = product;
      s.onEnd = onEnd;
      s.t = 0;
      s.xr = renderer.xr.isPresenting;
      s.center.copy(owner.center);
      const dx = approach.x - s.center.x;
      const dz = approach.z - s.center.z;
      s.theta0 = Math.atan2(dx, dz);
      s.r0 = Math.hypot(dx, dz);
      s.rMin = owner.kind === 'hero' ? s.r0 * 0.75 : 2.5;
      s.lift = owner.kind === 'hero' ? 1.8 : 1.0;
      fromPos.copy(camera.position);
      fromQuat.copy(camera.quaternion);
      if (s.xr) {
        // place the rig at the start of the orbit and face the bike
        orbitPoint(0, p);
        moveRigCameraTo(player, camera, p.x, p.z);
        const want = Math.atan2(-(s.center.x - p.x), -(s.center.z - p.z));
        rotateRigAroundCamera(player, camera, want - cameraWorldYaw(camera));
        s.lastTheta = s.theta0;
        s.t = FLY; // no fly-in in VR
      }
    },
    skip() {
      if (s.active) s.t = FLY + ORBIT;
    },
    update(dt) {
      if (!s.active) return;
      s.t += dt;
      const done = s.t >= FLY + ORBIT;
      if (s.xr) {
        const u = Math.min(1, (s.t - FLY) / ORBIT);
        const th = orbitPoint(u, p);
        rotateRigAroundCamera(player, camera, th - s.lastTheta);
        s.lastTheta = th;
        moveRigCameraTo(player, camera, p.x, p.z);
      } else if (s.t < FLY) {
        const u = ease(s.t / FLY);
        orbitPoint(0, p);
        lookAtQuat(p, lookQuat);
        camera.position.lerpVectors(fromPos, p, u);
        camera.quaternion.slerpQuaternions(fromQuat, lookQuat, u);
      } else {
        const u = Math.min(1, (s.t - FLY) / ORBIT);
        orbitPoint(u, p);
        camera.position.copy(p);
        camera.lookAt(s.center);
      }
      if (done) {
        s.active = false;
        const cb = s.onEnd;
        s.owner = s.product = s.onEnd = null;
        cb?.();
      }
    },
  };
}
