import { Play, Download, FileText } from "lucide-react";
import { useState } from "react";

const steps = [
  { step: "01", title: "Upload Template", description: "Upload your certificate background image or PDF, along with your logo and signature." },
  { step: "02", title: "Map Fields", description: "Define where recipient name, date, certificate ID, and other fields appear on the template." },
  { step: "03", title: "Import Data", description: "Upload a CSV with recipient details or enter them one by one for single certificates." },
  { step: "04", title: "Generate & Share", description: "Generate certificates with unique QR codes. Download PDFs or send them via email." },
];

const HowItWorks = () => {
  const [showVideo, setShowVideo] = useState(false);

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

        {/* Video & Resources Section */}
        <div className="mt-16 space-y-8">
          {/* Video */}
          <div className="rounded-xl overflow-hidden border border-border bg-card shadow-sm">
            {showVideo ? (
              <video
                src="/CertifyPro-Demo.mp4"
                controls
                autoPlay
                className="w-full aspect-video"
              />
            ) : (
              <button
                onClick={() => setShowVideo(true)}
                className="w-full aspect-video bg-gradient-to-br from-primary to-primary/80 flex flex-col items-center justify-center gap-4 cursor-pointer hover:opacity-90 transition-opacity"
              >
                <div className="w-20 h-20 rounded-full bg-accent flex items-center justify-center shadow-lg">
                  <Play className="w-8 h-8 text-accent-foreground ml-1" />
                </div>
                <span className="text-primary-foreground text-lg font-semibold">Watch Demo Video</span>
                <span className="text-primary-foreground/60 text-sm">See CertifyPro in action — 15 seconds</span>
              </button>
            )}
          </div>

          {/* Download links */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/CertifyPro-Overview.pptx"
              download
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-accent text-accent-foreground font-semibold hover:opacity-90 transition-opacity"
            >
              <FileText className="w-5 h-5" />
              Download Presentation (PPTX)
            </a>
            <a
              href="/CertifyPro-Demo.mp4"
              download
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-border bg-card text-foreground font-semibold hover:bg-muted transition-colors"
            >
              <Download className="w-5 h-5" />
              Download Demo Video
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;