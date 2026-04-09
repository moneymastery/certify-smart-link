import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";

const Footer = () => {
  return (
    <footer className="border-t border-border bg-secondary/30 section-padding py-12">
      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row items-start justify-between gap-8">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-accent" />
            <span className="font-heading text-lg font-semibold text-foreground">CertifyPro</span>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">How It Works</a>
            <a href="#faq" className="text-muted-foreground hover:text-foreground transition-colors">FAQ</a>
            <Link to="/verify" className="text-muted-foreground hover:text-foreground transition-colors">Verify Certificate</Link>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} CertifyPro. All rights reserved.
          </p>
          <div className="flex gap-6 text-xs text-muted-foreground">
            <span>Privacy Policy</span>
            <span>Terms of Service</span>
            <a href="mailto:support@certifypro.app" className="hover:text-foreground transition-colors">Contact</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
