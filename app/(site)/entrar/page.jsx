// Login da área do cliente (público no proxy.js; não lê dados do CRM).
import { Moldura } from "../../../components/cliente/Moldura.jsx";
import FormularioEntrar from "../../../components/cliente/FormularioEntrar.jsx";
import { googleConfigurado } from "../../../lib/auth.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Entrar · Let's Touch Base.", robots: { index: false } };

export default async function Entrar({ searchParams }) {
  const { erro } = await searchParams;
  const erroInicial = erro === "google" ? "Não foi possível entrar com o Google. Tente de novo ou use e-mail e senha." : "";
  return (
    <Moldura>
      <FormularioEntrar googleAtivo={googleConfigurado()} erroInicial={erroInicial} />
    </Moldura>
  );
}
