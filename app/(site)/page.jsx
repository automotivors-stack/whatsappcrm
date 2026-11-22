// Landing pública da Let's Touch Base. (GET "/" liberado no proxy.js; não lê banco nem dados do CRM).
// Hero, problema, pilares, "o que muda", plataforma (prévia) e, por último, o formulário de diagnóstico.

import LandingHeader from "../../components/landing/LandingHeader.jsx";
import CinematicHero from "../../components/landing/CinematicHero.jsx";
import ProblemaNarrativa from "../../components/landing/ProblemaNarrativa.jsx";
import PilaresRoda from "../../components/landing/PilaresRoda.jsx";
import OperacaoParede from "../../components/landing/OperacaoParede.jsx";
import ProximasEtapas from "../../components/landing/ProximasEtapas.jsx";
import FormularioDiagnostico from "../../components/landing/FormularioDiagnostico.jsx";
import SobreExpressao from "../../components/landing/SobreExpressao.jsx";
import RodapeLanding from "../../components/landing/RodapeLanding.jsx";
import WhatsAppFlutuante from "../../components/landing/WhatsAppFlutuante.jsx";

export const metadata = {
  title: "Let's Touch Base. · Intelligent Sales Workspace",
  description:
    "Plataforma de inteligência comercial que transforma conversas em oportunidades: IA no WhatsApp, aprovação humana, pipeline, precificação e analytics.",
  openGraph: {
    title: "Let's Touch Base. · Intelligent Sales Workspace",
    description: "Every conversation moves business forward.",
    type: "website",
    locale: "pt_BR",
  },
};

export default function Inicio() {
  return (
    <>
      <LandingHeader />
      <main>
        <CinematicHero />
        <ProblemaNarrativa />
        <PilaresRoda />
        <OperacaoParede />
        <ProximasEtapas />
        <FormularioDiagnostico />
      </main>
      <SobreExpressao />
      <RodapeLanding />
      <WhatsAppFlutuante />
    </>
  );
}
