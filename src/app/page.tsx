'use client';

import dynamic from 'next/dynamic';


// Dynamically import the Map component to avoid SSR issues with Leaflet
const Map = dynamic(
  () => import('@/components/Map/Map').then((mod) => mod.Map),
  { ssr: false }
);

export default function Home() {
  return (
    <main className="w-full h-screen">
      {/* Search removed from home page */}
      <Map />
    </main>
  );
}
