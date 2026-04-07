import { Upload, Layers, FileDown, QrCode, Shield, Users } from "lucide-react";

const features = [
  {
    icon: Upload,
    title: "Template Upload",
    description: "Upload your certificate background, logo, signature, and seal. Supports PDF and image formats.",
  },
  {
    icon: Layers,
    title: "Field Mapping",
    description: "Place dynamic fields — name, course, date, certificate ID — exactly where you want them on the template.",
  },
  {
    icon: FileDown,
    title: "Bulk Generation",
    description: "Upload a CSV with recipient data and generate hundreds of personalized certificates in seconds.",
  },
  {
    icon: QrCode,
    title: "QR Verification",
    description: "Each certificate gets a unique QR code linking to a verification page with holder details and status.",
  },
  {
    icon: Shield,
    title: "Tamper-Proof",
    description: "Unique serial numbers and verification tokens ensure every certificate can be authenticated.",
  },
  {
    icon: Users,
    title: "Organization Dashboard",
    description: "Track issued certificates, verification activity, and manage your team — all from one place.",
  },
];

const Features = () => {
  return (
    <section id="features" className="section-padding bg-secondary/50">
      <div className="container mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-heading text-3xl lg:text-4xl font-bold text-foreground">
            Everything You Need
          </h2>
          <p className="mt-4 text-muted-foreground max-w-lg mx-auto">
            From template design to bulk generation and real-time verification — a complete certificate workflow.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="card-hover rounded-xl border border-border bg-card p-6">
              <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                <f.icon className="h-5 w-5 text-accent" />
              </div>
              <h3 className="font-heading text-lg font-semibold text-foreground">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
