const stats = [
  { value: "50,000+", label: "Certificates Generated" },
  { value: "200+", label: "Organizations" },
  { value: "99.9%", label: "Verification Uptime" },
  { value: "<2s", label: "Avg Verification Time" },
];

const Stats = () => {
  return (
    <section className="section-padding py-16 border-y border-border bg-card">
      <div className="container mx-auto">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="font-heading text-3xl lg:text-4xl font-bold text-gradient">
                {s.value}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Stats;
