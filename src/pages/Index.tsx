import { Helmet } from "react-helmet-async";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import Stats from "@/components/landing/Stats";
import Features from "@/components/landing/Features";
import HowItWorks from "@/components/landing/HowItWorks";
import TrustSignals from "@/components/landing/TrustSignals";
import Testimonials from "@/components/landing/Testimonials";
import FAQ from "@/components/landing/FAQ";
import Footer from "@/components/landing/Footer";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "CertifyPro",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "Create, issue, and verify certificates at scale with unique QR codes and instant verification.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.9",
    reviewCount: "200",
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How does QR code verification work?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Each certificate contains a unique QR code. When scanned, it opens a verification page that confirms the certificate's authenticity, holder name, issue date, and status.",
      },
    },
    {
      "@type": "Question",
      name: "Can I customize which details appear on the verification page?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. During certificate generation, you choose exactly which fields from your spreadsheet are visible after scanning.",
      },
    },
    {
      "@type": "Question",
      name: "Is the verification page branded with my organization?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Absolutely. The verification page displays your organization's name and logo for a professional, white-label experience.",
      },
    },
  ],
};

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
        <link rel="canonical" href="https://verify-ease-pro.lovable.app/" />
      </Helmet>
      <Navbar />
      <Hero />
      <Stats />
      <Features />
      <HowItWorks />
      <TrustSignals />
      <Testimonials />
      <FAQ />
      <Footer />
    </div>
  );
};

export default Index;
