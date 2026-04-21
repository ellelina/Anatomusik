/*
 * 3D beating glass anatomical heart — loads heart.glb and applies
 * light blue glass refraction material. Lub-dub pulse at 72 BPM.
 * Slow continuous Y-axis rotation, pauses on hover.
 * Fullscreen absolute canvas with transparent background.
 * Usage: <GlassHeart3D /> on the landing page
 */

"use client";

import { Suspense, useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, Environment } from "@react-three/drei";
import * as THREE from "three";

const CYCLE_DURATION = 0.833; // 72 BPM

function ClearBackground() {
  const { scene } = useThree();
  useEffect(() => {
    scene.background = null;
  }, [scene]);
  return null;
}

function Heart({ paused }: { paused: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const rotationY = useRef(0);
  const gltf = useGLTF("/heart.glb");

  useEffect(() => {
    console.log("[GlassHeart3D] GLB loaded from: /heart.glb");
    let meshCount = 0;
    gltf.scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        meshCount++;
        console.log(`[GlassHeart3D] Mesh: "${mesh.name}" — ${mesh.geometry.attributes.position.count} vertices`);
      }
    });
    console.log(`[GlassHeart3D] Total meshes: ${meshCount}`);
  }, [gltf]);

  const { clonedScene, materials, geometries } = useMemo(() => {
    const mats: THREE.Material[] = [];
    const geos: THREE.BufferGeometry[] = [];
    const clone = gltf.scene.clone(true);

    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.material) {
          (mesh.material as THREE.Material).dispose();
        }
        const mat = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color("#dce8ff"),
          transmission: 0.97,
          thickness: 1.2,
          roughness: 0.01,
          metalness: 0,
          ior: 1.5,
          reflectivity: 0.5,
          envMapIntensity: 3,
          transparent: true,
          opacity: 0.6,
          attenuationColor: new THREE.Color("#c8deff"),
          attenuationDistance: 0.6,
          side: THREE.DoubleSide,
        });
        mesh.material = mat;
        mesh.renderOrder = 1;
        mats.push(mat);
        if (mesh.geometry) geos.push(mesh.geometry);
      }
    });

    return { clonedScene: clone, materials: mats, geometries: geos };
  }, [gltf.scene]);

  useEffect(() => {
    return () => {
      materials.forEach((m) => m.dispose());
      geometries.forEach((g) => g.dispose());
    };
  }, [materials, geometries]);

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;

    const t = state.clock.elapsedTime;
    const phase = (t % CYCLE_DURATION) / CYCLE_DURATION;

    // lub-dub scale pulse
    let s = 1;
    if (phase < 0.08) {
      s = 1 + 0.15 * Math.sin((phase / 0.08) * Math.PI * 0.5);
    } else if (phase < 0.14) {
      s = 1.15 - 0.15 * ((phase - 0.08) / 0.06);
    } else if (phase < 0.18) {
      s = 1;
    } else if (phase < 0.25) {
      s = 1 + 0.12 * Math.sin(((phase - 0.18) / 0.07) * Math.PI * 0.5);
    } else if (phase < 0.30) {
      s = 1.12 - 0.12 * ((phase - 0.25) / 0.05);
    }

    group.scale.set(4 * s, 4 * s, 4 * s);

    // Subtle water bobbing — sine wave ±0.05 over 3s
    group.position.y = Math.sin(t * ((2 * Math.PI) / 3)) * 0.05;

    // Slow continuous Y rotation — pause on hover
    if (!paused) {
      rotationY.current += 0.003;
    }
    group.rotation.y = rotationY.current;
  });

  return (
    <group ref={groupRef} scale={4}>
      <group rotation={[0.2, 0, 0]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
}

function Spines() {
  const groupRef = useRef<THREE.Group>(null);
  const rotationY = useRef(0);
  const gltf = useGLTF("/spines.glb");

  const { clonedScene, materials, geometries } = useMemo(() => {
    const mats: THREE.Material[] = [];
    const geos: THREE.BufferGeometry[] = [];
    const clone = gltf.scene.clone(true);

    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.material) {
          (mesh.material as THREE.Material).dispose();
        }
        const mat = new THREE.MeshStandardMaterial({
          color: new THREE.Color("#b8d4ff"),
          metalness: 1,
          roughness: 0.02,
          envMapIntensity: 2,
        });
        mesh.material = mat;
        mesh.renderOrder = 0;
        mats.push(mat);
        if (mesh.geometry) geos.push(mesh.geometry);
      }
    });

    return { clonedScene: clone, materials: mats, geometries: geos };
  }, [gltf.scene]);

  useEffect(() => {
    return () => {
      materials.forEach((m) => m.dispose());
      geometries.forEach((g) => g.dispose());
    };
  }, [materials, geometries]);

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;

    const t = state.clock.elapsedTime;
    const phase = (t % CYCLE_DURATION) / CYCLE_DURATION;

    // Heartbeat pulse — briefly scale to 1.04 then back over 400ms
    let s = 1;
    if (phase < 0.08) {
      s = 1 + 0.04 * Math.sin((phase / 0.08) * Math.PI * 0.5);
    } else if (phase < 0.08 + 0.4 / 0.833) {
      const fadePhase = (phase - 0.08) / (0.4 / 0.833);
      s = 1.04 - 0.04 * fadePhase;
    }

    group.scale.set(0.4 * s, 0.4 * s, 0.4 * s);

    // Slow counter-clockwise Y rotation
    rotationY.current -= 0.0004;
    group.rotation.y = rotationY.current;
  });

  return (
    <group ref={groupRef} position={[0, 0, -1]} scale={[0.4, 0.4, 0.4]}>
      <primitive object={clonedScene} />
    </group>
  );
}

