import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Aksjeinnsikt",
    short_name: "Aksjeinnsikt",
    description: "Hva kunder, ansatte og markedet faktisk mener om selskapene du vurderer.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f7f9",
    theme_color: "#00a160",
    lang: "nb",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
