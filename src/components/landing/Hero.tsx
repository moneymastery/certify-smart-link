import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Award } from "lucide-react";

const Hero = () => {
  return (
    <section className="section-padding pt-32 pb-24 flex flex-col items-center text-center">
      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-4 py-1.5 text-xs font-medium text-muted-foreground mb-8 animate-fade-in">
        <Award className="h-3.5 w-3.5 text-accent" />
        Certificate Generation & Verification Platform
      </div>

      <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground max-w-3xl leading-tight animate-fade-up">
        Create, Issue & Verify
        <br />
        <span className="text-gradient">Certificates at Scale</span>
      </h1>

      <p className="mt-6 text-lg text-muted-foreground max-w-xl leading-relaxed animate-fade-up" style={{ animationDelay: '0.1s' }}>
        Upload your template, map fields, generate bulk certificates with unique QR codes — and let anyone verify authenticity instantly.
      </p>

      <div className="flex flex-col sm:flex-row gap-4 mt-10 animate-fade-up" style={{ animationDelay: '0.2s' }}>
        <Button variant="hero" size="xl" asChild>
          <Link to="/dashboard">
            Start Creating
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button variant="hero-outline" size="xl" asChild>
          <Link to="/verify">Verify a Certificate</Link>
        </Button>
      </div>

      <div className="mt-16 w-full max-w-4xl animate-fade-up" style={{ animationDelay: '0.3s' }}>
        <div className="rounded-xl border border-border bg-card p-2 shadow-lg">
          <div className="rounded-lg bg-muted aspect-video flex items-center justify-center">
            <div className="text-center space-y-3">
              <Award className="h-16 w-16 text-accent mx-auto opacity-40" />
              <p className="text-sm text-muted-foreground">Certificate Preview</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
