import { Canvas, useFrame } from '@react-three/fiber'
import { MeshDistortMaterial, Sphere } from '@react-three/drei'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

// 3D-сфера риска: цвет бирюзовый (нет проверки) → зелёный → жёлтый → красный, искажение растёт с риском.
function riskColor(risk: number | null) {
  if (risk === null) return new THREE.Color('#2dd4bf')
  const g = new THREE.Color('#22c55e'), y = new THREE.Color('#facc15'), r = new THREE.Color('#ef4444')
  return risk < 50 ? g.clone().lerp(y, risk / 50) : y.clone().lerp(r, (risk - 50) / 50)
}

function Blob({ risk }: { risk: number | null }) {
  const mat = useRef<any>(null)
  const mesh = useRef<THREE.Mesh>(null)
  const target = useMemo(() => riskColor(risk), [risk])
  const distort = risk === null ? 0.3 : 0.25 + (risk / 100) * 0.4
  const speed = risk === null ? 1.4 : 1.2 + (risk / 100) * 3.5
  useFrame((_, dt) => {
    if (mat.current) {
      mat.current.color.lerp(target, Math.min(1, dt * 3))
      mat.current.distort += (distort - mat.current.distort) * Math.min(1, dt * 2)
      mat.current.speed = speed
    }
    if (mesh.current) mesh.current.rotation.y += dt * 0.15
  })
  return (
    <Sphere ref={mesh} args={[1.35, 128, 128]}>
      <MeshDistortMaterial ref={mat} color="#2dd4bf" roughness={0.15} metalness={0.35} distort={0.3} speed={1.4} />
    </Sphere>
  )
}

export default function Orb({ risk }: { risk: number | null }) {
  return (
    <Canvas camera={{ position: [0, 0, 4.2], fov: 45 }} dpr={[1, 1.75]} gl={{ antialias: true, alpha: true }}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 4, 5]} intensity={2.2} />
      <pointLight position={[-4, -2, 2]} intensity={30} color="#7c3aed" />
      <pointLight position={[4, -3, -2]} intensity={20} color="#22d3ee" />
      <Blob risk={risk} />
    </Canvas>
  )
}
