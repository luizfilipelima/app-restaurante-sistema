import { useLandingPageContent } from '@/hooks/queries/useLandingPageContent';
import { MainLandingCtx, MAIN_DEFAULTS } from '@/contexts/MainLandingCtx';
import Header from '@/components/landing-page/Header';
import Hero from '@/components/landing-page/Hero';
import ProblemSolution from '@/components/landing-page/ProblemSolution';
import Features from '@/components/landing-page/Features';
import Testimonials from '@/components/landing-page/Testimonials';
import Pricing from '@/components/landing-page/Pricing';
import FAQ from '@/components/landing-page/FAQ';
import Footer from '@/components/landing-page/Footer';

export default function LandingPage() {
  const { data: content = {} } = useLandingPageContent();

  const primaryColor = content.main_colors?.primary_hex ?? MAIN_DEFAULTS.primaryColor;
  const logoUrl      = content.main_colors?.logo_url     ?? MAIN_DEFAULTS.logoUrl;
  const waLink       = content.main_header?.wa_link       ?? MAIN_DEFAULTS.waLink;
  const appLink      = content.main_header?.app_link      ?? MAIN_DEFAULTS.appLink;

  return (
    <MainLandingCtx.Provider value={{ c: content, primaryColor, logoUrl, waLink, appLink }}>
      {/* Injeta a cor primária como CSS variable — usada em inline styles críticos */}
      <style>{`:root { --brand: ${primaryColor}; }`}</style>
      <div className="min-h-screen bg-slate-50 font-sans text-slate-900 overflow-x-hidden">
        <Header />
        <main>
          <Hero />
          <ProblemSolution />
          <Features />
          <Testimonials />
          <Pricing />
          <FAQ />
        </main>
        <Footer />
      </div>
    </MainLandingCtx.Provider>
  );
}
