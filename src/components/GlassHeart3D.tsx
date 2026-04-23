/*
 * 3D beating glass anatomical heart + chrome spine model.
 * Heart: glass refraction at 72 BPM, dominant at center.
 * Spines: loads spines.glb, mirror-chrome material, slow Y rotation.
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
          reflectivity: 0.6,
          envMapIntensity: 4.5,
          transparent: true,
          opacity: 0.72,
          attenuationColor: new THREE.Color("#7755ff"),
          attenuationDistance: 0.8,
          side: THREE.DoubleSide,
        });
        mesh.material = mat;
        mesh.renderOrder = 2;
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

    group.scale.set(1.92 * s, 1.92 * s, 1.92 * s);
    group.position.y = Math.sin(t * ((2 * Math.PI) / 3)) * 0.05;

    if (!paused) {
      rotationY.current += 0.003;
    }
    group.rotation.y = rotationY.current;
  });

  return (
    <group ref={groupRef} scale={1.92}>
      <group rotation={[0.2, 0, 0]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
}

function HeartLight() {
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    const light = lightRef.current;
    if (!light) return;

    const t = state.clock.elapsedTime;
    const phase = (t % CYCLE_DURATION) / CYCLE_DURATION;

    let intensity = 0.4;
    if (phase < 0.08) {
      intensity = 0.4 + 4.6 * Math.sin((phase / 0.08) * Math.PI * 0.5);
    } else if (phase < 0.14) {
      intensity = 5 - 3.5 * ((phase - 0.08) / 0.06);
    } else if (phase < 0.18) {
      intensity = 1.5;
    } else if (phase < 0.25) {
      intensity = 1.5 + 2 * Math.sin(((phase - 0.18) / 0.07) * Math.PI * 0.5);
    } else if (phase < 0.30) {
      intensity = 3.5 - 3.1 * ((phase - 0.25) / 0.05);
    }

    light.intensity = intensity;
  });

  return (
    <pointLight
      ref={lightRef}
      position={[0, 0.2, 0]}
      intensity={0.4}
      color="#00e5ff"
      distance={10}
      decay={2}
    />
  );
}

function Spines() {
  const groupRef = useRef<THREE.Group>(null);
  const rotationY = useRef(0);
  const gltf = useGLTF("/spines.glb");

  useEffect(() => {
    console.log('spines mesh count:', gltf.scene.children.length);
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
          color: new THREE.Color("#e8f0ff"),
          metalness: 1.0,
          roughness: 0.25,
          envMapIntensity: 1.5,
          polygonOffset: true,
          polygonOffsetFactor: -1,
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

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;
    rotationY.current += 0.0003;
    group.rotation.y = rotationY.current;
  });

  return (
    <group ref={groupRef} position={[0, 0, -1]} scale={[1.1, 1.1, 1.1]}>
      <primitive object={clonedScene} />
    </group>
  );
}

useGLTF.preload("/heart.glb");
useGLTF.preload("/spines.glb");

export default function GlassHeart3D() {
  const [hovered, setHovered] = useState(false);

  return (
    <Canvas
      camera={{ position: [0, 0, 6], fov: 75 }}
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
        <ambientLight color="#1a0a3a" intensity={0.8} />
        <directionalLight position={[5, 8, 5]} color="#8866ff" intensity={3} />
        <directionalLight position={[-5, -3, -5]} color="#4433aa" intensity={1.5} />
        <pointLight position={[3, 3, 4]} intensity={5} color="#90c8ff" />
        <pointLight position={[-3, -2, 3]} intensity={3} color="#b4e6ff" />
        <pointLight position={[0, 0, 3]} intensity={5} color="#6644ff" />
        <pointLight position={[0, 2, -2]} intensity={2} color="#4422dd" />
        <HeartLight />
        <Heart paused={hovered} />
        <Spines />
      </Suspense>
    </Canvas>
  );
}
