/** Top-down mini-map of the showroom. Click / tap to teleport. */
export function createMinimap({ canvas, room, stands, onTeleport }) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const pad = 10;
  const sx = (W - pad * 2) / (room.maxX - room.minX);
  const sz = (H - pad * 2) / (room.maxZ - room.minZ);
  const toX = (x) => pad + (x - room.minX) * sx;
  const toY = (z) => pad + (z - room.minZ) * sz;
  let last = 0;

  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const py = ((e.clientY - r.top) / r.height) * H;
    const x = room.minX + (px - pad) / sx;
    const z = room.minZ + (py - pad) / sz;
    onTeleport?.(x, z);
  });

  function draw(player, yaw, hoveredOwner, t) {
    ctx.clearRect(0, 0, W, H);
    // floor
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(pad, pad, W - pad * 2, H - pad * 2, 8);
    else ctx.rect(pad, pad, W - pad * 2, H - pad * 2);
    ctx.fill();
    ctx.stroke();
    // windows (back wall)
    ctx.strokeStyle = 'rgba(255,170,110,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(pad + 4, pad);
    ctx.lineTo(W - pad - 4, pad);
    ctx.stroke();
    // wing tints
    ctx.fillStyle = 'rgba(69,212,255,0.07)';
    ctx.fillRect(toX(room.minX), pad, toX(-9.6) - toX(room.minX), H - pad * 2);
    ctx.fillStyle = 'rgba(255,173,66,0.07)';
    ctx.fillRect(toX(9.6), pad, toX(room.maxX) - toX(9.6), H - pad * 2);
    // atrium
    ctx.strokeStyle = 'rgba(232,182,90,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(toX(0), toY(0), 3 * sx, 3 * sz, 0, 0, Math.PI * 2);
    ctx.stroke();
    // stands
    for (const s of stands) {
      const dim = s.state.targetDim > 0.5;
      const hov = s === hoveredOwner;
      ctx.fillStyle = hov
        ? '#ffffff'
        : dim
          ? 'rgba(255,255,255,0.15)'
          : s.product.limited
            ? '#e8b65a'
            : s.product.category === 'road'
              ? '#45d4ff'
              : '#ffad42';
      ctx.beginPath();
      ctx.arc(toX(s.center.x), toY(s.center.z), hov ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // player
    const px = toX(player.x);
    const py = toY(player.z);
    const a = -yaw - Math.PI / 2; // world yaw → canvas angle (0 = +x)
    const cone = ctx.createRadialGradient(px, py, 0, px, py, 34);
    cone.addColorStop(0, 'rgba(255,255,255,0.35)');
    cone.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.arc(px, py, 34, a - 0.55, a + 0.55);
    ctx.closePath();
    ctx.fill();
    const pulse = 5 + Math.sin(t * 4) * 1.2;
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(px, py, pulse + 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(px, py, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }

  return {
    update(player, yaw, hoveredOwner, t) {
      if (t - last < 1 / 20) return; // 20 fps is plenty
      last = t;
      draw(player, yaw, hoveredOwner, t);
    },
  };
}
