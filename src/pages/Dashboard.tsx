import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  LayoutDashboard,
  Upload,
  FileText,
  QrCode,
  Settings,
  ShieldCheck,
  Plus,
  BarChart3,
  Award,
  Download,
  Eye,
  LogOut,
  Palette,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const sidebarItems = [
  { icon: LayoutDashboard, label: "Overview" },
  { icon: FileText, label: "Certificates" },
  { icon: BarChart3, label: "Batches" },
];

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const [activeItem, setActiveItem] = useState("Overview");
  const [stats, setStats] = useState({ templates: 0, certificates: 0, verifications: 0, batches: 0 });
  const [certificates, setCertificates] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (!user) return;

      // Get org
      const { data: orgs } = await supabase.from("organizations").select("id").limit(1);
      const orgId = orgs?.[0]?.id;
      if (!orgId) return;

      // Stats
      const [tempRes, certRes, batchRes, verifRes] = await Promise.all([
        supabase.from("templates").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
        supabase.from("certificates").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
        supabase.from("certificate_batches").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
        supabase.from("certificate_verifications").select("id", { count: "exact", head: true }),
      ]);

      setStats({
        templates: tempRes.count || 0,
        certificates: certRes.count || 0,
        batches: batchRes.count || 0,
        verifications: verifRes.count || 0,
      });

      // Recent certificates
      const { data: certs } = await supabase
        .from("certificates")
        .select("id, serial_number, recipient_name, status, issued_at, pdf_url, verification_token")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (certs) setCertificates(certs);

      // Batches
      const { data: batchData } = await supabase
        .from("certificate_batches")
        .select("id, name, status, total_count, generated_count, created_at")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (batchData) setBatches(batchData);
    };
    load();
  }, []);

  const statCards = [
    { label: "Templates", value: stats.templates, icon: Upload },
    { label: "Certificates", value: stats.certificates, icon: Award },
    { label: "Verifications", value: stats.verifications, icon: QrCode },
    { label: "Batches", value: stats.batches, icon: FileText },
  ];

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <ShieldCheck className="h-12 w-12 text-accent mx-auto" />
          <h2 className="font-heading text-xl font-bold text-foreground">Please sign in</h2>
          <Button variant="hero" asChild><Link to="/login">Sign In</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-card">
        <div className="h-16 flex items-center gap-2 px-6 border-b border-border">
          <ShieldCheck className="h-5 w-5 text-accent" />
          <span className="font-heading text-lg font-semibold text-foreground">CertifyPro</span>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {sidebarItems.map((item) => (
            <button
              key={item.label}
              onClick={() => setActiveItem(item.label)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                activeItem === item.label
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-border">
          <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" asChild>
            <Link to="/">← Back to Home</Link>
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <header className="h-16 border-b border-border flex items-center justify-between px-6">
          <h1 className="font-heading text-xl font-semibold text-foreground">{activeItem}</h1>
          <Button variant="hero" size="sm" asChild>
            <Link to="/generate">
              <Plus className="h-4 w-4" />
              Generate Certificates
            </Link>
          </Button>
        </header>

        <div className="p-6 space-y-8">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((stat) => (
              <div key={stat.label} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{stat.label}</span>
                  <stat.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="mt-2 text-2xl font-heading font-bold text-foreground">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Certificates tab or Overview */}
          {(activeItem === "Overview" || activeItem === "Certificates") && (
            <>
              {certificates.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-muted/30 p-16 text-center">
                  <Award className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                  <h3 className="font-heading text-lg font-semibold text-foreground">No certificates yet</h3>
                  <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
                    Upload a CSV and generate your first batch of certificates.
                  </p>
                  <Button variant="hero" size="default" className="mt-6" asChild>
                    <Link to="/generate">
                      <Upload className="h-4 w-4" />
                      Generate Certificates
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="bg-muted px-4 py-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">Recent Certificates</span>
                    <span className="text-xs text-muted-foreground">{certificates.length} shown</span>
                  </div>
                  <div className="divide-y divide-border">
                    {certificates.map((cert) => (
                      <div key={cert.id} className="px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{cert.recipient_name}</p>
                          <p className="text-xs text-muted-foreground">{cert.serial_number}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium capitalize ${
                            cert.status === "active" ? "text-success" : "text-destructive"
                          }`}>
                            {cert.status}
                          </span>
                          {cert.pdf_url && (
                            <a href={cert.pdf_url} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                            </a>
                          )}
                          <Link to={`/verify/${cert.verification_token}`}>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Batches tab */}
          {activeItem === "Batches" && (
            <>
              {batches.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-muted/30 p-16 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                  <h3 className="font-heading text-lg font-semibold text-foreground">No batches yet</h3>
                  <Button variant="hero" className="mt-6" asChild>
                    <Link to="/generate">Create First Batch</Link>
                  </Button>
                </div>
              ) : (
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="bg-muted px-4 py-3">
                    <span className="text-sm font-medium text-foreground">Certificate Batches</span>
                  </div>
                  <div className="divide-y divide-border">
                    {batches.map((batch) => (
                      <div key={batch.id} className="px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">{batch.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {batch.generated_count}/{batch.total_count} generated · {new Date(batch.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <span className={`text-xs font-medium capitalize rounded-full px-2 py-0.5 ${
                          batch.status === "completed" ? "bg-accent/10 text-accent" :
                          batch.status === "processing" ? "bg-warning/10 text-warning" :
                          batch.status === "failed" ? "bg-destructive/10 text-destructive" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {batch.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
