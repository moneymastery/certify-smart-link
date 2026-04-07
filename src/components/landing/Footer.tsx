import { ShieldCheck } from "lucide-react";

const Footer = () => {
  return (
    <footer className="border-t border-border bg-secondary/30 section-padding py-12">
      <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-accent" />
          <span className="font-heading text-lg font-semibold text-foreground">CertifyPro</span>
        </div>
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} CertifyPro. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
