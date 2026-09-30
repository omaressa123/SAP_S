import { Animation, AnimationGroup, Scene, TransformNode } from '@babylonjs/core';

/**
 * Step 3 — real walk cycles as looping AnimationGroups.
 *
 * One 48-frame cycle (~1.6 s at 30 fps, matching the old 4.2 rad/s stride):
 * legs swing anti-phase ±0.52 rad at the hips, arms counter-swing ±0.42 rad
 * at the shoulders, torso bobs twice per cycle with a slight yaw roll and the
 * head counter-rotates. Callers vary phase (goToFrame) and tempo
 * (speedRatio) per person so the crowd never marches in sync.
 */

export const WALK_FRAMES = 48;
const FPS = 30;
const LEG_SWING = 0.52;
const ARM_SWING = 0.42;

export interface WalkRig {
  leftLeg: TransformNode;
  rightLeg: TransformNode;
  leftArm: TransformNode;
  rightArm: TransformNode;
  torso: TransformNode;
  head: TransformNode;
  torsoBaseY: number;
  /** False for luggage carriers / phone-holders whose right arm keeps its pose. */
  driveRightArm: boolean;
}

let walkSeq = 0;

function floatAnim(prop: string, peaks: [number, number][]): Animation {
  const a = new Animation(
    `walk_${prop}_${walkSeq++}`,
    prop,
    FPS,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CYCLE,
  );
  a.setKeys(peaks.map(([frame, value]) => ({ frame, value })));
  return a;
}

/** Symmetric 5-key stride: 0 → +peak → 0 → −peak → 0. Negate peak for anti-phase. */
function stride(peak: number): [number, number][] {
  const q = WALK_FRAMES / 4;
  return [
    [0, 0],
    [q, peak],
    [q * 2, 0],
    [q * 3, -peak],
    [WALK_FRAMES, 0],
  ];
}

/** Double-bounce vertical bob over one stride. */
function bob(baseY: number, amp: number): [number, number][] {
  const q = WALK_FRAMES / 4;
  return [
    [0, baseY],
    [q, baseY + amp],
    [q * 2, baseY],
    [q * 3, baseY + amp],
    [WALK_FRAMES, baseY],
  ];
}

export function ensureWalkCycle(scene: Scene, rig: WalkRig, key: string): AnimationGroup {
  const g = new AnimationGroup(`walkCycle_${key}_${walkSeq++}`, scene);
  g.addTargetedAnimation(floatAnim('rotation.x', stride(LEG_SWING)), rig.leftLeg);
  g.addTargetedAnimation(floatAnim('rotation.x', stride(-LEG_SWING)), rig.rightLeg);
  g.addTargetedAnimation(floatAnim('rotation.x', stride(-ARM_SWING)), rig.leftArm);
  if (rig.driveRightArm) {
    g.addTargetedAnimation(floatAnim('rotation.x', stride(ARM_SWING)), rig.rightArm);
  }
  g.addTargetedAnimation(floatAnim('position.y', bob(rig.torsoBaseY, 0.035)), rig.torso);
  g.addTargetedAnimation(floatAnim('rotation.y', stride(0.06)), rig.torso);
  g.addTargetedAnimation(floatAnim('rotation.y', stride(-0.04)), rig.head);
  g.normalize(0, WALK_FRAMES);
  return g;
}

/** Start a walk group at a random phase so walkers never sync up. */
export function playWalkCycle(g: AnimationGroup, speedRatio: number): void {
  if (!g.isPlaying) g.play(true);
  try {
    g.goToFrame(Math.random() * WALK_FRAMES);
  } catch {
    /* headless / disposed scene: keep playing from 0 */
  }
  g.speedRatio = speedRatio;
}
