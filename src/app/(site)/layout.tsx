import Script from "next/script";
import SmoothScroll from "@/components/common/SmoothScroll";
import Nav from "@/components/navigation/Nav";
import Footer from "@/components/footer/Footer";

/** The public site: every page a traveller can reach. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <SmoothScroll>
      <Nav />
      <main id="main">{children}</main>
      <Footer />
      <Script
        src="https://www.kastochhanepal.com/badge-widget.js"
        data-business="Logosa"
        strategy="afterInteractive"
      />
    </SmoothScroll>
  );
}
