import { TvScreen } from "@/components/TvScreen";

export const metadata = { title: "Patch Hours · TV preview" };

export default function TvPage() {
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}>
      <h1 className="sr">Patch Hours on the TV</h1>
      <TvScreen />
    </main>
  );
}
