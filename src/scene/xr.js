import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { rotateRigAroundCamera, moveRigCameraTo } from './rig.js';

const TURN_SPEED = 1.9; // rad/s smooth turn
const DEAD = 0.25;

/**
 * WebXR interaction: controller lasers, hover/select bikes, VR panel buttons,
 * teleport (trigger on floor or thumbstick push+release) and thumbstick smooth turn.
 * Falls back to head-gaze hover when no controllers are connected.
 */
export function createXR({ renderer, scene, player, camera, hitTargets, vrPanel, room, obstacles, onSelect, onTeleport, sounds }) {
  const raycaster = new THREE.Raycaster();
  raycaster.far = 40;
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const tmpHit = new THREE.Vector3();
  const factory = new XRControllerModelFactory();

  const marker = new THREE.Group();
  const markerRing = new THREE.Mesh(
    new THREE.RingGeometry(0.28, 0.36, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0x7fe8ff).multiplyScalar(2), toneMapped: false, transparent: true, opacity: 0.9 }),
  );
  const markerDot = new THREE.Mesh(
    new THREE.CircleGeometry(0.08, 24).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
  );
  marker.add(markerRing, markerDot);
  marker.position.y = 0.02;
  marker.visible = false;
  scene.add(marker);

  const laserGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
  const laserIdle = new THREE.LineBasicMaterial({ color: 0x9fdcff, transparent: true, opacity: 0.6 });
  const laserActive = new THREE.LineBasicMaterial({ color: new THREE.Color(0xffd27e).multiplyScalar(2), toneMapped: false });

  const controllers = [];
  for (let i = 0; i < 2; i++) {
    const c = renderer.xr.getController(i);
    const laser = new THREE.Line(laserGeo, laserIdle);
    laser.scale.z = 6;
    laser.visible = false;
    c.add(laser);
    const info = { index: i, controller: c, laser, connected: false, handedness: '', gamepad: null, hit: null, aimTeleport: false };
    c.addEventListener('connected', (e) => {
      info.connected = true;
      info.handedness = e.data.handedness;
      info.gamepad = e.data.gamepad || null;
      laser.visible = e.data.targetRayMode === 'tracked-pointer';
    });
    c.addEventListener('disconnected', () => {
      info.connected = false;
      laser.visible = false;
      info.gamepad = null;
    });
    c.addEventListener('selectend', () => handleSelect(info));
    c.addEventListener('squeezeend', () => vrPanel.isOpen && vrPanel.close());
    player.add(c);

    const grip = renderer.xr.getControllerGrip(i);
    grip.add(factory.createControllerModel(grip));
    player.add(grip);
    controllers.push(info);
  }

  let hovered = null; // pick object { owner, product }
  let gazeInfo = { hit: null };

  function validFloor(p) {
    if (p.x < room.minX + 0.8 || p.x > room.maxX - 0.8 || p.z < room.minZ + 0.8 || p.z > room.maxZ - 0.8) return false;
    return !obstacles.some((o) => (p.x - o.x) ** 2 + (p.z - o.z) ** 2 < (o.r + 0.3) ** 2);
  }

  function cast(info, fromCamera = false) {
    if (fromCamera) {
      camera.getWorldPosition(raycaster.ray.origin);
      camera.getWorldDirection(raycaster.ray.direction);
    } else {
      raycaster.setFromXRController(info.controller);
    }
    const res = { type: null, dist: 6 };
    if (vrPanel.isOpen) {
      const h = raycaster.intersectObject(vrPanel.mesh, false)[0];
      if (h) return { type: 'panel', uv: h.uv, dist: h.distance };
    }
    const h = raycaster.intersectObjects(hitTargets, false)[0];
    if (h) {
      res.type = 'pick';
      res.pick = h.object.userData.pick;
      res.dist = h.distance;
      res.point = h.point.clone();
    }
    if (raycaster.ray.intersectPlane(floorPlane, tmpHit)) {
      const d = raycaster.ray.origin.distanceTo(tmpHit);
      if (d < (res.type ? res.dist : 30)) {
        return { type: validFloor(tmpHit) ? 'floor' : 'blocked', point: tmpHit.clone(), dist: d };
      }
    }
    return res;
  }

  function teleportTo(point) {
    moveRigCameraTo(player, camera, point.x, point.z);
    sounds?.whoosh(0.5);
    onTeleport?.();
  }

  function handleSelect(info) {
    const hit = info.hit;
    if (!hit) return;
    if (hit.type === 'panel') {
      const id = vrPanel.press(hit.uv);
      if (id) sounds?.click();
    } else if (hit.type === 'pick') {
      sounds?.click();
      const product = hit.pick.product || hit.pick.owner.productFacing(camera.getWorldPosition(new THREE.Vector3()));
      onSelect(product, hit.pick.owner);
    } else if (hit.type === 'floor') {
      teleportTo(hit.point);
    }
  }

  return {
    get hovered() {
      return hovered;
    },
    teleportTo,
    update(dt) {
      const anyConnected = controllers.some((c) => c.connected && c.laser.visible);
      let newHover = null;
      let showMarker = null;

      for (const info of controllers) {
        if (!info.connected) {
          info.hit = null;
          continue;
        }
        const hit = (info.hit = cast(info));
        if (!info.laser.visible) continue;
        info.laser.scale.z = Math.max(0.05, hit.dist ?? 6);
        info.laser.material = hit.type === 'pick' || hit.type === 'panel' ? laserActive : laserIdle;
        if (hit.type === 'pick') newHover = hit.pick;
        if (hit.type === 'panel' && vrPanel.setHover(hit.uv)) sounds?.hover();

        // thumbstick: x → smooth turn, push forward → aim teleport, release → teleport
        const gp = info.gamepad;
        if (gp && gp.axes && gp.axes.length >= 4) {
          const ax = gp.axes[2];
          const ay = gp.axes[3];
          if (Math.abs(ax) > DEAD && Math.abs(ax) > Math.abs(ay)) {
            rotateRigAroundCamera(player, camera, -Math.sign(ax) * (Math.abs(ax) - DEAD) / (1 - DEAD) * TURN_SPEED * dt);
          }
          if (ay < -0.6) {
            info.aimTeleport = true;
          } else if (info.aimTeleport && ay > -0.3) {
            info.aimTeleport = false;
            if (hit.type === 'floor') teleportTo(hit.point);
          }
        }
        if ((hit.type === 'floor' || hit.type === 'blocked') && (info.aimTeleport || hit.type === 'floor')) {
          showMarker = { point: hit.point, ok: hit.type === 'floor' };
        }
      }

      // gaze fallback (no controllers, e.g. cardboard-style viewers)
      if (!anyConnected) {
        gazeInfo.hit = cast(gazeInfo, true);
        if (gazeInfo.hit.type === 'pick') newHover = gazeInfo.hit.pick;
        if (gazeInfo.hit.type === 'panel') vrPanel.setHover(gazeInfo.hit.uv);
      }

      if (showMarker) {
        marker.visible = true;
        marker.position.set(showMarker.point.x, 0.02, showMarker.point.z);
        markerRing.material.color.set(showMarker.ok ? 0x7fe8ff : 0xff5a5a).multiplyScalar(2);
        markerRing.rotation.y += dt;
      } else {
        marker.visible = false;
      }

      if (newHover?.owner !== hovered?.owner) {
        if (newHover) sounds?.hover();
      }
      hovered = newHover;
    },
    hideMarker() {
      marker.visible = false;
    },
  };
}
