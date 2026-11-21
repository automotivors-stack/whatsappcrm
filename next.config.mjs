/** @type {import('next').NextConfig} */
const nextConfig = {
  // O cliente do libSQL tem binário nativo: fica fora do bundle do servidor.
  serverExternalPackages: ["@libsql/client", "libsql"],
};

export default nextConfig;
