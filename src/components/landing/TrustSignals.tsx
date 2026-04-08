import { ShieldCheck, Lock, Globe, Server } from "lucide-react";

const signals = [
  {
    icon: Lock,
    title: "End-to-End Encryption",
    description: "All certificate data is encrypted in transit and at rest.",
  },
  {
    icon: ShieldCheck,
    title: "Tamper-Proof Tokens",
    description: "Cryptographically generated verification tokens prevent forgery.",
  },
  {
    icon: Globe,
    title: "Instant Global Verification",
    description: "Anyone, anywhere can scan and verify a certificate in under 2 seconds.",
  },
  {
    icon: Server,
    title: "99.9% Uptime",
    description: "Built on reliable cloud infrastructure with automatic failover.",
  },
];

const TrustSignals = () => {
  return (
    <section className="section-padding bg-primary text-primary-foreground">
      <div className="container mx-auto">
        <div className="text-center mb-12">
          <h2 className="font-heading text-3xl lg:text-4xl font-bold">
            Enterprise-Grade Security & Trust
          </h2>
          <p className="mt-4 opacity-80 max-w-lg mx-auto">
            Your certificates deserve the highest level of authenticity and protection.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {signals.map((s) => (
            <div
              key={s.title}
              className="rounded-xl border border-primary-foreground/10 bg-primary-foreground/5 p-6 text-center"
            >
              <div className="h-12 w-12 rounded-full bg-primary-foreground/10 flex items-center justify-center mx-auto mb-4">
                <s.icon className="h-6 w-6" />
              </div>
              <h3 className="font-heading text-base font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm opacity-70 leading-relaxed">{s.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrustSignals;
