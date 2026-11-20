/** Ticket-02 standard palette (Part 3 item 8). */
export const C = {
  sky: 0x0e1430,
  fog: 0x1b2350,
  grass: 0x2f5d50,
  sand: 0xc9b48a,
  wood: 0x6b4a2f,
  sea: 0x12384a,
  lit: 0xffb347,
  core: 0xffe9b0,
  off: 0x5b5f6e,
  moteCore: 0xfff6c2,
  moteHalo: 0xffe58a,
  shadeBody: 0x120a1a,
  shadeRim: 0x7a3cff,
  shadeRimCb: 0x00b3ff, // colour-blind friendly palette (Ticket-03)
  shadeStun: 0x3a3450,
  coat: 0xe8e2d0,
  scarf: 0xc8102e,
  charm: 0xc8102e,
  gold: 0xf2c14e,
  drifter: 0x8fa3b8,
  danger: 0xff5a5f,
  text: 0xf5f1e6,
} as const;

/** Ambient light = 0.15 + 0.55 x (lit / total). */
export const ambientFor = (lit: number, total: number): number => 0.15 + 0.55 * (total ? lit / total : 0);
