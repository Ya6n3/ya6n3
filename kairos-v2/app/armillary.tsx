"use client";

import { useEffect, useRef, useState } from "react";

// A hairline armillary sphere drawn on a canvas: rings of the heavens turning in 3D.
// A single bead travels the ecliptic; as it crosses the top the label turns from
// "chronos" (the hours that pass) to "kairos" (the moment that matters).
// Drag to spin it; it settles back to a slow turn. Static when Reduce Motion is on.

type Vec = [number, number, number];

const RINGS: { tilt: number; spin: number; weight: number }[] = [
  { tilt: 0, spin: 0, weight: 1.1 }, // equator
  { tilt: Math.PI / 2, spin: 0, weight: 1.1 }, // colure
  { tilt: Math.PI / 2, spin: Math.PI / 2, weight: 0.7 },
  { tilt: 0.41, spin: 0.3, weight: 1.6 }, // ecliptic, carries the bead
  { tilt: Math.PI / 3, spin: Math.PI / 4, weight: 0.5 },
  { tilt: Math.PI / 3, spin: -Math.PI / 4, weight: 0.5 },
];
const ECLIPTIC = 3;

function rotX([x, y, z]: Vec, a: number): Vec {
  const c = Math.cos(a), s = Math.sin(a);
  return [x, y * c - z * s, y * s + z * c];
}
function rotY([x, y, z]: Vec, a: number): Vec {
  const c = Math.cos(a), s = Math.sin(a);
  return [x * c + z * s, y, -x * s + z * c];
}
function ringPoint(ring: (typeof RINGS)[number], t: number): Vec {
  return rotY(rotX([Math.cos(t), 0, Math.sin(t)], ring.tilt), ring.spin);
}

export function Armillary() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [moment, setMoment] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let yaw = 0.6, pitch = -0.35, velYaw = 0.0035, bead = 0;
    let dragging = false, lastX = 0, lastY = 0, raf = 0, wasMoment = false;
    const BASE = 0.0035;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = r.width * dpr;
      canvas.height = r.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = () => {
      const { width, height } = canvas.getBoundingClientRect();
      const cx = width / 2, cy = height / 2, R = Math.min(width, height) * 0.42;
      const fg = getComputedStyle(canvas).color;
      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = fg;
      ctx.fillStyle = fg;

      const project = (p: Vec) => {
        const q = rotX(rotY(p, yaw), pitch);
        const persp = 3 / (3 - q[2]);
        return { x: cx + q[0] * R * persp, y: cy - q[1] * R * persp, z: q[2] };
      };

      // Rings: draw in short segments so the far side fades back.
      for (const ring of RINGS) {
        const steps = 120;
        let prev = project(ringPoint(ring, 0));
        for (let i = 1; i <= steps; i++) {
          const cur = project(ringPoint(ring, (i / steps) * Math.PI * 2));
          const depth = (prev.z + cur.z) / 2; // -1 far … 1 near
          ctx.globalAlpha = 0.12 + 0.6 * ((depth + 1) / 2);
          ctx.lineWidth = ring.weight * (0.6 + 0.5 * ((depth + 1) / 2));
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(cur.x, cur.y);
          ctx.stroke();
          prev = cur;
        }
      }

      // Axis through the poles, and the small sphere at the centre.
      const n = project([0, 1.18, 0]), s = project([0, -1.18, 0]);
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(s.x, s.y); ctx.stroke();
      ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.045, 0, Math.PI * 2); ctx.fill();

      // The bead on the ecliptic.
      const b = project(ringPoint(RINGS[ECLIPTIC], bead));
      const isMoment = b.y < cy - R * 0.55 && b.z > 0;
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(b.x, b.y, isMoment ? 6 : 4, 0, Math.PI * 2); ctx.fill();
      if (isMoment) {
        ctx.globalAlpha = 0.35; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(b.x, b.y, 12, 0, Math.PI * 2); ctx.stroke();
      }
      if (isMoment !== wasMoment) { wasMoment = isMoment; setMoment(isMoment); }
      ctx.globalAlpha = 1;
    };

    const tick = () => {
      if (!dragging) {
        yaw += velYaw;
        velYaw += (BASE - velYaw) * 0.02; // ease back to the slow turn
      }
      bead += 0.006;
      draw();
      raf = requestAnimationFrame(tick);
    };

    const down = (e: PointerEvent) => {
      dragging = true; lastX = e.clientX; lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
      setTouched(true);
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      yaw += dx * 0.01; velYaw = dx * 0.01;
      pitch = Math.max(-1.2, Math.min(1.2, pitch + dy * 0.006));
      if (reduce) draw();
    };
    const up = () => { dragging = false; };

    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);

    if (reduce) draw();
    else raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
    };
  }, []);

  return (
    <figure className={`armillary${moment ? " is-moment" : ""}`}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="An armillary sphere turning slowly. A bead marks the right moment as it passes the top. Drag to turn it."
      />
      <figcaption>
        <span className="when" aria-live="polite">{moment ? "kairos" : "chronos"}</span>
        <span className={`hint${touched ? " is-hidden" : ""}`}>Drag to turn</span>
      </figcaption>
    </figure>
  );
}
