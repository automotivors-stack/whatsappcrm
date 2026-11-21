// Site público da Let's Touch Base. (landing). Fontes da marca servidas pelo próprio app
// (@fontsource), sem chamada a servidores de terceiros.
import "@fontsource-variable/inter";
import "@fontsource-variable/manrope";

export default function SiteLayout({ children }) {
  return <div className="ltb-site">{children}</div>;
}
