// Área interna do CRM (Kanban, Dashboard). Protegida pelo proxy.js (usuário e senha).
import NavegacaoPrincipal from "../../components/NavegacaoPrincipal.jsx";

export const metadata = {
  title: "CRM · Let's Touch Base.",
  robots: { index: false, follow: false },
};

export default function CrmLayout({ children }) {
  return (
    <>
      <NavegacaoPrincipal />
      {children}
    </>
  );
}
