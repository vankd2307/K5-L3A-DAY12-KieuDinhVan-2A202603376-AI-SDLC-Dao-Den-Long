import * as THREE from 'three';
import { ISLAND_RADIUS, type Game, type TimedEvent } from '../core';

const WARM = 0xffb347;
const INK = 0x2a0d3d;

interface LanternObj {
  lamp: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
  light: THREE.PointLight;
  group: THREE.Group;
  glow: number; // 0..1, eases toward lit state
}

interface ShadeObj {
  group: THREE.Group;
  body: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
}

/**
 * Read-only view of a Game. It never mutates game state; Math.random here is cosmetic only.
 */
export class SceneView {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
  camYawDeg = 0;

  private hemi = new THREE.HemisphereLight(0x8a7dff, 0x1a1030, 0.35);
  private moon = new THREE.DirectionalLight(0xb8c4ff, 0.35);
  private player = new THREE.Group();
  private playerLight = new THREE.PointLight(WARM, 6, 9, 1.6);
  private lanterns: LanternObj[] = [];
  private shades = new Map<string, ShadeObj>();
  private motePool: THREE.Mesh[] = [];
  private moteGeo = new THREE.SphereGeometry(0.15, 8, 6);
  private moteMat = new THREE.MeshBasicMaterial({ color: 0xfff1a8 });
  private pulseRing: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private pulseT = 1;
  private heading = 0;
  private lastPos = new THREE.Vector3();
  private fogColor = new THREE.Color();

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x0d0b1f);
    this.scene.fog = new THREE.Fog(0x0d0b1f, 25, 110);
    this.moon.position.set(-20, 40, -10);
    this.scene.add(this.hemi, this.moon);

    this.buildWorld();
    this.buildPlayer();

    this.pulseRing = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1, 48),
      new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, side: THREE.DoubleSide }),
    );
    this.pulseRing.rotation.x = -Math.PI / 2;
    this.scene.add(this.pulseRing);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  /** Rebuild per-game objects (lanterns, shades) for a new round. */
  reset(game: Game): void {
    for (const l of this.lanterns) this.scene.remove(l.group);
    this.lanterns = game.lanterns.map((l) => this.makeLantern(l.pos[0], l.pos[2]));
    for (const s of this.shades.values()) this.scene.remove(s.group);
    this.shades.clear();
    this.lastPos.set(...game.player.pos);
  }

  onEvents(events: TimedEvent[]): void {
    for (const e of events) if (e.name === 'pulse') this.pulseT = 0;
  }

  render(game: Game, dt: number, time: number): void {
    const p = game.player.pos;

    // player + facing
    this.player.position.set(p[0], p[1], p[2]);
    const dx = p[0] - this.lastPos.x;
    const dz = p[2] - this.lastPos.z;
    if (dx * dx + dz * dz > 1e-6) this.heading = Math.atan2(dx, dz);
    this.lastPos.set(p[0], p[1], p[2]);
    this.player.rotation.y = this.heading;
    const blink = game.player.invulnTicks > 0 && Math.floor(time * 12) % 2 === 0;
    this.player.visible = !blink;
    this.playerLight.intensity = 3 + game.player.carried * 0.6;

    // lanterns: island brightens as more are lit
    let litCount = 0;
    game.lanterns.forEach((l, i) => {
      const o = this.lanterns[i];
      if (!o) return;
      if (l.lit) litCount++;
      o.group.position.set(l.pos[0], 0, l.pos[2]);
      const target = l.lit ? 1 : (l.deposited / game.tuning.lantern_cost) * 0.25;
      o.glow += (target - o.glow) * Math.min(1, dt * 2);
      o.light.intensity = o.glow * 40;
      o.lamp.material.emissiveIntensity = 0.15 + o.glow * 2.5;
    });
    const brightness = litCount / game.lanterns.length;
    this.hemi.intensity = 0.35 + brightness * 0.9;
    this.fogColor.setHex(0x0d0b1f).lerp(new THREE.Color(0x3a2a4a), brightness);
    (this.scene.background as THREE.Color).copy(this.fogColor);
    (this.scene.fog as THREE.Fog).color.copy(this.fogColor);

    // motes (pooled)
    while (this.motePool.length < game.motes.length) {
      const m = new THREE.Mesh(this.moteGeo, this.moteMat);
      this.scene.add(m);
      this.motePool.push(m);
    }
    this.motePool.forEach((m, i) => {
      const pos = game.motes[i];
      m.visible = !!pos;
      if (pos) m.position.set(pos[0], 0.9 + Math.sin(time * 2 + i * 1.7) * 0.25, pos[2]);
    });

    // shades
    const alive = new Set<string>();
    for (const s of game.shades) {
      alive.add(s.id);
      let o = this.shades.get(s.id);
      if (!o) {
        o = this.makeShade();
        this.shades.set(s.id, o);
      }
      const stunned = s.state === 'stunned';
      o.group.position.set(s.pos[0], s.pos[1] + Math.sin(time * 3 + s.pos[0]) * 0.15, s.pos[2]);
      o.group.lookAt(p[0], s.pos[1], p[2]);
      o.body.material.opacity = stunned ? 0.35 : 0.92;
      o.group.scale.setScalar(stunned ? 0.8 : 1 + Math.sin(time * 6) * 0.04);
    }
    for (const [id, o] of this.shades) {
      if (!alive.has(id)) {
        this.scene.remove(o.group);
        this.shades.delete(id);
      }
    }

    // pulse ring
    if (this.pulseT < 1) {
      this.pulseT = Math.min(1, this.pulseT + dt / 0.45);
      const r = game.tuning.pulse_radius * this.pulseT;
      this.pulseRing.scale.setScalar(Math.max(0.01, r));
      this.pulseRing.position.set(p[0], 0.15, p[2]);
      this.pulseRing.material.opacity = 1 - this.pulseT;
    } else this.pulseRing.material.opacity = 0;

    // third-person camera behind the contract's "forward" (sin yaw, cos yaw)
    const th = (this.camYawDeg * Math.PI) / 180;
    this.camera.position.set(p[0] - Math.sin(th) * 9, p[1] + 5.5, p[2] - Math.cos(th) * 9);
    this.camera.lookAt(p[0], p[1] + 1.2, p[2]);
    this.renderer.render(this.scene, this.camera);
  }

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private buildWorld(): void {
    const island = new THREE.Mesh(
      new THREE.CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS - 6, 5, 64),
      new THREE.MeshStandardMaterial({ color: 0x35553f, flatShading: true }),
    );
    island.position.y = -2.5;
    this.scene.add(island);

    const sand = new THREE.Mesh(
      new THREE.RingGeometry(ISLAND_RADIUS - 2, ISLAND_RADIUS, 64),
      new THREE.MeshStandardMaterial({ color: 0x8c7a5b }),
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.y = 0.01;
    this.scene.add(sand);

    // sea of clouds
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0x4b4170, flatShading: true });
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = ISLAND_RADIUS + 6 + Math.random() * 50;
      const c = new THREE.Mesh(new THREE.IcosahedronGeometry(3 + Math.random() * 5, 0), cloudMat);
      c.position.set(Math.sin(a) * r, -6 - Math.random() * 4, Math.cos(a) * r);
      c.scale.y = 0.5;
      this.scene.add(c);
    }

    // trees and rocks (cosmetic)
    const trunk = new THREE.MeshStandardMaterial({ color: 0x4a3426 });
    const leaf = new THREE.MeshStandardMaterial({ color: 0x2f6b4f, flatShading: true });
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 8 + Math.random() * 30;
      if (Math.abs(r - 25) < 4) continue; // keep the lantern ring clear
      const t = new THREE.Group();
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, 1.4, 6), trunk);
      tr.position.y = 0.7;
      const lf = new THREE.Mesh(new THREE.ConeGeometry(1, 2.4, 7), leaf);
      lf.position.y = 2.4;
      t.add(tr, lf);
      t.position.set(Math.sin(a) * r, 0, Math.cos(a) * r);
      t.scale.setScalar(0.7 + Math.random() * 0.8);
      this.scene.add(t);
    }

    // stars
    const starGeo = new THREE.BufferGeometry();
    const pts: number[] = [];
    for (let i = 0; i < 600; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(180);
      if (v.y < 10) v.y = Math.abs(v.y) + 10;
      pts.push(v.x, v.y, v.z);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xfff6d8, size: 0.8, fog: false })));
  }

  private buildPlayer(): void {
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.35, 0.6, 4, 12),
      new THREE.MeshStandardMaterial({ color: 0xdfe7ff }),
    );
    body.position.y = 0.65;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffe0c4 }));
    head.position.y = 1.35;
    // nón lá (conical hat) with a small hanging lantern
    const hat = new THREE.Mesh(
      new THREE.ConeGeometry(0.75, 0.45, 24, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xe6cf8f, side: THREE.DoubleSide, flatShading: true }),
    );
    hat.position.y = 1.72;
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.3), new THREE.MeshBasicMaterial({ color: 0x333333 }));
    string.position.set(0, 1.35, 0.68);
    const lamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.22, 0.16),
      new THREE.MeshStandardMaterial({ color: 0xff8a3d, emissive: WARM, emissiveIntensity: 2 }),
    );
    lamp.position.set(0, 1.12, 0.68);
    this.playerLight.position.copy(lamp.position);
    this.player.add(body, head, hat, string, lamp, this.playerLight);
    this.scene.add(this.player);
  }

  private makeLantern(x: number, z: number): LanternObj {
    const group = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x5b3a29 });
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 3.2, 8), wood);
    post.position.y = 1.6;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 1), wood);
    arm.position.set(0, 3.1, 0.45);
    const lamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.8, 0.6),
      new THREE.MeshStandardMaterial({ color: 0xc8402a, emissive: WARM, emissiveIntensity: 0.15 }),
    );
    lamp.position.set(0, 2.55, 0.9);
    const light = new THREE.PointLight(WARM, 0, 26, 1.4);
    light.position.copy(lamp.position);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 0.2, 10), new THREE.MeshStandardMaterial({ color: 0x6b6b7a }));
    base.position.y = 0.1;
    group.add(post, arm, lamp, light, base);
    group.position.set(x, 0, z);
    this.scene.add(group);
    return { lamp, light, group, glow: 0 };
  }

  private makeShade(): ShadeObj {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.7, 16, 12),
      new THREE.MeshStandardMaterial({ color: INK, emissive: 0x1a0030, transparent: true, opacity: 0.92 }),
    );
    body.scale.y = 1.25;
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xd9b3ff });
    for (const sx of [-0.22, 0.22]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), eyeMat);
      eye.position.set(sx, 0.2, 0.62);
      group.add(eye);
    }
    group.add(body);
    this.scene.add(group);
    return { group, body };
  }
}
