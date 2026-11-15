# VELO VR – Virtual Reality Bicycle Showroom

An immersive WebXR bicycle store built with **Vite + vanilla JavaScript + Three.js**. You can walk through a luxury
sunset showroom on desktop, browse on mobile, or put on a **Meta Quest** and shop in VR.

- **30 bikes**: 15 Road (left wing) and 15 Mountain (right wing), generated automatically from the photo file names
- **Central atrium**: a rotating hero display of the two black & gold limited editions, with floating particles
- **Shop**: filters, search, price range, sort, wishlist, a cart with 5% VAT in AED, and a demo checkout
- **2D Gallery** for visitors without VR or WebGL

## Requirements

- Node.js 18+ (tested with Node 24)

## Run it

```bash
npm install
npm run dev
```

The app opens at **http://localhost:5173**. The port is fixed (`strictPort`). `host: true` also exposes the app on
your LAN, so you can open it from a phone on the same Wi-Fi using the "Network" URL that Vite prints.

> **Port 5173 already in use?** Vite only detects a clash on the same address. Another dev server listening on
> `[::1]:5173` can "win" `localhost`. If you see a different app, stop the other server or open
> http://127.0.0.1:5173.

### VR (Meta Quest)

WebXR needs a secure context, so a headset can't use the plain-HTTP LAN URL:

```bash
npm run dev:vr        # same server on https://<your-LAN-IP>:5173 with a self-signed certificate
```

1. Open the printed `https://192.168.x.x:5173` URL in the Quest Browser and accept the certificate warning.
2. Wait for loading to finish, then press **ENTER VR**.

Alternatively, use `adb reverse tcp:5173 tcp:5173` and open `http://localhost:5173` on the headset.

### Production build

```bash
npm run build && npm run preview
```

## Controls

| Platform | Move | Look | Interact |
| --- | --- | --- | --- |
| Desktop | `W A S D` / arrows, `Shift` to run | Mouse (click to lock, `Esc` to release) or drag | Aim at a bike and click |
| Mobile | On-screen joystick | One-finger drag | Tap a bike |
| VR | Push the thumbstick forward and release to teleport, or point at the floor and pull the trigger | Thumbstick left/right = smooth turn | Point the laser at a bike and pull the trigger; the 3D panel has sizes, Add to Cart, Test Ride and Wishlist |

Click the **mini-map** to teleport. **Test Ride** plays a cinematic fly-around of the bike; press `Esc` or **Skip**
to stop it.

## Project structure

```
public/bikes/{road,mountain}/   bike photos (copied from ./Road and ./Mountain)
scripts/generate-products.mjs   copies the photos and generates src/data/products.js from the file names
src/
  main.js                       app bootstrap, render loop, wiring between scene and UI
  data/products.js              product catalogue (auto-generated)
  scene/
    showroom.js                 architecture, lighting, reflective floor, LED strips, signage, PMREM environment
    sky.js                      sunset sky shader and mountain silhouettes
    stands.js                   30 display stands (shared geometries and materials, hover glow, filtering)
    hero.js                     atrium hero display and GPU particles
    textures.js                 image loading and downscaling, labels, signs, procedural textures
    controls.js                 PointerLockControls + WASD, drag look, touch joystick, collisions
    xr.js                       WebXR controllers, laser, teleport, smooth turn, gaze fallback
    vrPanel.js                  floating canvas-based product panel for VR
    testRide.js, rig.js         test-ride camera animation, player-rig helpers
  ui/                           top bar, product overlay, cart and checkout, gallery, mini-map, audio, store
  styles.css
```

### Adding or renaming bikes

Drop photos named `road_NN_some-name.jpg` or `mountain_NN_some-name.jpg` into `./Road` or `./Mountain`, add a spec
entry for the new id in `scripts/generate-products.mjs`, then run:

```bash
npm run generate
```

## Performance notes

- Geometries and materials are shared between stands, and particles animate fully on the GPU.
- Photos are downscaled to 768 px canvases for the stands. Only the two hero bikes keep full resolution.
- Pixel ratio is capped at 2.
- Touch devices skip the reflections and bloom, and get fewer lights.
- In VR, the reflector and post-processing are switched off, and foveated rendering is enabled.
- The 3D scene pauses while the 2D gallery is open.
- Gallery images use `loading="lazy"`.

## Notes

- All music and sound effects are generated in real time with the Web Audio API. They start after your first click,
  and the 🔊 button mutes them. The mute choice is remembered.
- The cart, wishlist and mute setting are stored in `localStorage`.
- Checkout is a demo only. No payment is taken.