function Pines() {
  const groupRef = useRef<THREE.Group>(null);
  const rotationY = useRef(0);
  const gltf = useGLTF("/spinal.glb");

  useEffect(() => {
    console.log("[GlassHeart3D] GLB loaded from: /spinal.glb");
    let meshCount = 0;
    gltf.scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        meshCount++;
        console.log(`[Pines] Mesh: "${(child as THREE.Mesh).name}"`);
      }
    });
    console.log(`[Pines] Total meshes: ${meshCount}`);
  }, [gltf]);

  const { clonedScene, materials, geometries } = useMemo(() => {
    const mats: THREE.Material[] = [];
    const geos: THREE.BufferGeometry[] = [];
    const clone = gltf.scene.clone(true);

    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.material) {
          (mesh.material as THREE.Material).dispose();
        }
        const mat = new THREE.MeshStandardMaterial({
          color: new THREE.Color("#b8d4ff"),
          metalness: 1,
          roughness: 0.02,
          envMapIntensity: 2,
        });
        mesh.material = mat;
        mesh.renderOrder = 0;
        mats.push(mat);
        if (mesh.geometry) geos.push(mesh.geometry);
      }
    });

    return { clonedScene: clone, materials: mats, geometries: geos };
  }, [gltf.scene]);

  useEffect(() => {
    return () => {
      materials.forEach((m) => m.dispose());
      geometries.forEach((g) => g.dispose());
    };
  }, [materials, geometries]);

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;

    const t = state.clock.elapsedTime;
    const phase = (t % CYCLE_DURATION) / CYCLE_DURATION;

    // Heartbeat pulse — briefly scale to 1.04 then back over 400ms
    let s = 1;
    if (phase < 0.08) {
      s = 1 + 0.04 * Math.sin((phase / 0.08) * Math.PI * 0.5);
    } else if (phase < 0.08 + 0.4 / 0.833) {
      const fadePhase = (phase - 0.08) / (0.4 / 0.833);
      s = 1.04 - 0.04 * fadePhase;
    }

    group.scale.set(0.4 * s, 0.4 * s, 0.4 * s);

    // Slow clockwise Y rotation
    rotationY.current += 0.0004;
    group.rotation.y = rotationY.current;
  });

  return (
    <group ref={groupRef} position={[0, 0, -1]} scale={[0.4, 0.4, 0.4]}>
      <primitive object={clonedScene} />
    </group>
  );
}

useGLTF.preload("/heart.glb");
useGLTF.preload("/spines.glb");
useGLTF.preload("/spinal.glb");

export default function GlassHeart3D() {
  const [hovered, setHovered] = useState(false);

  return (
    <Canvas
      camera={{ position: [0, 0, 12], fov: 45 }}
      dpr={[1, 2]}
      flat={false}
      gl={{
        alpha: true,
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.0,
      }}
      performance={{ min: 0.5 }}
      style={{
        background: "transparent",
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
      }}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
      }}
    >
      <ClearBackground />
      <Suspense fallback={null}>
        <ambientLight intensity={1.2} />
        <pointLight position={[3, 3, 4]} intensity={5} color="#90c8ff" />
        <pointLight position={[-3, -2, 3]} intensity={3} color="#b4e6ff" />
        <pointLight position={[0, 0, -3]} intensity={2} color="#90c8ff" />
        <pointLight position={[0, 3, 5]} intensity={2.5} color="#dce8ff" />
        <Environment preset="studio" background={false} />
        <Heart paused={hovered} />
        <Spines />
        <Pines />
      </Suspense>
    </Canvas>
  );
}
