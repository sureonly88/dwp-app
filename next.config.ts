import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output: menghasilkan bundle minimal untuk deployment Docker.
  // Server.js + node_modules yang dipakai saja — tidak perlu npm install di production.
  output: "standalone",

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Cegah MIME-type sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Cegah clickjacking
          { key: "X-Frame-Options", value: "DENY" },
          // Referrer policy yang aman
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Paksa HTTPS setelah first visit (1 tahun)
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          // Nonaktifkan browser feature yang tidak dipakai
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // CSP: allow Google Fonts (Material Symbols) dan Next.js inline scripts
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",   // unsafe-eval diperlukan Next.js dev HMR; di prod bisa diperketat
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob:",                        // data: untuk base64 foto presensi tamu
              "connect-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
