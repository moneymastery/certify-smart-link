const steps = [
  { step: "01", title: "Upload Template", description: "Upload your certificate background image or PDF, along with your logo and signature." },
  { step: "02", title: "Map Fields", description: "Define where recipient name, date, certificate ID, and other fields appear on the template." },
  { step: "03", title: "Import Data", description: "Upload a CSV with recipient details or enter them one by one for single certificates." },
  { step: "04", title: "Generate & Share", description: "Generate certificates with unique QR codes. Download PDFs or send them via email." },
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="section-padding">
      <div className="container mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-heading text-3xl lg:text-4xl font-bold text-foreground">
            How It Works
          </h2>
          <p className="mt-4 text-muted-foreground max-w-lg mx-auto">
            Four simple steps from template to verified certificate.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((s, i) => (
            <div key={s.step} className="relative">
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-8 left-full w-full h-px bg-border -translate-x-1/2" />
              )}
              <div className="text-4xl font-heading font-bold text-accent/20 mb-3">{s.step}</div>
              <h3 className="font-heading text-lg font-semibold text-foreground">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
