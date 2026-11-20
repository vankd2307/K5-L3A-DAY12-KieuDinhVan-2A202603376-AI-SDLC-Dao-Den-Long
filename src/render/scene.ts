import * as THREE from 'three';
import type { GameState } from '../core';

/** Read-only view of GameState. Never mutates game logic. */
export class SceneView {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
  private readonly player: THREE.Mesh;

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x0b0d1a);
    this.scene.fog = new THREE.Fog(0x0b0d1a, 10, 60);
    this.scene.add(new THREE.HemisphereLight(0x8899ff, 0x221133, 0.6));
    const sun = new THREE.DirectionalLight(0xffe9a8, 1.2);
    sun.position.set(5, 10, 3);
    this.scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(30, 48),
      new THREE.MeshStandardMaterial({ color: 0x2a3b2e }),
    );
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);

    this.player = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.4, 0.8, 4, 12),
      new THREE.MeshStandardMaterial({ color: 0xffd36b, emissive: 0x442200 }),
    );
    this.player.position.y = 0.8;
    this.scene.add(this.player);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  render(state: GameState): void {
    const p = state.player.pos;
    this.player.position.set(p.x, 0.8, p.z);
    // Third-person follow camera.
    this.camera.position.set(p.x, 6, p.z + 9);
    this.camera.lookAt(p.x, 1, p.z);
    this.renderer.render(this.scene, this.camera);
  }
}
