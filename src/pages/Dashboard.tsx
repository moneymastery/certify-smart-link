import { useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";

const sidebarItems = [
  { icon: LayoutDashboard, label: "Overview", active: true },
  { icon: Upload, label: "Templates" },
  { icon: FileText, label: "Certificates" },
  { icon: QrCode, label: "Verification" },
  { icon: BarChart3, label: "Analytics" },
  { icon: Settings, label: "Settings" },
];

const stats = [
  { label: "Templates", value: "0", icon: Upload },
  { label: "Certificates Issued", value: "0", icon: Award },
  { label: "Verifications", value: "0", icon: QrCode },
  { label: "Active Batches", value: "0", icon: FileText },
];

const Dashboard = () => {
  const [activeItem, setActiveItem] = useState("Overview");

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
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

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <header className="h-16 border-b border-border flex items-center justify-between px-6">
          <h1 className="font-heading text-xl font-semibold text-foreground">{activeItem}</h1>
          <Button variant="hero" size="sm">
            <Plus className="h-4 w-4" />
            New Certificate
          </Button>
        </header>

        <div className="p-6 space-y-8">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{stat.label}</span>
                  <stat.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="mt-2 text-2xl font-heading font-bold text-foreground">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Empty State */}
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-16 text-center">
            <Award className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="font-heading text-lg font-semibold text-foreground">No certificates yet</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
              Start by uploading a certificate template, then generate your first batch of certificates.
            </p>
            <Button variant="hero" size="default" className="mt-6">
              <Upload className="h-4 w-4" />
              Upload Template
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
