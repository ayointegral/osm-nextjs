import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "OSM Tile Viewer",
  description: "Interactive OpenStreetMap tile viewer and comparison tool",
};

export default function OsmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
