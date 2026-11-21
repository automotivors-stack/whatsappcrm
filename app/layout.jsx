import "./globals.css";
import NavegacaoPrincipal from "../components/NavegacaoPrincipal.jsx";

export const metadata = {
  title: "CRM Meios de Pagamento",
  description: "Pipeline de leads de consultoria em meios de pagamento",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">
        <NavegacaoPrincipal />
        {children}
      </body>
    </html>
  );
}
