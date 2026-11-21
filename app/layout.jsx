import "./globals.css";

export const metadata = {
  title: "Let's Touch Base.",
  description: "Intelligent Sales Workspace",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
