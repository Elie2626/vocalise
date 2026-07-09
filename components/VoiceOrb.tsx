"use client";

import { useRef, useMemo, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { MeshDistortMaterial, Float, Environment } from "@react-three/drei";
import * as THREE from "three";

function Orb() {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<React.ComponentRef<typeof MeshDistortMaterial>>(null);
  const { pointer } = useThree();

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    // Pulsation façon onde vocale.
    const pulse = 1 + Math.sin(t * 1.6) * 0.05;
    if (meshRef.current) {
      meshRef.current.scale.setScalar(pulse);
      // Parallaxe douce vers le pointeur.
      meshRef.current.rotation.y = THREE.MathUtils.lerp(
        meshRef.current.rotation.y,
        pointer.x * 0.5,
        0.05
      );
      meshRef.current.rotation.x = THREE.MathUtils.lerp(
        meshRef.current.rotation.x,
        -pointer.y * 0.4,
        0.05
      );
    }
    if (matRef.current) {
      // La distorsion respire pour un effet "matière vivante".
      matRef.current.distort = 0.35 + Math.sin(t * 1.2) * 0.12;
    }
  });

  return (
    <Float speed={1.4} rotationIntensity={0.4} floatIntensity={0.7}>
      <mesh ref={meshRef} castShadow>
        <sphereGeometry args={[1.25, 128, 128]} />
        <MeshDistortMaterial
          ref={matRef}
          color="#0a5a42"
          emissive="#072a20"
          emissiveIntensity={0.35}
          roughness={0.28}
          metalness={0.6}
          distort={0.4}
          speed={1.8}
        />
      </mesh>
    </Float>
  );
}

function Rings() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.z = state.clock.getElapsedTime() * 0.12;
    }
  });
  return (
    <group ref={groupRef} rotation={[Math.PI / 2.6, 0, 0]}>
      {[1.95, 2.35, 2.8].map((r, i) => (
        <mesh key={r} rotation={[0, 0, i * 0.4]}>
          <torusGeometry args={[r, 0.008, 16, 128]} />
          <meshBasicMaterial color={i % 2 ? "#46c8f5" : "#35e0a1"} transparent opacity={0.25} />
        </mesh>
      ))}
    </group>
  );
}

export function VoiceOrb() {
  const dpr = useMemo<[number, number]>(() => [1, 2], []);
  return (
    <Canvas
      dpr={dpr}
      camera={{ position: [0, 0, 6.2], fov: 45 }}
      gl={{ antialias: true, alpha: true }}
      aria-hidden
      className="!absolute inset-0"
    >
      <Suspense fallback={null}>
        <ambientLight intensity={0.5} />
        <pointLight position={[4, 4, 4]} intensity={40} color="#35e0a1" />
        <pointLight position={[-4, -2, 2]} intensity={30} color="#46c8f5" />
        <Orb />
        <Rings />
        <Environment preset="city" />
      </Suspense>
    </Canvas>
  );
}

export default VoiceOrb;
