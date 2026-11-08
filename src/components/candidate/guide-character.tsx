"use client";

import { useEffect, useRef, type PointerEvent } from "react";
import * as THREE from "three";
import styles from "./guide-character.module.css";

export type GuideCharacterState =
  | "idle"
  | "welcome"
  | "thinking"
  | "checking"
  | "pointing"
  | "success"
  | "unavailable";

type Pose = {
  headPitch: number;
  headYaw: number;
  headRoll: number;
  torsoRoll: number;
  leftShoulder: number;
  leftElbow: number;
  leftWrist: number;
  rightShoulder: number;
  rightElbow: number;
  rightWrist: number;
  brow: number;
};

type ArmRig = {
  shoulder: THREE.Group;
  elbow: THREE.Group;
  wrist: THREE.Group;
};

const poses: Record<GuideCharacterState, Pose> = {
  idle: {
    headPitch: 0,
    headYaw: 0,
    headRoll: 0,
    torsoRoll: 0,
    leftShoulder: 0.17,
    leftElbow: -0.12,
    leftWrist: 0,
    rightShoulder: -0.17,
    rightElbow: 0.12,
    rightWrist: 0,
    brow: 0,
  },
  welcome: {
    headPitch: -0.045,
    headYaw: -0.035,
    headRoll: -0.025,
    torsoRoll: -0.018,
    leftShoulder: 0.17,
    leftElbow: -0.12,
    leftWrist: 0,
    rightShoulder: 2.45,
    rightElbow: -0.2,
    rightWrist: 0.12,
    brow: 0.08,
  },
  thinking: {
    headPitch: -0.07,
    headYaw: 0.15,
    headRoll: 0.07,
    torsoRoll: 0.018,
    leftShoulder: 1.75,
    leftElbow: 0.9,
    leftWrist: -0.15,
    rightShoulder: -0.14,
    rightElbow: 0.18,
    rightWrist: 0,
    brow: 0.12,
  },
  checking: {
    headPitch: 0.018,
    headYaw: 0,
    headRoll: 0,
    torsoRoll: 0,
    leftShoulder: 0.14,
    leftElbow: -0.1,
    leftWrist: 0,
    rightShoulder: -0.16,
    rightElbow: 0.13,
    rightWrist: 0,
    brow: 0.035,
  },
  pointing: {
    headPitch: -0.01,
    headYaw: -0.13,
    headRoll: -0.02,
    torsoRoll: -0.025,
    leftShoulder: 0.15,
    leftElbow: -0.1,
    leftWrist: 0,
    rightShoulder: 1.52,
    rightElbow: -0.08,
    rightWrist: 1.42,
    brow: 0.03,
  },
  success: {
    headPitch: -0.075,
    headYaw: 0,
    headRoll: 0,
    torsoRoll: 0,
    leftShoulder: -2.15,
    leftElbow: 0.16,
    leftWrist: -0.15,
    rightShoulder: 2.15,
    rightElbow: -0.16,
    rightWrist: 0.15,
    brow: 0.18,
  },
  unavailable: {
    headPitch: 0.07,
    headYaw: 0.08,
    headRoll: 0.12,
    torsoRoll: 0.035,
    leftShoulder: -0.94,
    leftElbow: -0.2,
    leftWrist: -0.68,
    rightShoulder: 0.94,
    rightElbow: 0.2,
    rightWrist: 0.68,
    brow: -0.09,
  },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function buildArm(
  side: -1 | 1,
  parent: THREE.Group,
  sleeve: THREE.Material,
  skin: THREE.Material,
  geometry: (value: THREE.BufferGeometry) => THREE.BufferGeometry,
): ArmRig {
  const shoulder = new THREE.Group();
  shoulder.position.set(side * 0.68, 1.88, 0.01);
  parent.add(shoulder);

  const upper = new THREE.Mesh(
    geometry(new THREE.CapsuleGeometry(0.205, 0.43, 7, 14)),
    sleeve,
  );
  upper.position.set(0, -0.34, 0);
  shoulder.add(upper);

  const elbow = new THREE.Group();
  elbow.position.set(0, -0.64, 0.015);
  shoulder.add(elbow);
  const elbowJoint = new THREE.Mesh(
    geometry(new THREE.SphereGeometry(0.178, 24, 18)),
    sleeve,
  );
  elbowJoint.scale.set(1, 1.03, 0.96);
  elbow.add(elbowJoint);

  const forearm = new THREE.Mesh(
    geometry(new THREE.CapsuleGeometry(0.158, 0.37, 7, 14)),
    sleeve,
  );
  forearm.position.set(0, -0.31, 0.035);
  elbow.add(forearm);

  const wrist = new THREE.Group();
  wrist.position.set(0, -0.61, 0.075);
  elbow.add(wrist);

  const cuff = new THREE.Mesh(
    geometry(new THREE.TorusGeometry(0.152, 0.026, 8, 20)),
    sleeve,
  );
  cuff.rotation.x = Math.PI / 2;
  cuff.position.z = -0.004;
  wrist.add(cuff);

  const palm = new THREE.Mesh(
    geometry(new THREE.SphereGeometry(0.15, 22, 16)),
    skin,
  );
  palm.position.set(0, -0.105, 0.04);
  palm.scale.set(0.83, 1.04, 0.56);
  wrist.add(palm);

  // Four separate fingers and a thumb make the wave and pointing poses read as
  // a jointed hand instead of a mitten attached to a moving sleeve.
  const fingerLengths = [0.18, 0.23, 0.21, 0.17];
  fingerLengths.forEach((length, index) => {
    const x = (index - 1.5) * 0.069;
    const finger = new THREE.Mesh(
      geometry(new THREE.CapsuleGeometry(0.035, length, 5, 8)),
      skin,
    );
    finger.position.set(
      x,
      -0.23 - (index === 1 || index === 2 ? 0.02 : 0),
      0.045,
    );
    wrist.add(finger);
  });
  const thumb = new THREE.Mesh(
    geometry(new THREE.CapsuleGeometry(0.041, 0.13, 5, 8)),
    skin,
  );
  thumb.position.set(side * 0.145, -0.105, 0.04);
  thumb.rotation.z = side * -0.82;
  wrist.add(thumb);

  return { shoulder, elbow, wrist };
}

function FallbackCharacter({ state }: { state: GuideCharacterState }) {
  return (
    <svg
      className={styles.fallback}
      viewBox="0 0 360 390"
      focusable="false"
      aria-hidden="true"
      data-state={state}
    >
      <defs>
        <linearGradient id="guideHoodie" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6686ff" />
          <stop offset="1" stopColor="#2148bb" />
        </linearGradient>
        <radialGradient id="guideSkin" cx="35%" cy="28%">
          <stop offset="0" stopColor="#c07a5c" />
          <stop offset="1" stopColor="#75412f" />
        </radialGradient>
      </defs>
      <ellipse cx="180" cy="354" rx="98" ry="16" fill="#162c6b" opacity=".13" />
      <g className={styles.fallbackBody}>
        <path
          d="M91 231 Q112 205 143 200 L217 200 Q249 207 269 235 L291 370 L69 370Z"
          fill="url(#guideHoodie)"
        />
        <path
          d="M140 229 Q180 247 220 229 L245 258 Q180 283 115 258Z"
          fill="#315ed2"
        />
        <path
          d="M153 222 L160 303 M207 222 L200 303"
          stroke="#9ebcff"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d="M130 325 Q180 346 230 325 L226 370 L134 370Z"
          fill="#2349ad"
          opacity=".7"
        />
      </g>
      <g className={styles.fallbackLeftArm}>
        <path
          d="M110 220 Q83 254 84 303 L83 318"
          fill="none"
          stroke="#315ed2"
          strokeWidth="42"
          strokeLinecap="round"
        />
        <circle cx="83" cy="320" r="17" fill="url(#guideSkin)" />
      </g>
      <g className={styles.fallbackRightArm}>
        <path
          d="M249 220 Q278 255 276 299 L279 317"
          fill="none"
          stroke="#315ed2"
          strokeWidth="42"
          strokeLinecap="round"
        />
        <circle cx="280" cy="319" r="17" fill="url(#guideSkin)" />
      </g>
      <path
        d="M137 215 Q130 178 145 160 L215 160 Q231 179 222 215 L180 241Z"
        fill="#183b9c"
      />
      <ellipse cx="180" cy="139" rx="63" ry="76" fill="url(#guideSkin)" />
      <path
        d="M118 137 Q112 71 166 57 Q231 47 246 105 Q228 88 209 89 Q179 112 140 94 Q145 126 118 137Z"
        fill="#171924"
      />
      <path
        d="M135 165 Q145 218 180 220 Q215 217 227 164 Q211 187 181 189 Q151 188 135 165Z"
        fill="#34232a"
      />
      <path
        d="M144 133 Q157 124 168 132 M193 132 Q205 124 216 133"
        stroke="#251b22"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <ellipse cx="157" cy="143" rx="11" ry="13" fill="#fffaf5" />
      <ellipse cx="201" cy="143" rx="11" ry="13" fill="#fffaf5" />
      <circle cx="159" cy="144" r="5.5" fill="#24304e" />
      <circle cx="203" cy="144" r="5.5" fill="#24304e" />
      <ellipse cx="180" cy="158" rx="8" ry="13" fill="#a76248" />
      <path
        d="M165 173 Q180 184 195 173"
        fill="none"
        stroke="#f5c4ad"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="M123 131 Q118 85 149 71 Q179 47 218 70 Q243 87 237 131"
        fill="none"
        stroke="#263048"
        strokeWidth="11"
      />
      <circle cx="121" cy="139" r="18" fill="#24314e" />
      <circle cx="239" cy="139" r="18" fill="#24314e" />
      <circle cx="121" cy="139" r="8" fill="#50d8f2" />
      <circle cx="239" cy="139" r="8" fill="#50d8f2" />
    </svg>
  );
}

export function GuideCharacter({
  state,
  className,
  focused = false,
}: {
  state: GuideCharacterState;
  className?: string;
  /** Used only by the unlinked keyboard and pointer showcase. */
  focused?: boolean;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const pointer = useRef(new THREE.Vector2());
  const stateRef = useRef(state);
  const focusedRef = useRef(focused);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    focusedRef.current = focused;
  }, [focused]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
        preserveDrawingBuffer: false,
      });
    } catch {
      delete stage.dataset.rendererReady;
      return;
    }

    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const ownGeometry = <T extends THREE.BufferGeometry>(value: T) => {
      geometries.add(value);
      return value;
    };
    const ownMaterial = <T extends THREE.Material>(value: T) => {
      materials.add(value);
      return value;
    };
    const sphere = ownGeometry(new THREE.SphereGeometry(1, 32, 24));
    const mat = (color: number, roughness = 0.62, metalness = 0) =>
      ownMaterial(
        new THREE.MeshStandardMaterial({ color, roughness, metalness }),
      );

    const skin = mat(0x9a5d45, 0.9);
    const skinLight = mat(0xb87858, 0.87);
    const skinShade = mat(0x603628, 0.92);
    const hair = mat(0x181a23, 0.94);
    const hairSoft = mat(0x262733, 0.93);
    const beard = mat(0x30252a, 0.94);
    const beardLight = mat(0x403139, 0.94);
    const hoodie = mat(0x315edb, 0.84);
    const hoodieLight = mat(0x4b78ed, 0.8);
    const hoodieDark = mat(0x203f9f, 0.88);
    const headphone = mat(0x202942, 0.74, 0.04);
    const cyan = mat(0x46d7ef, 0.6, 0.02);
    const white = mat(0xfffaf4, 0.58);
    const iris = mat(0x593628, 0.68);
    const pupil = mat(0x17151b, 0.5);
    const glint = mat(0xffffff, 0.4);
    const gold = mat(0xffce75, 0.66, 0.02);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 40);
    camera.position.set(0, 2.04, 10.2);
    camera.lookAt(0, 2.04, 0);

    scene.add(new THREE.HemisphereLight(0xd9efff, 0x18275c, 1.55));
    const warmKey = new THREE.DirectionalLight(0xffddc8, 1.9);
    warmKey.position.set(-4.2, 6.5, 6.2);
    scene.add(warmKey);
    const coolRim = new THREE.DirectionalLight(0x54d9fa, 1.25);
    coolRim.position.set(4.5, 3.8, -4.5);
    scene.add(coolRim);
    const faceFill = new THREE.PointLight(0xeff8ff, 0.3, 8);
    faceFill.position.set(0, 3.2, 5);
    scene.add(faceFill);

    const actor = new THREE.Group();
    scene.add(actor);

    function ellipsoid(
      parent: THREE.Object3D,
      material: THREE.Material,
      position: [number, number, number],
      scale: [number, number, number],
    ) {
      const value = new THREE.Mesh(sphere, material);
      value.position.set(...position);
      value.scale.set(...scale);
      parent.add(value);
      return value;
    }

    function tube(
      parent: THREE.Object3D,
      points: THREE.Vector3[],
      radius: number,
      material: THREE.Material,
    ) {
      const curve = new THREE.CatmullRomCurve3(points);
      const value = new THREE.Mesh(
        ownGeometry(new THREE.TubeGeometry(curve, 28, radius, 8, false)),
        material,
      );
      parent.add(value);
      return value;
    }

    const torso = new THREE.Group();
    actor.add(torso);
    const profile = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.45, 0),
      new THREE.Vector2(0.64, 0.16),
      new THREE.Vector2(0.78, 0.43),
      new THREE.Vector2(0.86, 0.86),
      new THREE.Vector2(0.86, 1.24),
      new THREE.Vector2(0.77, 1.54),
      new THREE.Vector2(0.56, 1.77),
      new THREE.Vector2(0.31, 1.89),
      new THREE.Vector2(0, 1.91),
    ];
    const sweatshirt = new THREE.Mesh(
      ownGeometry(new THREE.LatheGeometry(profile, 56)),
      hoodie,
    );
    sweatshirt.position.y = 0.24;
    torso.add(sweatshirt);

    // Hood and collar sit behind the neck, giving the chest and face depth.
    ellipsoid(actor, hoodieDark, [0, 2.13, -0.18], [0.53, 0.42, 0.42]);
    const neck = new THREE.Mesh(
      ownGeometry(new THREE.CapsuleGeometry(0.23, 0.35, 8, 20)),
      skin,
    );
    neck.position.set(0, 2.23, 0.025);
    actor.add(neck);

    const leftArm = buildArm(-1, actor, hoodie, skin, ownGeometry);
    const rightArm = buildArm(1, actor, hoodie, skin, ownGeometry);

    // Kangaroo pocket, welt, and cords add familiar sweatshirt detail.
    const pocketShape = new THREE.Shape();
    pocketShape.moveTo(-0.53, 0.08);
    pocketShape.quadraticCurveTo(-0.53, 0, -0.42, 0);
    pocketShape.lineTo(0.42, 0);
    pocketShape.quadraticCurveTo(0.53, 0, 0.53, 0.08);
    pocketShape.lineTo(0.46, 0.4);
    pocketShape.quadraticCurveTo(0, 0.5, -0.46, 0.4);
    pocketShape.closePath();
    const pocket = new THREE.Mesh(
      ownGeometry(new THREE.ShapeGeometry(pocketShape, 16)),
      hoodieDark,
    );
    pocket.position.set(0, 0.61, 0.748);
    torso.add(pocket);
    tube(
      torso,
      [
        new THREE.Vector3(-0.34, 1.9, 0.47),
        new THREE.Vector3(-0.25, 1.63, 0.72),
        new THREE.Vector3(-0.21, 1.26, 0.83),
      ],
      0.025,
      hoodieLight,
    );
    tube(
      torso,
      [
        new THREE.Vector3(0.34, 1.9, 0.47),
        new THREE.Vector3(0.25, 1.63, 0.72),
        new THREE.Vector3(0.21, 1.26, 0.83),
      ],
      0.025,
      hoodieLight,
    );
    ellipsoid(torso, cyan, [-0.21, 1.23, 0.82], [0.036, 0.08, 0.035]);
    ellipsoid(torso, cyan, [0.21, 1.23, 0.82], [0.036, 0.08, 0.035]);

    const headPivot = new THREE.Group();
    headPivot.position.set(0, 2.89, 0.025);
    actor.add(headPivot);

    const face = ellipsoid(headPivot, skin, [0, 0, 0], [0.59, 0.75, 0.49]);
    face.scale.y *= 1.035;
    // Warm cheek planes keep the modeled face from reading as a single sphere.
    ellipsoid(headPivot, skinLight, [-0.34, -0.18, 0.33], [0.19, 0.17, 0.13]);
    ellipsoid(headPivot, skinLight, [0.34, -0.18, 0.33], [0.19, 0.17, 0.13]);
    ellipsoid(
      headPivot,
      skinShade,
      [-0.565, -0.02, 0.02],
      [0.105, 0.17, 0.105],
    );
    ellipsoid(headPivot, skinShade, [0.565, -0.02, 0.02], [0.105, 0.17, 0.105]);

    // Sculpt a short, trimmed beard over the jaw, leaving the cheeks and mouth
    // expressive in the light.
    const beardShape = new THREE.Shape();
    beardShape.moveTo(-0.47, -0.16);
    beardShape.bezierCurveTo(-0.46, -0.35, -0.29, -0.61, 0, -0.64);
    beardShape.bezierCurveTo(0.29, -0.61, 0.46, -0.35, 0.47, -0.16);
    beardShape.bezierCurveTo(0.33, -0.23, 0.17, -0.25, 0, -0.22);
    beardShape.bezierCurveTo(-0.17, -0.25, -0.33, -0.23, -0.47, -0.16);
    const beardMesh = new THREE.Mesh(
      ownGeometry(
        new THREE.ExtrudeGeometry(beardShape, {
          depth: 0.035,
          bevelEnabled: true,
          bevelSegments: 3,
          steps: 1,
          bevelSize: 0.018,
          bevelThickness: 0.018,
          curveSegments: 20,
        }),
      ),
      beard,
    );
    beardMesh.position.set(0, 0, 0.435);
    headPivot.add(beardMesh);
    ellipsoid(
      headPivot,
      beardLight,
      [-0.12, -0.235, 0.488],
      [0.14, 0.06, 0.055],
    );
    ellipsoid(
      headPivot,
      beardLight,
      [0.12, -0.235, 0.488],
      [0.14, 0.06, 0.055],
    );

    const mouthCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.125, -0.34, 0.525),
      new THREE.Vector3(0, -0.385, 0.54),
      new THREE.Vector3(0.125, -0.34, 0.525),
    ]);
    const smile = new THREE.Mesh(
      ownGeometry(new THREE.TubeGeometry(mouthCurve, 16, 0.018, 8, false)),
      skinLight,
    );
    headPivot.add(smile);

    const nose = ellipsoid(
      headPivot,
      skinLight,
      [0, -0.04, 0.485],
      [0.105, 0.15, 0.12],
    );
    nose.rotation.x = -0.12;
    ellipsoid(
      headPivot,
      skinShade,
      [-0.055, -0.105, 0.576],
      [0.022, 0.018, 0.016],
    );
    ellipsoid(
      headPivot,
      skinShade,
      [0.055, -0.105, 0.576],
      [0.022, 0.018, 0.016],
    );

    const eyeGroups: Array<{ group: THREE.Group; side: -1 | 1 }> = [];
    for (const side of [-1, 1] as const) {
      const eye = new THREE.Group();
      eye.position.set(side * 0.22, 0.115, 0.421);
      headPivot.add(eye);
      const sclera = ellipsoid(eye, white, [0, 0, 0], [0.13, 0.091, 0.052]);
      sclera.scale.set(0.13, 0.091, 0.052);
      const irisGroup = new THREE.Group();
      irisGroup.position.set(0, -0.002, 0.047);
      eye.add(irisGroup);
      ellipsoid(irisGroup, iris, [0, 0, 0], [0.055, 0.057, 0.025]);
      ellipsoid(irisGroup, pupil, [0, 0, 0.019], [0.029, 0.036, 0.018]);
      ellipsoid(
        irisGroup,
        glint,
        [-0.012, 0.018, 0.034],
        [0.012, 0.012, 0.008],
      );
      (eye as THREE.Group & { irisGroup?: THREE.Group }).irisGroup = irisGroup;
      eyeGroups.push({ group: eye, side });

      const browCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.1, 0.268, 0.44),
        new THREE.Vector3(side * 0.22, 0.3, 0.457),
        new THREE.Vector3(side * 0.34, 0.275, 0.43),
      ]);
      const brow = new THREE.Mesh(
        ownGeometry(new THREE.TubeGeometry(browCurve, 16, 0.034, 8, false)),
        hairSoft,
      );
      headPivot.add(brow);
    }

    // A layered curl silhouette creates volume and a swept front quiff.
    ellipsoid(headPivot, hair, [0, 0.55, -0.015], [0.635, 0.42, 0.535]);
    ellipsoid(headPivot, hair, [-0.35, 0.42, 0.16], [0.31, 0.27, 0.4]);
    ellipsoid(headPivot, hair, [0.38, 0.43, 0.12], [0.3, 0.29, 0.37]);
    const quiff = ellipsoid(
      headPivot,
      hair,
      [0.11, 0.73, 0.29],
      [0.43, 0.29, 0.39],
    );
    quiff.rotation.z = -0.24;
    ellipsoid(headPivot, hairSoft, [-0.19, 0.77, 0.16], [0.29, 0.22, 0.34]);
    tube(
      headPivot,
      [
        new THREE.Vector3(-0.39, 0.69, 0.41),
        new THREE.Vector3(-0.18, 0.84, 0.43),
        new THREE.Vector3(0.13, 0.91, 0.4),
        new THREE.Vector3(0.4, 0.77, 0.35),
      ],
      0.014,
      hairSoft,
    );

    // Over-ear headphones: a padded arch, hinges, cobalt cups, and cyan rings.
    const bandCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.59, 0.02, -0.02),
      new THREE.Vector3(-0.57, 0.54, -0.06),
      new THREE.Vector3(-0.36, 0.91, -0.05),
      new THREE.Vector3(0, 1.04, -0.03),
      new THREE.Vector3(0.36, 0.91, -0.05),
      new THREE.Vector3(0.57, 0.54, -0.06),
      new THREE.Vector3(0.59, 0.02, -0.02),
    ]);
    headPivot.add(
      new THREE.Mesh(
        ownGeometry(new THREE.TubeGeometry(bandCurve, 44, 0.062, 12, false)),
        headphone,
      ),
    );
    for (const side of [-1, 1] as const) {
      const cup = new THREE.Mesh(
        ownGeometry(new THREE.CylinderGeometry(0.19, 0.19, 0.15, 32)),
        headphone,
      );
      cup.rotation.x = Math.PI / 2;
      cup.position.set(side * 0.625, -0.015, 0.06);
      headPivot.add(cup);
      const ring = new THREE.Mesh(
        ownGeometry(new THREE.TorusGeometry(0.153, 0.023, 10, 32)),
        cyan,
      );
      ring.position.set(side * 0.625, -0.015, 0.147);
      headPivot.add(ring);
      ellipsoid(
        headPivot,
        hoodieLight,
        [side * 0.625, -0.015, 0.158],
        [0.105, 0.105, 0.028],
      );
    }

    const thought = new THREE.Group();
    thought.position.set(0.68, 0.65, 0.18);
    headPivot.add(thought);
    ellipsoid(thought, cyan, [0.15, 0.24, 0], [0.17, 0.17, 0.08]);
    ellipsoid(thought, white, [0.15, 0.24, 0.082], [0.13, 0.13, 0.016]);
    const question = new THREE.Shape();
    question.moveTo(0.11, 0.29);
    question.bezierCurveTo(0.09, 0.36, 0.2, 0.38, 0.21, 0.31);
    question.bezierCurveTo(0.22, 0.27, 0.17, 0.25, 0.15, 0.22);
    question.lineTo(0.15, 0.19);
    question.lineTo(0.18, 0.19);
    question.lineTo(0.18, 0.21);
    question.bezierCurveTo(0.2, 0.24, 0.26, 0.27, 0.25, 0.32);
    question.bezierCurveTo(0.24, 0.41, 0.12, 0.42, 0.1, 0.34);
    question.closePath();
    const questionMark = new THREE.Mesh(
      ownGeometry(new THREE.ShapeGeometry(question, 16)),
      headphone,
    );
    questionMark.position.z = 0.102;
    thought.add(questionMark);
    ellipsoid(thought, headphone, [0.176, 0.155, 0.11], [0.023, 0.023, 0.018]);
    ellipsoid(thought, cyan, [0.015, 0.01, 0.02], [0.048, 0.048, 0.035]);
    ellipsoid(
      thought,
      hoodieLight,
      [-0.105, -0.11, 0.01],
      [0.034, 0.034, 0.028],
    );

    const loading = new THREE.Group();
    loading.position.set(0.88, 2.65, 0.54);
    actor.add(loading);
    const loadingDots: THREE.Mesh[] = [];
    for (let index = 0; index < 3; index += 1) {
      const dot = new THREE.Mesh(
        ownGeometry(new THREE.SphereGeometry(0.055, 16, 12)),
        index === 1 ? white : cyan,
      );
      const angle = (index / 3) * Math.PI * 2;
      dot.position.set(Math.cos(angle) * 0.18, Math.sin(angle) * 0.18, 0);
      loading.add(dot);
      loadingDots.push(dot);
    }

    const celebration = new THREE.Group();
    actor.add(celebration);
    const sparklePositions: Array<[number, number, number]> = [
      [-1.06, 3.35, 0.12],
      [1.08, 3.77, 0.06],
      [0.9, 2.25, 0.25],
    ];
    sparklePositions.forEach((position, index) => {
      const star = new THREE.Mesh(
        ownGeometry(
          new THREE.OctahedronGeometry(index === 1 ? 0.105 : 0.075, 0),
        ),
        index === 1 ? gold : cyan,
      );
      star.position.set(...position);
      celebration.add(star);
    });

    const rendererOptions = renderer as THREE.WebGLRenderer;
    rendererOptions.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    rendererOptions.outputColorSpace = THREE.SRGBColorSpace;
    rendererOptions.toneMapping = THREE.ACESFilmicToneMapping;
    rendererOptions.toneMappingExposure = 1.18;
    rendererOptions.setClearColor(0x000000, 0);
    rendererOptions.domElement.className = styles.canvas;
    rendererOptions.domElement.setAttribute("aria-hidden", "true");
    stage.appendChild(rendererOptions.domElement);
    stage.dataset.rendererReady = "true";

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduce = reducedMotion.matches;
    let animationFrame = 0;
    let previous = 0;
    let nextBlink = 2.8;
    let blinkStart = -1;
    const clock = new THREE.Clock();

    function resize() {
      const currentStage = stageRef.current;
      if (!currentStage) return;
      const width = Math.max(1, currentStage.clientWidth);
      const height = Math.max(1, currentStage.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      rendererOptions.setSize(width, height, false);
      rendererOptions.render(scene, camera);
    }
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(stage);
    resize();

    function handleMotionPreference(event: MediaQueryListEvent) {
      reduce = event.matches;
      if (reduce) pointer.current.set(0, 0);
    }
    reducedMotion.addEventListener("change", handleMotionPreference);

    const ease = (current: number, target: number, amount: number) =>
      current + (target - current) * amount;

    function renderFrame(now: number) {
      animationFrame = window.requestAnimationFrame(renderFrame);
      if (document.visibilityState === "hidden") return;
      const time = clock.getElapsedTime();
      const delta =
        previous === 0 ? 1 / 60 : Math.min(0.06, (now - previous) / 1000);
      previous = now;
      const stateNow = stateRef.current;
      const pose = poses[stateNow];
      const blend = reduce ? 1 : 1 - Math.exp(-delta * 6.5);
      const calm = reduce ? 0 : 1;
      const sway = Math.sin(time * 1.35) * 0.012 * calm;

      actor.position.y = ease(actor.position.y, sway, blend);
      torso.rotation.z = ease(
        torso.rotation.z,
        pose.torsoRoll + sway * 0.5,
        blend,
      );
      headPivot.rotation.x = ease(
        headPivot.rotation.x,
        pose.headPitch +
          pointer.current.y * 0.09 -
          (focusedRef.current ? 0.025 : 0),
        blend,
      );
      headPivot.rotation.y = ease(
        headPivot.rotation.y,
        pose.headYaw +
          pointer.current.x * 0.16 +
          (focusedRef.current ? -0.07 : 0),
        blend,
      );
      headPivot.rotation.z = ease(headPivot.rotation.z, pose.headRoll, blend);
      leftArm.shoulder.rotation.z = ease(
        leftArm.shoulder.rotation.z,
        pose.leftShoulder +
          (stateNow === "unavailable"
            ? Math.sin(time * 2.8) * 0.035 * calm
            : 0),
        blend,
      );
      leftArm.shoulder.position.z = ease(
        leftArm.shoulder.position.z,
        stateNow === "thinking" ? 0.5 : 0.01,
        blend,
      );
      leftArm.elbow.rotation.z = ease(
        leftArm.elbow.rotation.z,
        pose.leftElbow,
        blend,
      );
      leftArm.wrist.rotation.z = ease(
        leftArm.wrist.rotation.z,
        pose.leftWrist,
        blend,
      );

      const wave =
        stateNow === "welcome"
          ? Math.sin(time * 5.2) * 0.26 * calm
          : stateNow === "success"
            ? Math.sin(time * 4.2) * 0.17 * calm
            : 0;
      rightArm.shoulder.rotation.z = ease(
        rightArm.shoulder.rotation.z,
        pose.rightShoulder,
        blend,
      );
      rightArm.elbow.rotation.z = ease(
        rightArm.elbow.rotation.z,
        pose.rightElbow,
        blend,
      );
      rightArm.wrist.rotation.z = ease(
        rightArm.wrist.rotation.z,
        pose.rightWrist + wave,
        blend,
      );

      loading.visible = stateNow === "checking";
      loading.rotation.z = reduce ? 0.55 : time * 1.8;
      loadingDots.forEach((dot, index) => {
        dot.scale.setScalar(
          0.82 + Math.sin(time * 4 + index * 1.8) * 0.16 * calm,
        );
      });
      thought.visible = stateNow === "thinking";
      celebration.visible = stateNow === "success";
      celebration.rotation.z = reduce ? 0 : Math.sin(time * 2.2) * 0.055;
      celebration.children.forEach((star, index) => {
        star.rotation.y = reduce
          ? 0.35
          : time * (index % 2 === 0 ? 0.8 : -0.65);
        star.position.y =
          sparklePositions[index][1] +
          Math.sin(time * 2.2 + index) * 0.06 * calm;
      });

      if (!reduce && time > nextBlink) {
        blinkStart = time;
        nextBlink = time + 2.6 + Math.random() * 2.8;
      }
      const blinkAge = blinkStart < 0 ? 99 : time - blinkStart;
      const blink =
        blinkAge < 0.16 ? 1 - Math.sin((blinkAge / 0.16) * Math.PI) * 0.93 : 1;
      eyeGroups.forEach(({ group, side }) => {
        group.scale.y = reduce ? 1 : Math.max(0.08, blink);
        const irisGroup = (group as THREE.Group & { irisGroup?: THREE.Group })
          .irisGroup;
        if (irisGroup) {
          irisGroup.position.x = pointer.current.x * 0.03;
          irisGroup.position.y =
            -0.002 +
            pointer.current.y * 0.022 +
            (focusedRef.current ? 0.008 : 0);
        }
        group.position.x = side * 0.22;
      });
      rendererOptions.render(scene, camera);
    }

    animationFrame = window.requestAnimationFrame(renderFrame);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      reducedMotion.removeEventListener("change", handleMotionPreference);
      if (rendererOptions.domElement.parentElement === stage) {
        stage.removeChild(rendererOptions.domElement);
      }
      delete stage.dataset.rendererReady;
      geometries.forEach((value) => value.dispose());
      materials.forEach((value) => value.dispose());
      rendererOptions.dispose();
    };
  }, []);

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / Math.max(1, bounds.width);
    const y = (event.clientY - bounds.top) / Math.max(1, bounds.height);
    pointer.current.set(
      clamp((x - 0.5) * 2, -1, 1),
      clamp((0.55 - y) * 2, -1, 1),
    );
  }

  const classNames = [styles.stage, className].filter(Boolean).join(" ");

  return (
    <div
      ref={stageRef}
      className={classNames}
      data-state={state}
      data-focused={focused || undefined}
      aria-hidden="true"
      onPointerMove={handlePointerMove}
      onPointerLeave={() => pointer.current.set(0, 0)}
    >
      <span className={styles.aura} />
      <span className={styles.orbit} />
      <FallbackCharacter state={state} />
    </div>
  );
}
