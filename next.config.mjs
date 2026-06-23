/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdfkit/docx are server-only; keep them external to the server bundle.
  serverExternalPackages: ["pdfkit", "docx"],
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
