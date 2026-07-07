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
  Trash2,
  Search,
  Loader2,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import JSZip from "jszip";

const sidebarItems = [
  { icon: LayoutDashboard, label: "Overview" },
  { icon: Palette, label: "Templates" },
  { icon: FileText, label: "Certificates" },
  { icon: BarChart3, label: "Batches" },
];

// Global cache to prevent concurrent resolveOrgId calls during StrictMode double-mounts
let resolveOrgPromise: Promise<string | null> | null = null;

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const [activeItem, setActiveItem] = useState("Overview");
  const [stats, setStats] = useState({ templates: 0, certificates: 0, verifications: 0, batches: 0 });
  const [certificates, setCertificates] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);

  // Search
  const [certSearch, setCertSearch] = useState("");
  const [batchSearch, setBatchSearch] = useState("");
  const [templateSearch, setTemplateSearch] = useState("");

  // Delete batch dialog
  const [deleteBatchId, setDeleteBatchId] = useState<string | null>(null);
  const [deleteBatchName, setDeleteBatchName] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Delete template dialog
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);
  const [deleteTemplateName, setDeleteTemplateName] = useState("");
  const [deletingTemplate, setDeletingTemplate] = useState(false);

  // Rename template
  const [renameTemplateId, setRenameTemplateId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);

  // Re-download
  const [downloadingBatchId, setDownloadingBatchId] = useState<string | null>(null);

  const resolveOrgId = async (): Promise<string | null> => {
    if (!user) return null;
    if (resolveOrgPromise) return resolveOrgPromise;

    const doResolve = async () => {
      let orgs: any[] | null = null;
      
      // Retry loop to handle RLS propagation delay right after login
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data, error } = await supabase
          .from("organizations")
          .select("id, created_at")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: true })
          .limit(20);
          
        if (error) throw error;
        orgs = data;
        
        if (orgs && orgs.length > 0) {
          break; // Found it!
        }
        
        // Wait 500ms before retrying if nothing was found
        if (attempt < 2) await new Promise(r => setTimeout(r, 500));
      }

      console.log("resolveOrgId: initial select returned", orgs?.length, "orgs");
      if (orgs && orgs.length > 0) {
        const orgIds = orgs.map((org) => org.id);
        const { data: templateOrgs } = await supabase
          .from("templates")
          .select("organization_id, created_at")
          .in("organization_id", orgIds)
          .order("created_at", { ascending: false })
          .limit(1);
        return templateOrgs?.[0]?.organization_id || orgs[0].id;
      }

      // No org yet — bootstrap one. Use direct insert with conflict handling.
      const slug = `org-${user.id.substring(0, 8)}`;
      console.log("resolveOrgId: Calling RPC create_user_organization with slug", slug);
      // Try the RPC first; on 409 slug conflict, fall back to owner_id query
      const { data: newOrgId } = await supabase.rpc("create_user_organization", {
        _name: "My Organization",
        _slug: slug,
        _owner_id: user.id,
      });
      if (newOrgId) return (newOrgId as string);
      // Conflict or error — org must already exist, re-query by owner_id
      const { data: existingOrgs } = await supabase
        .from("organizations")
        .select("id")
        .eq("owner_id", user.id)
        .limit(1);
      return existingOrgs?.[0]?.id || null;
    };

    resolveOrgPromise = doResolve();
    try {
      return await resolveOrgPromise;
    } finally {
      // Clear cache after a short delay to allow concurrent calls to share it
      setTimeout(() => { resolveOrgPromise = null; }, 1000);
    }
  };

  const loadData = async () => {
    if (!user) return;

    const oid = await resolveOrgId();
    if (!oid) return;
    setOrgId(oid);

    // Run stat counts independently so one failure doesn't blank the whole overview.
    // Verifications are counted via an embedded FK filter — a single tiny request,
    // instead of fetching every certificate id and stuffing them into .in(...) which
    // produces a URL too large for the edge proxy and hangs forever as (pending).
    const settle = async <T,>(p: Promise<T>, label: string): Promise<T | null> => {
      try { return await p; } catch (e) { console.error(`[dashboard] ${label} failed`, e); return null; }
    };

    const [tempRes, certRes, batchRes, verifRes] = await Promise.all([
      settle(
        supabase.from("templates").select("id", { count: "exact", head: true }).eq("organization_id", oid),
        "templates count"
      ),
      settle(
        supabase.from("certificates").select("id", { count: "exact", head: true }).eq("organization_id", oid),
        "certificates count"
      ),
      settle(
        supabase.from("certificate_batches").select("id", { count: "exact", head: true }).eq("organization_id", oid),
        "batches count"
      ),
      settle(
        supabase
          .from("certificate_verifications")
          .select("id, certificate:certificates!inner(organization_id)", { count: "exact", head: true })
          .eq("certificate.organization_id", oid),
        "verifications count"
      ),
    ]);

    setStats({
      templates: tempRes?.count || 0,
      certificates: certRes?.count || 0,
      batches: batchRes?.count || 0,
      verifications: verifRes?.count || 0,
    });

    const [certsRes, batchListRes, tmplRes] = await Promise.all([
      settle(
        supabase
          .from("certificates")
          .select("id, serial_number, recipient_name, status, issued_at, pdf_url, verification_token")
          .eq("organization_id", oid)
          .order("created_at", { ascending: false })
          .limit(100),
        "certificates list"
      ),
      settle(
        supabase
          .from("certificate_batches")
          .select("id, name, status, total_count, generated_count, created_at")
          .eq("organization_id", oid)
          .order("created_at", { ascending: false })
          .limit(50),
        "batches list"
      ),
      settle(
        supabase
          .from("templates")
          .select("id, name, created_at, background_url")
          .eq("organization_id", oid)
          .order("created_at", { ascending: false }),
        "templates list"
      ),
    ]);

    if (certsRes?.data) setCertificates(certsRes.data);
    if (batchListRes?.data) setBatches(batchListRes.data);
    if (tmplRes?.data) setTemplates(tmplRes.data);
  };

  useEffect(() => { loadData(); }, [user]);


  // Filtered lists
  const filteredCerts = certSearch
    ? certificates.filter((c) =>
        c.recipient_name.toLowerCase().includes(certSearch.toLowerCase()) ||
        c.serial_number.toLowerCase().includes(certSearch.toLowerCase())
      )
    : certificates;

  const filteredBatches = batchSearch
    ? batches.filter((b) => b.name.toLowerCase().includes(batchSearch.toLowerCase()))
    : batches;

  const filteredTemplates = templateSearch
    ? templates.filter((t) => t.name.toLowerCase().includes(templateSearch.toLowerCase()))
    : templates;

  // Delete batch
  const handleDeleteBatch = async () => {
    if (!deleteBatchId) return;
    setDeleting(true);
    try {
      // Delete certificates in batch first
      const { error: certErr } = await supabase
        .from("certificates")
        .delete()
        .eq("batch_id", deleteBatchId);
      if (certErr) throw certErr;

      const { error: batchErr } = await supabase
        .from("certificate_batches")
        .delete()
        .eq("id", deleteBatchId);
      if (batchErr) throw batchErr;

      toast({ title: "Batch deleted", description: `"${deleteBatchName}" and its certificates have been removed.` });
      await loadData();
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
      setDeleteBatchId(null);
    }
  };

  // Re-download batch as ZIP
  const handleRedownloadBatch = async (batchId: string, batchName: string) => {
    setDownloadingBatchId(batchId);
    try {
      const { data: certs } = await supabase
        .from("certificates")
        .select("recipient_name, serial_number, pdf_url")
        .eq("batch_id", batchId);

      if (!certs || certs.length === 0) {
        toast({ title: "No certificates", description: "This batch has no certificates to download.", variant: "destructive" });
        return;
      }

      const zip = new JSZip();
      for (const cert of certs) {
        if (!cert.pdf_url) continue;
        try {
          const res = await fetch(cert.pdf_url);
          const blob = await res.blob();
          const filename = `${cert.recipient_name.replace(/\s+/g, "_")}_${cert.serial_number}.pdf`;
          zip.file(filename, blob);
        } catch { /* skip failed downloads */ }
      }

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${batchName.replace(/\s+/g, "_")}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: "Download failed", description: err.message, variant: "destructive" });
    } finally {
      setDownloadingBatchId(null);
    }
  };

  // Delete template
  const handleDeleteTemplate = async () => {
    if (!deleteTemplateId) return;
    setDeletingTemplate(true);
    try {
      await supabase.from("template_fields").delete().eq("template_id", deleteTemplateId);
      const { error } = await supabase.from("templates").delete().eq("id", deleteTemplateId);
      if (error) throw error;
      toast({ title: "Template deleted", description: `"${deleteTemplateName}" has been removed.` });
      await loadData();
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    } finally {
      setDeletingTemplate(false);
      setDeleteTemplateId(null);
    }
  };

  // Rename template
  const handleRenameTemplate = async () => {
    if (!renameTemplateId || !renameValue.trim()) return;
    setRenaming(true);
    try {
      const { error } = await supabase.from("templates").update({ name: renameValue.trim() } as any).eq("id", renameTemplateId);
      if (error) throw error;
      toast({ title: "Template renamed" });
      await loadData();
    } catch (err: any) {
      toast({ title: "Rename failed", description: err.message, variant: "destructive" });
    } finally {
      setRenaming(false);
      setRenameTemplateId(null);
    }
  };

  const statCards = [
    { label: "Templates", value: stats.templates, icon: Upload },
    { label: "Certificates", value: stats.certificates, icon: Award },
    { label: "Verifications", value: stats.verifications, icon: QrCode },
    { label: "Batches", value: stats.batches, icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteBatchId} onOpenChange={(open) => { if (!open) setDeleteBatchId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete batch "{deleteBatchName}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this batch and all its certificates. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBatch}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete template dialog */}
      <AlertDialog open={!!deleteTemplateId} onOpenChange={(open) => { if (!open) setDeleteTemplateId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template "{deleteTemplateName}"?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this template and its fields. Existing certificates are not affected.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingTemplate}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTemplate} disabled={deletingTemplate} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deletingTemplate ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename template dialog */}
      <AlertDialog open={!!renameTemplateId} onOpenChange={(open) => { if (!open) setRenameTemplateId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rename template</AlertDialogTitle>
            <AlertDialogDescription>Enter a new name for this template.</AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} placeholder="Template name" className="mt-2" />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={renaming}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRenameTemplate} disabled={renaming || !renameValue.trim()}>
              {renaming ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Rename
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
        <div className="p-4 border-t border-border space-y-4">
          <div className="flex items-center gap-3 px-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-sm font-medium text-primary">
                {user?.email?.charAt(0).toUpperCase() || "U"}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {user?.email || "User Profile"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                Logged in
              </p>
            </div>
          </div>
          <div className="space-y-1">
            <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" asChild>
              <Link to="/">← Back to Home</Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground"
              onClick={signOut}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        {/* Mobile tab bar */}
        <div className="md:hidden flex border-b border-border bg-card overflow-x-auto">
          {sidebarItems.map((item) => (
            <button
              key={item.label}
              onClick={() => setActiveItem(item.label)}
              className={`flex items-center gap-2 px-4 py-3 text-sm whitespace-nowrap border-b-2 transition-colors ${
                activeItem === item.label
                  ? "border-primary text-primary font-medium"
                  : "border-transparent text-muted-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </div>

        <header className="h-16 border-b border-border flex items-center justify-between px-4 sm:px-6">
          <h1 className="font-heading text-xl font-semibold text-foreground">{activeItem}</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild className="hidden sm:inline-flex">
              <Link to="/templates/new">
                <Plus className="h-4 w-4" />
                New Template
              </Link>
            </Button>
            <Button variant="hero" size="sm" asChild>
              <Link to="/generate">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Generate Certificates</span>
                <span className="sm:hidden">Generate</span>
              </Link>
            </Button>
          </div>
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
                  <div className="bg-muted px-4 py-3 flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-foreground">Recent Certificates</span>
                    <div className="relative w-64">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        value={certSearch}
                        onChange={(e) => setCertSearch(e.target.value)}
                        placeholder="Search by name or ID..."
                        className="h-8 pl-8 text-xs"
                      />
                    </div>
                  </div>
                  <div className="divide-y divide-border">
                    {filteredCerts.length === 0 ? (
                      <div className="px-4 py-8 text-center text-sm text-muted-foreground">No matching certificates found.</div>
                    ) : (
                      filteredCerts.map((cert) => (
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
                      ))
                    )}
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
                  <div className="bg-muted px-4 py-3 flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-foreground">Certificate Batches</span>
                    <div className="relative w-64">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        value={batchSearch}
                        onChange={(e) => setBatchSearch(e.target.value)}
                        placeholder="Search batches..."
                        className="h-8 pl-8 text-xs"
                      />
                    </div>
                  </div>
                  <div className="divide-y divide-border">
                    {filteredBatches.length === 0 ? (
                      <div className="px-4 py-8 text-center text-sm text-muted-foreground">No matching batches found.</div>
                    ) : (
                      filteredBatches.map((batch) => (
                        <div key={batch.id} className="px-4 py-3 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-foreground">{batch.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {batch.generated_count}/{batch.total_count} generated · {new Date(batch.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium capitalize rounded-full px-2 py-0.5 ${
                              batch.status === "completed" ? "bg-accent/10 text-accent" :
                              batch.status === "processing" ? "bg-warning/10 text-warning" :
                              batch.status === "failed" ? "bg-destructive/10 text-destructive" :
                              "bg-muted text-muted-foreground"
                            }`}>
                              {batch.status}
                            </span>
                            {/* Re-download */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              disabled={downloadingBatchId === batch.id}
                              onClick={() => handleRedownloadBatch(batch.id, batch.name)}
                              title="Download certificates as ZIP"
                            >
                              {downloadingBatchId === batch.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Download className="h-3.5 w-3.5" />
                              )}
                            </Button>
                            {/* Delete */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => { setDeleteBatchId(batch.id); setDeleteBatchName(batch.name); }}
                              title="Delete batch"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Templates tab */}
          {activeItem === "Templates" && (
            <>
              {templates.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-muted/30 p-16 text-center">
                  <Palette className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                  <h3 className="font-heading text-lg font-semibold text-foreground">No templates yet</h3>
                  <Button variant="hero" className="mt-6" asChild>
                    <Link to="/templates/new">Create First Template</Link>
                  </Button>
                </div>
              ) : (
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="bg-muted px-4 py-3 flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-foreground">Templates</span>
                    <div className="relative w-64">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input value={templateSearch} onChange={(e) => setTemplateSearch(e.target.value)} placeholder="Search templates..." className="h-8 pl-8 text-xs" />
                    </div>
                  </div>
                  <div className="divide-y divide-border">
                    {filteredTemplates.length === 0 ? (
                      <div className="px-4 py-8 text-center text-sm text-muted-foreground">No matching templates found.</div>
                    ) : (
                      filteredTemplates.map((tmpl) => (
                        <div key={tmpl.id} className="px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors">
                          <div className="min-w-0 flex items-center gap-3">
                            {tmpl.background_url ? (
                              <img src={tmpl.background_url} alt="" className="h-10 w-14 object-cover rounded border border-border" />
                            ) : (
                              <div className="h-10 w-14 rounded border border-border bg-muted flex items-center justify-center">
                                <Palette className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-medium text-foreground truncate">{tmpl.name}</p>
                              <p className="text-xs text-muted-foreground">{new Date(tmpl.created_at).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" asChild title="Edit template">
                              <Link to={`/templates/${tmpl.id}/edit`}><Pencil className="h-3.5 w-3.5" /></Link>
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Rename" onClick={() => { setRenameTemplateId(tmpl.id); setRenameValue(tmpl.name); }}>
                              <FileText className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title="Delete" onClick={() => { setDeleteTemplateId(tmpl.id); setDeleteTemplateName(tmpl.name); }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
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
