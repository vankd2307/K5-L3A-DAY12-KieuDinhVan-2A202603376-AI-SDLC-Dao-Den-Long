import * as THREE from 'three';
import type { Game, TimedEvent } from '../core';
import { ambientFor, C } from './palette';

type StdMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;

interface LanternObj { group: THREE.Group; lamp: StdMesh; light: THREE.PointLight; glow: number }
interface ShadeObj { group: THREE.Group; body: StdMesh; age: number }
interface DrifterObj { group: THREE.Group; strips: THREE.Mesh[] }

const std = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, ...extra });

/**
 * Read-only 3D view of a Game. Never mutates game state; Math.random here is cosmetic only.
 */
export class SceneView {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
  camYawDeg = 0;

  private ambient = new THREE.AmbientLight(0xffffff, 0.15);
  private moon = new THREE.DirectionalLight(0xb8c4ff, 0.35);
  private world = new THREE.Group(); // per-night static terrain
  private dynamic = new THREE.Group(); // per-night entities
  private player = new THREE.Group();
  private playerLight = new THREE.PointLight(C.lit, 6, 9, 1.6);
  private lanterns: LanternObj[] = [];
  private shades = new Map<string, ShadeObj>();
  private drifters = new Map<string, DrifterObj>();
  private charms: THREE.Group[] = [];
  private motePool: THREE.Group[] = [];
  private pulseRing: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private pulseT = 1;
  private leaves: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private heading = 0;

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);
    this.scene.background = new THREE.Color(C.sky);
    this.scene.fog = new THREE.Fog(C.fog, 35, 140);
    this.moon.position.set(-20, 40, -10);
    this.scene.add(this.ambient, this.moon, this.world, this.dynamic);
    this.buildSky();
    this.buildPlayer();

    this.pulseRing = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1, 48),
      new THREE.MeshBasicMaterial({ color: C.core, transparent: true, opacity: 0, side: THREE.DoubleSide }),
    );
    this.pulseRing.rotation.x = -Math.PI / 2;
    this.scene.add(this.pulseRing);

    const lg = new THREE.BufferGeometry();
    const lp = new Float32Array(150 * 3);
    for (let i = 0; i < lp.length; i++) lp[i] = (Math.random() - 0.5) * 30;
    lg.setAttribute('position', new THREE.BufferAttribute(lp, 3));
    this.leaves = new THREE.Points(lg, new THREE.PointsMaterial({ color: 0x9cc27a, size: 0.25, transparent: true, opacity: 0 }));
    this.scene.add(this.leaves);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  /** Build terrain and entity objects for this game's night. */
  load(game: Game): void {
    this.world.clear();
    this.dynamic.clear();
    this.shades.clear();
    this.drifters.clear();
    this.motePool = [];
    this.buildTerrain(game);
    this.lanterns = game.lanterns.map((l) => this.makeLantern(l.pos));
    this.charms = game.charms.map((c) => this.makeCharm(c.pos));
    this.heading = 0;
  }

  onEvents(events: TimedEvent[]): void {
    for (const e of events) if (e.name === 'pulse') this.pulseT = 0;
  }

  /** Project a world point; returns NDC x,y and whether it is in front of the camera. */
  project(pos: readonly number[]): { x: number; y: number; front: boolean } {
    const v = new THREE.Vector3(pos[0], (pos[1] ?? 0) + 2.5, pos[2]);
    const camSpace = v.clone().applyMatrix4(this.camera.matrixWorldInverse);
    v.project(this.camera);
    return { x: v.x, y: v.y, front: camSpace.z < 0 };
  }

  render(game: Game, dt: number, time: number): void {
    const p = game.player;
    const pp = p.pos;

    // player
    this.player.position.set(pp[0], pp[1], pp[2]);
    if (Math.hypot(p.facing[0], p.facing[1]) > 0) this.heading = Math.atan2(p.facing[0], p.facing[1]);
    this.player.rotation.y = this.heading;
    this.player.visible = p.respawnTicks === 0 && !(p.invulnTicks > 0 && Math.floor(time * 12) % 2 === 0);
    this.playerLight.intensity = 3 + p.carried * 0.6;

    // lanterns + ambient (0.15 + 0.55 * lit/total)
    let lit = 0;
    game.lanterns.forEach((l, i) => {
      const o = this.lanterns[i];
      if (!o) return;
      if (l.lit) lit++;
      o.group.position.set(l.pos[0], l.pos[1], l.pos[2]);
      const target = l.lit ? 1 : (l.deposited / game.tuning.lantern_cost) * 0.3;
      o.glow += (target - o.glow) * Math.min(1, dt * 2);
      o.light.intensity = o.glow * 40;
      o.lamp.material.color.setHex(l.lit ? C.lit : C.off);
      o.lamp.material.emissive.setHex(C.lit); // warm orange, not washed-out white
      o.lamp.material.emissiveIntensity = l.lit ? 0.75 : o.glow * 1.5;
    });
    this.ambient.intensity = ambientFor(lit, game.lanterns.length);

    // motes (pooled): core + halo
    while (this.motePool.length < game.motes.length) this.motePool.push(this.makeMote());
    this.motePool.forEach((m, i) => {
      const mo = game.motes[i];
      m.visible = !!mo;
      if (mo) {
        m.position.set(mo.pos[0], mo.pos[1] + 0.9 + Math.sin(time * 2 + i * 1.7) * 0.25, mo.pos[2]);
        const blink = mo.kind === 'dropped' && mo.ttl < 120 && Math.floor(time * 8) % 2 === 0;
        m.visible = !blink;
      }
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
      o.age += dt;
      const stunned = s.state === 'stunned';
      o.body.material.color.setHex(stunned ? C.shadeStun : C.shadeBody);
      o.group.position.set(s.pos[0], s.pos[1] + Math.sin(time * 3 + s.pos[0]) * 0.15, s.pos[2]);
      o.group.lookAt(pp[0], s.pos[1], pp[2]);
      const grow = s.state === 'spawning' ? Math.min(1, o.age) : 1;
      o.group.scale.setScalar(grow * (stunned ? 0.85 : 1 + Math.sin(time * 6) * 0.04));
    }
    for (const [id, o] of this.shades) if (!alive.has(id)) [this.dynamic.remove(o.group), this.shades.delete(id)];

    // drifters: wavy silk ribbons
    for (const d of game.drifters) {
      let o = this.drifters.get(d.id);
      if (!o) {
        o = this.makeDrifter();
        this.drifters.set(d.id, o);
      }
      o.group.visible = d.state !== 'removed';
      o.group.position.set(d.pos[0], d.pos[1], d.pos[2]);
      o.group.lookAt(pp[0], d.pos[1], pp[2]);
      if (d.state === 'flee') o.group.rotateY(Math.PI);
      o.strips.forEach((s, i) => {
        s.position.y = Math.sin(time * 6 + i) * 0.25;
        s.rotation.z = Math.sin(time * 4 + i * 0.7) * 0.4;
      });
    }

    // charms
    game.charms.forEach((c, i) => {
      const o = this.charms[i];
      if (!o) return;
      o.visible = c.available;
      o.position.set(c.pos[0], c.pos[1] + 1 + Math.sin(time * 2) * 0.15, c.pos[2]);
      o.rotation.y = time * 1.5;
    });

    // wind leaves: visible during the 2 s warning and the gust
    const warn = game.windWarning();
    const windOn = game.wind.active || warn > 0;
    const lm = this.leaves.material;
    lm.opacity += ((windOn ? 0.9 : 0) - lm.opacity) * Math.min(1, dt * 3);
    if (lm.opacity > 0.01) {
      const a = (game.wind.dirDeg * Math.PI) / 180;
      const pos = this.leaves.geometry.getAttribute('position') as THREE.BufferAttribute;
      const sp = game.wind.active ? 8 : 3;
      for (let i = 0; i < pos.count; i++) {
        let x = pos.getX(i) + Math.cos(a) * sp * dt;
        let z = pos.getZ(i) + Math.sin(a) * sp * dt;
        if (Math.abs(x) > 15) x = -Math.sign(x) * 15;
        if (Math.abs(z) > 15) z = -Math.sign(z) * 15;
        pos.setXYZ(i, x, (pos.getY(i) + dt * 0.8 + 6) % 6, z);
      }
      pos.needsUpdate = true;
      this.leaves.position.set(pp[0], pp[1], pp[2]);
    }

    // pulse ring
    if (this.pulseT < 1) {
      this.pulseT = Math.min(1, this.pulseT + dt / 0.45);
      this.pulseRing.scale.setScalar(Math.max(0.01, game.tuning.pulse_radius * this.pulseT));
      this.pulseRing.position.set(pp[0], pp[1] + 0.15, pp[2]);
      this.pulseRing.material.opacity = 1 - this.pulseT;
    } else this.pulseRing.material.opacity = 0;

    // camera behind the contract's forward (sin yaw, cos yaw)
    const th = (this.camYawDeg * Math.PI) / 180;
    this.camera.position.set(pp[0] - Math.sin(th) * 9, pp[1] + 5.5, pp[2] - Math.cos(th) * 9);
    this.camera.lookAt(pp[0], pp[1] + 1.2, pp[2]);
    this.renderer.render(this.scene, this.camera);
  }

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------ builders

  private buildSky(): void {
    const sea = new THREE.Mesh(new THREE.CircleGeometry(400, 48), std(C.sea));
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -12;
    this.scene.add(sea);
    const cloud = std(C.fog, { flatShading: true });
    for (let i = 0; i < 80; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 60 + Math.random() * 80;
      const c = new THREE.Mesh(new THREE.IcosahedronGeometry(3 + Math.random() * 6, 0), cloud);
      c.position.set(35 + Math.cos(a) * r, -9 - Math.random() * 3, Math.sin(a) * r);
      c.scale.y = 0.45;
      this.scene.add(c);
    }
    const g = new THREE.BufferGeometry();
    const pts: number[] = [];
    for (let i = 0; i < 700; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(220);
      pts.push(v.x, Math.abs(v.y) + 15, v.z);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: C.text, size: 0.9, fog: false })));
  }

  private disc(r: number, x: number, z: number, top = 0): void {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r - 5, 6, 64), std(C.grass, { flatShading: true }));
    m.position.set(x, top - 3, z);
    const sand = new THREE.Mesh(new THREE.RingGeometry(r - 1.5, r, 64), std(C.sand));
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(x, top + 0.01, z);
    this.world.add(m, sand);
  }

  private trees(n: number, inside: (x: number, z: number) => boolean, cx: number, rMax: number): void {
    const trunk = std(C.wood);
    const leaf = std(0x2a5244, { flatShading: true });
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * rMax;
      const x = cx + Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (!inside(x, z)) continue;
      const t = new THREE.Group();
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, 1.4, 6), trunk);
      tr.position.y = 0.7;
      const lf = new THREE.Mesh(new THREE.ConeGeometry(1, 2.4, 7), leaf);
      lf.position.y = 2.4;
      t.add(tr, lf);
      t.position.set(x, 0, z);
      t.scale.setScalar(0.7 + Math.random() * 0.7);
      this.world.add(t);
    }
  }

  private buildTerrain(game: Game): void {
    const map = game.map;
    const clearOf = (x: number, z: number) =>
      game.lanterns.every((l) => Math.hypot(l.pos[0] - x, l.pos[2] - z) > 4) &&
      map.motePoints.every((m) => Math.hypot(m[0] - x, m[2] - z) > 2) &&
      Math.hypot(x - map.start[0], z - map.start[2]) > 10;
    if (map.night === 1) {
      this.disc(40, 0, 0);
      this.trees(60, (x, z) => map.ground(x, z) === 0 && clearOf(x, z), 0, 38);
    } else if (map.night === 2) {
      this.disc(28, 0, 0);
      this.disc(28, 70, 0);
      const plankMat = std(C.wood);
      for (let x = 26; x < 44; x += 0.6) {
        const plank = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 4), plankMat);
        plank.position.set(x + 0.3, -0.07, 0);
        this.world.add(plank);
      }
      this.trees(30, (x, z) => map.ground(x, z) === 0 && clearOf(x, z) && Math.abs(z) > 3, 0, 26);
      this.trees(30, (x, z) => map.ground(x, z) === 0 && clearOf(x, z) && Math.abs(z) > 3, 70, 26);
    } else {
      this.disc(45, 0, 0);
      // tier 1: half annulus 12..24 (z > 0), Y = 3
      const shape = new THREE.Shape();
      shape.absarc(0, 0, 24, Math.PI, 2 * Math.PI, false);
      shape.absarc(0, 0, 12, 2 * Math.PI, Math.PI, true);
      const t1 = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: false, curveSegments: 32 }), std(0x3a6b5c, { flatShading: true }));
      t1.rotation.x = -Math.PI / 2; // shape y -> world -z, extrude -> +y
      this.world.add(t1);
      // tier 2: disc r 8, Y = 6
      const t2 = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 6, 48), std(0x467a69, { flatShading: true }));
      t2.position.y = 3;
      // bell tower r 2, 8 m tall
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 8, 20), std(C.wood));
      tower.position.y = 10;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 2.2, 20), std(0x7a2a2a));
      roof.position.y = 15.1;
      const bell = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), std(C.gold, { metalness: 0.6, roughness: 0.3 }));
      bell.position.y = 13;
      this.world.add(t2, tower, roof, bell);
      // ramps at 30 and 150 degrees: r 30 (Y 0) -> r 24 (Y 3)
      for (const deg of [30, 150]) {
        const a = (deg * Math.PI) / 180;
        const ramp = new THREE.Mesh(new THREE.BoxGeometry(3, 0.3, Math.hypot(6, 3)), std(C.sand));
        ramp.rotation.order = 'YXZ';
        ramp.rotation.y = Math.PI / 2 - a;
        ramp.rotation.x = Math.atan2(3, 6);
        ramp.position.set(27 * Math.cos(a), 1.35, 27 * Math.sin(a));
        this.world.add(ramp);
      }
      this.trees(50, (x, z) => map.ground(x, z) === 0 && clearOf(x, z) && Math.hypot(x, z) > 26, 0, 43);
    }
    for (const pad of map.pads) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(pad.radius, pad.radius, 0.2, 24), std(C.gold, { emissive: C.gold, emissiveIntensity: 0.6 }));
      m.position.set(pad.pos[0], pad.pos[1] + 0.1, pad.pos[2]);
      this.world.add(m);
    }
  }

  private buildPlayer(): void {
    const coat = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.6, 4, 12), std(C.coat));
    coat.position.y = 0.65;
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.08, 8, 20), std(C.scarf));
    scarf.rotation.x = Math.PI / 2;
    scarf.position.y = 1.08;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), std(0xffe0c4));
    head.position.y = 1.35;
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.45, 24, 1, true), std(C.sand, { side: THREE.DoubleSide, flatShading: true }));
    hat.position.y = 1.72;
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.16), std(C.lit, { emissive: C.lit, emissiveIntensity: 2 }));
    lamp.position.set(0, 1.12, 0.68);
    this.playerLight.position.copy(lamp.position);
    this.player.add(coat, scarf, head, hat, lamp, this.playerLight);
    this.scene.add(this.player);
  }

  private makeLantern(pos: readonly number[]): LanternObj {
    const group = new THREE.Group();
    const wood = std(C.wood);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 3.2, 8), wood);
    post.position.y = 1.6;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 1), wood);
    arm.position.set(0, 3.1, 0.45);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.6), std(C.off, { emissive: C.lit, emissiveIntensity: 0 })) as StdMesh;
    lamp.position.set(0, 2.55, 0.9);
    const light = new THREE.PointLight(C.lit, 0, 26, 1.4);
    light.position.copy(lamp.position);
    group.add(post, arm, lamp, light);
    group.position.set(pos[0]!, pos[1]!, pos[2]!);
    this.dynamic.add(group);
    return { group, lamp, light, glow: 0 };
  }

  private makeMote(): THREE.Group {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), new THREE.MeshBasicMaterial({ color: C.moteCore })));
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshBasicMaterial({ color: C.moteHalo, transparent: true, opacity: 0.3 })));
    this.dynamic.add(g);
    return g;
  }

  private makeShade(): ShadeObj {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 12), std(C.shadeBody, { emissive: 0x1a0030 })) as StdMesh;
    body.scale.y = 1.25;
    const rim = new THREE.Mesh(new THREE.SphereGeometry(0.78, 16, 12), new THREE.MeshBasicMaterial({ color: C.shadeRim, side: THREE.BackSide }));
    rim.scale.y = 1.25;
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xd9b3ff });
    for (const sx of [-0.22, 0.22]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), eyeMat);
      eye.position.set(sx, 0.2, 0.62);
      group.add(eye);
    }
    group.add(body, rim);
    this.dynamic.add(group);
    return { group, body, age: 0 };
  }

  private makeDrifter(): DrifterObj {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: C.drifter, side: THREE.DoubleSide, transparent: true, opacity: 0.85, emissive: C.drifter, emissiveIntensity: 0.2 });
    const strips = [0, 1, 2, 3, 4].map((i) => {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.35), mat);
      s.position.z = -i * 0.7;
      group.add(s);
      return s;
    });
    this.dynamic.add(group);
    return { group, strips };
  }

  private makeCharm(pos: readonly number[]): THREE.Group {
    const g = new THREE.Group();
    const paper = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.04), std(C.charm, { emissive: C.charm, emissiveIntensity: 0.4 }));
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(paper.geometry), new THREE.LineBasicMaterial({ color: C.gold }));
    g.add(paper, edge);
    g.position.set(pos[0]!, pos[1]!, pos[2]!);
    this.dynamic.add(g);
    return g;
  }
}
