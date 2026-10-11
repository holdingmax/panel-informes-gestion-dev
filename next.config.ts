import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // El default (1MB) corta la carga de BSyS (dos archivos por vez) y los
      // adjuntos: tope de 10MB por archivo y hasta 3 por reclasificación, más
      // el overhead del multipart.
      bodySizeLimit: "32mb",
    },
  },
};

export default nextConfig;
