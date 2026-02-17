import Header from '@/components/landing-page/Header';
import Hero from '@/components/landing-page/Hero';
import ProblemSolution from '@/components/landing-page/ProblemSolution';
import Features from '@/components/landing-page/Features';
import Testimonials from '@/components/landing-page/Testimonials';
import Pricing from '@/components/landing-page/Pricing';
import FAQ from '@/components/landing-page/FAQ';
import Footer from '@/components/landing-page/Footer';

export default function LandingPage() {
  return (
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
  );
}
