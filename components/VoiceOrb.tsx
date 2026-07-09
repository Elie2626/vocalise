"use client";

import { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const BAR_COUNT = 72;
const RING_RADIUS = 2.0;

// Couleurs alignées sur le thème "Aurora sombre" (--color-primary / --color-secondary).
const COLOR_PRIMARY = "#35e0a1";
const COLOR_SECONDARY = "#46c8f5";
const COLOR_EMISSIVE = "#0d3b2c";

// Ajuste la caméra selon le ratio du conteneur : un header étroit et haut
// (mobile, portrait) a besoin de reculer/lever la caméra pour garder
// l'anneau entier dans le cadre, sans quoi il déborde ou se retrouve coupé.
function AdaptiveCamera() {
  const { camera, size } = useThree();

  useEffect(() => {
    const persp = camera as THREE.PerspectiveCamera;
    const aspect = size.width / size.height;

    if (aspect < 0.9) {
      // Très étroit (mobile portrait serré)
      persp.position.set(0, 4.2, 8.6);
      persp.fov = 46;
    } else if (aspect < 1.6) {
      // Mobile / tablette
      persp.position.set(0, 3.4, 7.0);
      persp.fov = 44;
    } else {
      // Desktop, header large
      persp.position.set(0, 2.6, 5.2);
      persp.fov = 40;
    }

    persp.lookAt(0, 0, 0);
    persp.updateProjectionMatrix();
  }, [size.width, size.height, camera]);

  return null;
}

type WaveformRingProps = {
  reactive: boolean;
  analyser: AnalyserNode | null;
};

function WaveformRing({ reactive, analyser }: WaveformRingProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const freqData = useMemo(
    () => (analyser ? new Uint8Array(analyser.frequencyBinCount) : null),
    [analyser]
  );

  const angles = useMemo(() => {
    const arr: number[] = [];
    for (let i = 0; i < BAR_COUNT; i++) {
      arr.push((i / BAR_COUNT) * Math.PI * 2);
    }
    return arr;
  }, []);

  // Dégradé vert -> cyan le long de l'anneau.
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const cA = new THREE.Color(COLOR_PRIMARY);
    const cB = new THREE.Color(COLOR_SECONDARY);
    const tmp = new THREE.Color();
    for (let i = 0; i < BAR_COUNT; i++) {
      tmp.copy(cA).lerp(cB, i / BAR_COUNT);
      mesh.setColorAt(i, tmp);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, []);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = state.clock.getElapsedTime();

    for (let i = 0; i < BAR_COUNT; i++) {
      let amp: number;

      if (reactive && analyser && freqData) {
        analyser.getByteFrequencyData(freqData);
        const bin = Math.floor((i / BAR_COUNT) * freqData.length * 0.7);
        amp = (freqData[bin] / 255) * 1.6;
      } else {
        const envelope = 0.5 + 0.5 * Math.abs(Math.sin(t * 1.2));
        const wave = 0.5 + 0.5 * Math.sin(t * 4 + i * 0.5) * Math.cos(t * 1.6 + i * 0.15);
        amp = wave * envelope;
      }

      const len = 0.18 + amp * 1.1;
      const a = angles[i];
      const x = Math.cos(a) * RING_RADIUS;
      const z = Math.sin(a) * RING_RADIUS;

      dummy.position.set(x, len / 2, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, len, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;

    if (groupRef.current) {
      groupRef.current.rotation.y += 0.0022;
    }
  });

  return (
    <group ref={groupRef}>
      <instancedMesh ref={meshRef} args={[undefined, undefined, BAR_COUNT]}>
        <boxGeometry args={[0.05, 1, 0.05]} />
        <meshStandardMaterial
          roughness={0.3}
          metalness={0.45}
          emissive={COLOR_EMISSIVE}
          emissiveIntensity={0.4}
          toneMapped={false}
        />
      </instancedMesh>

      {/* Fin cercle au sol, sert de socle discret à l'anneau de barres */}
      <mesh rotation-x={-Math.PI / 2}>
        <ringGeometry args={[RING_RADIUS - 0.03, RING_RADIUS + 0.03, 96]} />
        <meshBasicMaterial color="#123d31" transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

type VoiceHeaderOrbProps = {
  /**
   * Si true, demande l'accès au micro et fait réagir les barres à la voix.
   * Par défaut à false : animation ambiante, pas de popup de permission.
   */
  reactive?: boolean;
  className?: string;
};

export function VoiceHeaderOrb({ reactive = false, className }: VoiceHeaderOrbProps) {
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  useEffect(() => {
    if (!reactive) return;
    let audioContext: AudioContext | null = null;
    let stream: MediaStream | null = null;

    async function setup() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(stream);
        const node = audioContext.createAnalyser();
        node.fftSize = 256;
        node.smoothingTimeConstant = 0.75;
        source.connect(node);
        setAnalyser(node);
      } catch {
        // Micro refusé ou indisponible : on reste sur l'animation ambiante.
        setAnalyser(null);
      }
    }
    setup();

    return () => {
      stream?.getTracks().forEach((track) => track.stop());
      audioContext?.close();
    };
  }, [reactive]);

  // Cap le pixel ratio plus bas sur mobile pour rester fluide.
  const dpr = useMemo<[number, number]>(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      return [1, 1.5];
    }
    return [1, 2];
  }, []);

  return (
    <Canvas
      dpr={dpr}
      camera={{ position: [0, 2.6, 5.2], fov: 40 }}
      gl={{ antialias: true, alpha: true }}
      aria-hidden
      className={className ?? "!absolute inset-0"}
      onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
    >
      <AdaptiveCamera />
      <ambientLight intensity={0.55} />
      <pointLight position={[3, 4, 3]} intensity={40} color={COLOR_PRIMARY} />
      <pointLight position={[-3, 2, -2]} intensity={26} color={COLOR_SECONDARY} />
      <WaveformRing reactive={reactive} analyser={analyser} />
    </Canvas>
  );
}

export default VoiceHeaderOrb;
