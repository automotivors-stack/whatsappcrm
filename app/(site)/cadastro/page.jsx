// Cadastro da área do cliente (público no proxy.js; não lê dados do CRM).
import { Moldura } from "../../../components/cliente/Moldura.jsx";
import FormularioCadastro from "../../../components/cliente/FormularioCadastro.jsx";
import { googleConfigurado } from "../../../lib/auth.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Criar conta · Let's Touch Base.", robots: { index: false } };

export default function Cadastro() {
  return (
    <Moldura>
      <FormularioCadastro googleAtivo={googleConfigurado()} />
    </Moldura>
  );
}
