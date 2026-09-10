/**
 * Visual themes. Everything here is purely cosmetic — the simulation never
 * reads a theme.
 */
export interface Theme {
  name: string;
  background: number;
  fog: number;
  fogNear: number;
  fogFar: number;

  base: number;

  floor: number;
  floorAlt: number;
  floorEdge: number;

  wall: number;
  wallTop: number;

  void: number;
  voidGlow: number;

  exit: number;
  exitGlow: number;

  hazard: number;
  hazardGlow: number;

  shrineStone: number;
  shrineGlow: number;

  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;

  sun: number;
  sunIntensity: number;

  ground: number;
}

const THEMES: Record<string, Theme> = {
  road: {
    name: "road",
    background: 0x0d1014,
    fog: 0x0d1014,
    fogNear: 14,
    fogFar: 34,
    base: 0x1b1e22,
    floor: 0x6f7d5a,
    floorAlt: 0x7d8b63,
    floorEdge: 0x55613f,
    wall: 0x5d6157,
    wallTop: 0x767b6d,
    void: 0x05070a,
    voidGlow: 0x1b2733,
    exit: 0xffd98a,
    exitGlow: 0xffc45e,
    hazard: 0x7d2b22,
    hazardGlow: 0xff5b3d,
    shrineStone: 0xcbbfa4,
    shrineGlow: 0xffd27a,
    hemiSky: 0x9fb4d0,
    hemiGround: 0x2a2b26,
    hemiIntensity: 0.75,
    sun: 0xfff0d4,
    sunIntensity: 1.5,
    ground: 0x121418,
  },
  river: {
    name: "river",
    background: 0x0a1216,
    fog: 0x0a1216,
    fogNear: 13,
    fogFar: 32,
    base: 0x161f22,
    floor: 0x5f7a6a,
    floorAlt: 0x6b8874,
    floorEdge: 0x44594d,
    wall: 0x4b5b5c,
    wallTop: 0x64777a,
    void: 0x03161e,
    voidGlow: 0x0e3a4a,
    exit: 0xa8e8ff,
    exitGlow: 0x66d4ff,
    hazard: 0x1f4a5c,
    hazardGlow: 0x3fc6ff,
    shrineStone: 0xc3c9bb,
    shrineGlow: 0xa8e8ff,
    hemiSky: 0x9fc4d6,
    hemiGround: 0x1d2a2c,
    hemiIntensity: 0.8,
    sun: 0xdff2ff,
    sunIntensity: 1.4,
    ground: 0x0b1418,
  },
  mountain: {
    name: "mountain",
    background: 0x10131a,
    fog: 0x10131a,
    fogNear: 13,
    fogFar: 33,
    base: 0x1c2027,
    floor: 0x6d6f78,
    floorAlt: 0x7b7d86,
    floorEdge: 0x4f525a,
    wall: 0x4a4d57,
    wallTop: 0x6a6e79,
    void: 0x04050a,
    voidGlow: 0x171d2b,
    exit: 0xbfe6ff,
    exitGlow: 0x7cc9ff,
    hazard: 0x6a2733,
    hazardGlow: 0xff4f6a,
    shrineStone: 0xd7cdb6,
    shrineGlow: 0xbfe6ff,
    hemiSky: 0x93a5c4,
    hemiGround: 0x24262c,
    hemiIntensity: 0.8,
    sun: 0xeae6ff,
    sunIntensity: 1.35,
    ground: 0x0e1016,
  },
  snow: {
    name: "snow",
    background: 0x141a24,
    fog: 0x141a24,
    fogNear: 12,
    fogFar: 30,
    base: 0x202833,
    floor: 0xcdd8e3,
    floorAlt: 0xdfe8f0,
    floorEdge: 0x9fb0c0,
    wall: 0x8fa0b2,
    wallTop: 0xb9c8d6,
    void: 0x0a1018,
    voidGlow: 0x1d2b3d,
    exit: 0xfff0b8,
    exitGlow: 0xffd977,
    hazard: 0x2a4a63,
    hazardGlow: 0x74d0ff,
    shrineStone: 0x9aa6b2,
    shrineGlow: 0xffe9a8,
    hemiSky: 0xdce8f4,
    hemiGround: 0x2b323c,
    hemiIntensity: 0.95,
    sun: 0xffffff,
    sunIntensity: 1.3,
    ground: 0x11161d,
  },
  ruins: {
    name: "ruins",
    background: 0x14110d,
    fog: 0x14110d,
    fogNear: 13,
    fogFar: 32,
    base: 0x221d16,
    floor: 0x8a7b5e,
    floorAlt: 0x978769,
    floorEdge: 0x655a43,
    wall: 0x6b604c,
    wallTop: 0x8a7d64,
    void: 0x070604,
    voidGlow: 0x1f1a11,
    exit: 0xffd98a,
    exitGlow: 0xffb84d,
    hazard: 0x6d2a1c,
    hazardGlow: 0xff6a3d,
    shrineStone: 0xd8c8a6,
    shrineGlow: 0xffd98a,
    hemiSky: 0xc4a878,
    hemiGround: 0x2a241a,
    hemiIntensity: 0.8,
    sun: 0xffe0b0,
    sunIntensity: 1.5,
    ground: 0x100e0a,
  },
  night: {
    name: "night",
    background: 0x05070f,
    fog: 0x05070f,
    fogNear: 12,
    fogFar: 30,
    base: 0x0d1220,
    floor: 0x3a4358,
    floorAlt: 0x434d63,
    floorEdge: 0x2a3143,
    wall: 0x2c3346,
    wallTop: 0x424b63,
    void: 0x02030a,
    voidGlow: 0x101a35,
    exit: 0xa8ffe0,
    exitGlow: 0x54ffc4,
    hazard: 0x4a1f3a,
    hazardGlow: 0xff3d8a,
    shrineStone: 0xbfc6d8,
    shrineGlow: 0xffe08a,
    hemiSky: 0x4a5b8c,
    hemiGround: 0x0a0c14,
    hemiIntensity: 0.7,
    sun: 0xbcd0ff,
    sunIntensity: 1.15,
    ground: 0x05070f,
  },
};

export function getTheme(name: string | undefined): Theme {
  return THEMES[name ?? "road"] ?? THEMES.road;
}
