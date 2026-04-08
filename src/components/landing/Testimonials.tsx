import { Star } from "lucide-react";

const testimonials = [
  {
    quote: "CertifyPro cut our certificate issuance time from 3 days to 15 minutes. The QR verification gives our graduates instant proof.",
    name: "Dr. Priya Sharma",
    role: "Director of Academics",
    org: "National Institute of Digital Skills",
    stars: 5,
  },
  {
    quote: "We issue 10,000+ certificates per year. The bulk generation and branded verification page make us look professional without a dedicated IT team.",
    name: "Rajesh Mehta",
    role: "CEO",
    org: "LearnIndia EdTech",
    stars: 5,
  },
  {
    quote: "Employers can scan the QR and instantly verify our students' credentials. It has massively improved trust in our certifications.",
    name: "Sarah Chen",
    role: "Program Manager",
    org: "Asia Pacific Training Academy",
    stars: 5,
  },
];

const Testimonials = () => {
  return (
    <section id="testimonials" className="section-padding bg-secondary/50">
      <div className="container mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-heading text-3xl lg:text-4xl font-bold text-foreground">
            Trusted by Educators & Organizations
          </h2>
          <p className="mt-4 text-muted-foreground max-w-lg mx-auto">
            See how institutions use CertifyPro to issue verified, tamper-proof certificates at scale.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="card-hover rounded-xl border border-border bg-card p-6 flex flex-col"
            >
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: t.stars }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-accent text-accent" />
                ))}
              </div>
              <blockquote className="text-sm text-foreground leading-relaxed flex-1">
                "{t.quote}"
              </blockquote>
              <div className="mt-6 pt-4 border-t border-border">
                <p className="text-sm font-semibold text-foreground">{t.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t.role}, {t.org}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
