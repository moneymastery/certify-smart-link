import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import {
  ShieldCheck,
  ArrowLeft,
  FileText,
  Loader2,
  Download,
  CheckCircle,
  AlertCircle,
  CalendarIcon,
  Eye,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import CSVUpload from "@/components/dashboard/CSVUpload";
import CertificatePreview from "@/components/CertificatePreview";
import { useCertificateGeneration } from "@/hooks/use-certificate-generation";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

type Step = "upload" | "mapping" | "configure" | "generating" | "complete";

type GeneratedCertificate = {
  serialNumber: string;
  recipientName: string;
  pdfUrl: string;
  pdfBlob?: Blob;
};

const GenerateCertificates = () => {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("upload");
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [batchName, setBatchName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [nameColumn, setNameColumn] = useState("");
  const [emailColumn, setEmailColumn] = useState("");
  const [orgId, setOrgId] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
  const [setupLoading, setSetupLoading] = useState(true);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [verificationFields, setVerificationFields] = useState<string[]>([]);
  const [issueDate, setIssueDate] = useState<Date>(new Date());
  const [showPreview, setShowPreview] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<any>(null);
  const [previewFields, setPreviewFields] = useState<any[]>([]);
  const { generateBatch, downloadBatchAsZip, generating, progress, total } = useCertificateGeneration();

  const [generatedCerts, setGeneratedCerts] = useState<GeneratedCertificate[]>([]);

  useEffect(() => {
    if (!user) return;

    const init = async () => {
      setSetupLoading(true);
      setSetupError(null);

      try {
        // Deterministic: prefer the org owned by this user, oldest first.
        let { data: orgs, error: orgLookupError } = await supabase
          .from("organizations")
          .select("id, name, created_at")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: true })
          .limit(1);

        if (orgLookupError) throw orgLookupError;

        if (!orgs || orgs.length === 0) {
          const { data: anyOrgs, error: anyErr } = await supabase
            .from("organizations")
            .select("id, name, created_at")
            .order("created_at", { ascending: true })
            .limit(1);
          if (anyErr) throw anyErr;
          orgs = anyOrgs as any;
        }

        let org = orgs?.[0];
        if (!org) {
          const slug = `org-${user.id.substring(0, 8)}`;
          const { data: newOrgId, error: orgInsertError } = await supabase.rpc('create_user_organization', {
            _name: 'My Organization',
            _slug: slug,
            _owner_id: user.id,
          });

          if (orgInsertError || !newOrgId) throw orgInsertError ?? new Error("Could not create organization");
          org = { id: newOrgId, name: 'My Organization' } as any;
        }

        setOrgId(org.id);
        setOrgName(org.name);

        const { data: templateList, error: templateLookupError } = await supabase
          .from("templates")
          .select("id, name")
          .eq("organization_id", org.id)
          .order("created_at", { ascending: false });

        if (templateLookupError) throw templateLookupError;

        if (templateList && templateList.length > 0) {
          setTemplates(templateList);
          setTemplateId(templateList[0].id);
        } else {
          const { data: newTemplate, error: templateInsertError } = await supabase
            .from("templates")
            .insert({
              organization_id: org.id,
              name: "Default Template",
              created_by: user.id,
              width_px: 842,
              height_px: 595,
            })
            .select("id, name")
            .single();

          if (templateInsertError || !newTemplate) {
            throw templateInsertError ?? new Error("Could not create template");
          }
          setTemplates([newTemplate]);
          setTemplateId(newTemplate.id);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not prepare certificate generation.";
        setSetupError(message);
        toast({ title: "Setup error", description: message, variant: "destructive" });
      } finally {
        setSetupLoading(false);
      }
    };

    init();
  }, [user]);

  const [templateFields, setTemplateFields] = useState<{ field_key: string; label: string }[]>([]);
  const [autoMapStats, setAutoMapStats] = useState<{ matched: number; total: number; unmatched: string[] } | null>(null);

  // Extract {{placeholder}} variable names from template text fields
  const placeholderVars = useMemo(() => {
    const vars: { varName: string; fromField: string }[] = [];
    const seen = new Set<string>();
    for (const f of templateFields) {
      const matches = f.label.matchAll(/\{\{(\w+)\}\}/g);
      for (const m of matches) {
        if (!seen.has(m[1])) {
          seen.add(m[1]);
          vars.push({ varName: m[1], fromField: f.field_key });
        }
      }
    }
    return vars;
  }, [templateFields]);

  const handleDataParsed = (headers: string[], rows: Record<string, string>[]) => {
    setCsvHeaders(headers);
    setCsvRows(rows);

    const nameCandidates = headers.filter((h) =>
      ["name", "recipient_name", "full_name", "student_name"].includes(h.toLowerCase().trim())
    );
    if (nameCandidates.length > 0) setNameColumn(nameCandidates[0]);

    const emailCandidates = headers.filter((h) =>
      ["email", "recipient_email", "mail", "e-mail"].includes(h.toLowerCase().trim())
    );
    if (emailCandidates.length > 0) setEmailColumn(emailCandidates[0]);

    const preSelected = headers.filter(
      (h) => !["email", "recipient_email", "mail", "e-mail"].includes(h.toLowerCase().trim())
    );
    setVerificationFields(preSelected);

    setStep("mapping");
  };

  // Load template fields when template changes
  useEffect(() => {
    if (!templateId) return;
    const loadFields = async () => {
      const { data } = await supabase
        .from("template_fields")
        .select("field_key, label")
        .eq("template_id", templateId)
        .order("sort_order");
      setTemplateFields(data || []);
      // Auto-map: match field_key AND placeholder vars to CSV headers (case-insensitive, with underscore/space normalization)
      if (data && csvHeaders.length > 0) {
        const autoMap: Record<string, string> = {};
        const normalize = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, "");
        const targets: { key: string; label: string }[] = [];
        for (const f of data) {
          if (f.field_key === "recipient_name") continue;
          if (!f.label.includes("{{")) {
            targets.push({ key: f.field_key, label: f.label });
          }
          const matches = f.label.matchAll(/\{\{(\w+)\}\}/g);
          for (const m of matches) {
            targets.push({ key: m[1], label: `{{${m[1]}}}` });
          }
        }
        const unmatched: string[] = [];
        for (const t of targets) {
          if (autoMap[t.key]) continue;
          const match = csvHeaders.find((h) => normalize(h) === normalize(t.key));
          if (match) autoMap[t.key] = match;
          else unmatched.push(t.label);
        }
        setFieldMapping(autoMap);
        setAutoMapStats({
          matched: Object.keys(autoMap).length,
          total: targets.length,
          unmatched,
        });
      } else {
        setAutoMapStats(null);
      }
    };
    loadFields();
  }, [templateId, csvHeaders]);

  const handleGenerate = async () => {
    if (setupLoading) {
      toast({ title: "Please wait", description: "Preparing your organization and template." });
      return;
    }

    if (setupError) {
      toast({ title: "Setup incomplete", description: setupError, variant: "destructive" });
      return;
    }

    if (!orgId || !templateId || !user?.id || !nameColumn) {
      toast({ title: "Error", description: "Missing configuration. Please check all fields.", variant: "destructive" });
      return;
    }

    if (csvRows.length === 0) {
      toast({ title: "No recipients found", description: "Upload a file with at least one row.", variant: "destructive" });
      return;
    }

    setStep("generating");

    // Save selected verification fields to the template
    await supabase
      .from("templates")
      .update({ verification_fields: verificationFields } as any)
      .eq("id", templateId);

    const [templateResult, fieldsResult] = await Promise.all([
      supabase.from("templates").select("*").eq("id", templateId).single(),
      supabase.from("template_fields").select("*").eq("template_id", templateId).order("sort_order"),
    ]);

    const tmplData = templateResult.data;
    const tmplFields = fieldsResult.data || [];

    const { data: batch, error: batchError } = await supabase
      .from("certificate_batches")
      .insert({
        organization_id: orgId,
        template_id: templateId,
        name: batchName || `Batch ${new Date().toLocaleDateString()}`,
        total_count: csvRows.length,
        status: "processing",
        created_by: user.id,
      })
      .select("id")
      .single();

    if (batchError || !batch) {
      toast({ title: "Error creating batch", description: batchError?.message, variant: "destructive" });
      setStep("configure");
      return;
    }

    // Build recipientData using field mapping so only mapped fields get values
    const batchRows = csvRows.map((row) => {
      const mappedData: Record<string, string> = {};
      // Map all field keys AND placeholder variable names to their CSV values
      for (const [fieldKey, csvCol] of Object.entries(fieldMapping)) {
        if (csvCol && row[csvCol] != null) {
          mappedData[fieldKey] = String(row[csvCol]);
        }
      }
      return {
        recipientName: String(row[nameColumn] || "").trim() || "Unknown",
        recipientEmail: emailColumn ? row[emailColumn] : undefined,
        recipientData: { ...row, ...mappedData },
      };
    });

    // Include all mapped fields AND template text fields (those with {{placeholders}})
    // Include ALL fields: mapped ones, template text ({{}}), AND recipient_name always
    const mappedFields = tmplFields
      .filter((f: any) => f.field_key === "recipient_name" || fieldMapping[f.field_key] || f.label.includes("{{"))
      .map((f: any) => ({
        fieldKey: f.field_key,
        label: f.label,
        xPosition: Number(f.x_position),
        yPosition: Number(f.y_position),
        fontSize: f.font_size,
        fontColor: f.font_color,
        fontWeight: f.font_weight || "normal",
        textAlign: f.text_align as "left" | "center" | "right",
        verticalAlign: (f.vertical_align || "middle") as "top" | "middle" | "bottom" | "baseline",
        maxWidth: f.max_width ?? undefined,
      }));

    const td = tmplData as any;
    const config = {
      templateName: tmplData?.name || "Default Template",
      organizationName: orgName,
      width: tmplData?.width_px || 842,
      height: tmplData?.height_px || 595,
      issueDate: issueDate.toISOString(),
      fields: mappedFields,
      assets: {
        backgroundUrl: tmplData?.background_url,
        logoUrl: tmplData?.logo_url,
        signatureUrl: tmplData?.signature_url,
        sealUrl: tmplData?.seal_url,
        logoX: tmplData?.logo_x != null ? Number(tmplData.logo_x) : undefined,
        logoY: tmplData?.logo_y != null ? Number(tmplData.logo_y) : undefined,
        signatureX: tmplData?.signature_x != null ? Number(tmplData.signature_x) : undefined,
        signatureY: tmplData?.signature_y != null ? Number(tmplData.signature_y) : undefined,
        sealX: tmplData?.seal_x != null ? Number(tmplData.seal_x) : undefined,
        sealY: tmplData?.seal_y != null ? Number(tmplData.seal_y) : undefined,
        logoWidth: td?.logo_width != null ? Number(td.logo_width) : undefined,
        logoHeight: td?.logo_height != null ? Number(td.logo_height) : undefined,
        signatureWidth: td?.signature_width != null ? Number(td.signature_width) : undefined,
        signatureHeight: td?.signature_height != null ? Number(td.signature_height) : undefined,
        sealWidth: td?.seal_width != null ? Number(td.seal_width) : undefined,
        sealHeight: td?.seal_height != null ? Number(td.seal_height) : undefined,
      },
      displayToggles: {
        showQrCode: td?.show_qr_code !== false,
        showCertificateId: td?.show_certificate_id !== false,
        showOrgName: td?.show_org_name !== false,
        qrCodeX: td?.qr_code_x != null ? Number(td.qr_code_x) : undefined,
        qrCodeY: td?.qr_code_y != null ? Number(td.qr_code_y) : undefined,
        certIdX: td?.cert_id_x != null ? Number(td.cert_id_x) : undefined,
        certIdY: td?.cert_id_y != null ? Number(td.cert_id_y) : undefined,
        orgNameX: td?.org_name_x != null ? Number(td.org_name_x) : undefined,
        orgNameY: td?.org_name_y != null ? Number(td.org_name_y) : undefined,
      },
    };

    const results = await generateBatch(batchRows, config, orgId, templateId, batch.id);

    setGeneratedCerts(results.certificates);
    setStep("complete");

    if (results.failed > 0) {
      toast({
        title: "Generation complete with errors",
        description: `${results.success} succeeded, ${results.failed} failed`,
        variant: "destructive",
      });
    } else {
      toast({
        title: "All certificates generated!",
        description: `${results.success} certificates ready for download`,
      });
    }
  };

  const downloadSingleCertificate = async (cert: GeneratedCertificate) => {
    const blob = cert.pdfBlob ?? (await fetch(cert.pdfUrl).then((response) => response.blob()));
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${cert.recipientName.replace(/\s+/g, "_")}_${cert.serialNumber}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadZip = async () => {
    setDownloading(true);
    try {
      await downloadBatchAsZip(generatedCerts, batchName || "batch");
    } finally {
      setDownloading(false);
    }
  };

  const progressPercent = total > 0 ? (progress / total) * 100 : 0;

  return (
    <div className="min-h-screen bg-background relative">
      {/* ZIP download overlay */}
      {downloading && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 text-accent mx-auto animate-spin" />
            <h3 className="font-heading text-xl font-semibold text-foreground">Preparing Download</h3>
            <p className="text-sm text-muted-foreground">Bundling {generatedCerts.length} certificates into a ZIP file...</p>
          </div>
        </div>
      )}

      <header className="border-b border-border bg-card">
        <div className="container mx-auto flex items-center justify-between h-16 px-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/dashboard"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-accent" />
              <span className="font-heading text-lg font-semibold text-foreground">Generate Certificates</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-center gap-2 mb-10">
          {(["upload", "mapping", "configure", "generating", "complete"] as Step[]).map((s, i) => {
            const allSteps: Step[] = ["upload", "mapping", "configure", "generating", "complete"];
            const currentIdx = allSteps.indexOf(step);
            return (
              <div key={s} className="flex items-center gap-2">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium ${
                  step === s
                    ? "bg-primary text-primary-foreground"
                    : currentIdx > i
                    ? "bg-accent text-accent-foreground"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {currentIdx > i ? <CheckCircle className="h-4 w-4" /> : i + 1}
                </div>
                {i < 4 && <div className="w-10 h-px bg-border" />}
              </div>
            );
          })}
        </div>

        {step === "upload" && (
          <div className="space-y-6">
            <div>
              <h2 className="font-heading text-2xl font-bold text-foreground">Upload Recipients</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Upload a CSV or spreadsheet with your certificate recipients.
              </p>
            </div>
            <CSVUpload onDataParsed={handleDataParsed} />
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-xs font-medium text-foreground mb-2">Example format:</p>
              <pre className="text-xs text-muted-foreground font-mono">
{`name,email,course,date
John Doe,john@example.com,Web Development,2026-04-07
Jane Smith,jane@example.com,Data Science,2026-04-07`}
              </pre>
            </div>
          </div>
        )}

        {step === "mapping" && (
          <div className="space-y-6">
            <div>
              <h2 className="font-heading text-2xl font-bold text-foreground">Map Fields</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Link each template field to a column from your uploaded file. Only mapped fields will appear on the certificate.
              </p>
            </div>

            {autoMapStats && autoMapStats.total > 0 && (() => {
              const pct = autoMapStats.matched / autoMapStats.total;
              const isGood = pct === 1;
              const isPartial = pct > 0 && pct < 1;
              const isNone = pct === 0;
              return (
                <div
                  className={cn(
                    "rounded-lg border p-3 flex items-start gap-3",
                    isGood && "border-accent/30 bg-accent/5",
                    isPartial && "border-amber-500/30 bg-amber-500/5",
                    isNone && "border-destructive/30 bg-destructive/5"
                  )}
                >
                  {isGood ? (
                    <CheckCircle className="h-4 w-4 mt-0.5 text-accent shrink-0" />
                  ) : (
                    <AlertCircle
                      className={cn(
                        "h-4 w-4 mt-0.5 shrink-0",
                        isPartial ? "text-amber-600" : "text-destructive"
                      )}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {isGood
                        ? `All ${autoMapStats.total} template field${autoMapStats.total === 1 ? "" : "s"} auto-matched to your file.`
                        : `${autoMapStats.matched} of ${autoMapStats.total} fields auto-matched.`}
                    </p>
                    {!isGood && autoMapStats.unmatched.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Please map manually: <span className="font-medium text-foreground">{autoMapStats.unmatched.join(", ")}</span>
                      </p>
                    )}
                  </div>
                </div>
              );
            })()}

            {templates.length > 0 && (
              <div className="space-y-2">
                <Label>Certificate Template</Label>
                <select
                  value={templateId || ""}
                  onChange={(e) => setTemplateId(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Name Column *</Label>
                <select
                  value={nameColumn}
                  onChange={(e) => setNameColumn(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Select column...</option>
                  {csvHeaders.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Email Column (optional)</Label>
                <select
                  value={emailColumn}
                  onChange={(e) => setEmailColumn(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">None</option>
                  {csvHeaders.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            </div>

            {templateFields.length > 0 && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Template Field → CSV Column</Label>
                <p className="text-xs text-muted-foreground">
                  Map each template field to the CSV column that contains its data. Leave unmapped to skip.
                </p>
                <div className="space-y-2">
                  {templateFields
                    .filter((f) => f.field_key !== "recipient_name" && !f.label.includes("{{"))
                    .map((f) => (
                      <div key={f.field_key} className="flex items-center gap-3">
                        <span className="text-sm text-foreground w-40 truncate" title={f.label}>{f.label}</span>
                        <span className="text-muted-foreground text-xs">→</span>
                        <select
                          value={fieldMapping[f.field_key] || ""}
                          onChange={(e) =>
                            setFieldMapping((prev) => ({ ...prev, [f.field_key]: e.target.value }))
                          }
                          className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="">— Skip —</option>
                          {csvHeaders.map((h) => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                </div>

                {/* Placeholder variable mappings from template text fields */}
                {placeholderVars.length > 0 && (
                  <div className="space-y-2 mt-4">
                    <Label className="text-sm font-medium">Template Text Variables → CSV Column</Label>
                    <p className="text-xs text-muted-foreground">
                      These variables appear inside template text like {"{{company}}"}. Map each to the correct CSV column.
                    </p>
                    {placeholderVars.map((pv) => (
                      <div key={pv.varName} className="flex items-center gap-3">
                        <span className="text-sm text-foreground w-40 font-mono">{`{{${pv.varName}}}`}</span>
                        <span className="text-muted-foreground text-xs">→</span>
                        <select
                          value={fieldMapping[pv.varName] || ""}
                          onChange={(e) =>
                            setFieldMapping((prev) => ({ ...prev, [pv.varName]: e.target.value }))
                          }
                          className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="">— Skip —</option>
                          {csvHeaders.map((h) => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {templateFields.length === 0 && (
              <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                No custom fields found in the selected template. All CSV columns will be stored as data but only the recipient name will be rendered on the certificate.
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("upload")}>Back</Button>
              <Button variant="hero" onClick={() => setStep("configure")} disabled={!nameColumn}>
                Continue to Configure
              </Button>
            </div>
          </div>
        )}

        {step === "configure" && (
          <div className="space-y-6">
            <div>
              <h2 className="font-heading text-2xl font-bold text-foreground">Configure Batch</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Map your file columns, review all recipients, and start generation.
              </p>
            </div>

            {(setupLoading || setupError) && (
              <div className={`rounded-lg border p-4 flex items-start gap-3 ${
                setupError
                  ? "border-destructive/30 bg-destructive/5"
                  : "border-border bg-muted/30"
              }`}>
                {setupError ? (
                  <AlertCircle className="h-4 w-4 mt-0.5 text-destructive shrink-0" />
                ) : (
                  <Loader2 className="h-4 w-4 mt-0.5 text-accent shrink-0 animate-spin" />
                )}
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {setupError ? "Setup problem" : "Preparing your workspace"}
                  </p>
                  <p className={`text-xs ${setupError ? "text-destructive" : "text-muted-foreground"}`}>
                    {setupError ?? "Creating your organization and template so large batches can run cleanly."}
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Batch Name</Label>
                <Input
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  placeholder="e.g. Spring 2026 Cohort"
                />
              </div>

              <div className="space-y-2">
                <Label>Organization Name (on certificate)</Label>
                <Input
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="e.g. Acme Training Institute"
                />
              </div>

              <div className="space-y-2">
                <Label>Issue Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !issueDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {issueDate ? format(issueDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={issueDate}
                      onSelect={(d) => d && setIssueDate(d)}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground">This date appears on the certificate and verification page.</p>
              </div>

            </div>

            {/* Verification fields picker */}
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium">Fields visible after QR scan</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Choose which details are shown when someone scans the certificate QR code.
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {csvHeaders.map((h) => (
                  <label key={h} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors">
                    <Checkbox
                      checked={verificationFields.includes(h)}
                      onCheckedChange={(checked) => {
                        setVerificationFields((prev) =>
                          checked ? [...prev, h] : prev.filter((f) => f !== h)
                        );
                      }}
                    />
                    <span className="text-sm text-foreground truncate">
                      {h.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Certificate Visual Preview */}
            <div className="space-y-3">
              <Button
                variant="outline"
                onClick={async () => {
                  if (!templateId) return;
                  const [tmplRes, fieldsRes] = await Promise.all([
                    supabase.from("templates").select("*").eq("id", templateId).single(),
                    supabase.from("template_fields").select("*").eq("template_id", templateId).order("sort_order"),
                  ]);
                  setPreviewTemplate(tmplRes.data);
                  setPreviewFields(fieldsRes.data || []);
                  setShowPreview(!showPreview);
                }}
                disabled={!templateId}
              >
                <Eye className="h-4 w-4" />
                {showPreview ? "Hide Preview" : "Preview Certificate"}
              </Button>

              {showPreview && previewTemplate && csvRows.length > 0 && (() => {
                const firstRow = csvRows[0];
                const t = previewTemplate;

                // Build fields array for the shared preview component
                const visibleFields = previewFields.filter(
                  (f: any) =>
                    f.field_key === "recipient_name" ||
                    fieldMapping[f.field_key] ||
                    (f.label && f.label.includes("{{"))
                );

                // Build recipientData with mapped values
                const mappedData: Record<string, string> = { ...firstRow };
                for (const [key, col] of Object.entries(fieldMapping)) {
                  if (col && firstRow[col] != null) mappedData[key] = String(firstRow[col]);
                }

                return (
                  <div className="rounded-lg border border-border overflow-hidden bg-muted/30">
                    <div className="bg-muted px-4 py-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        Preview — {firstRow[nameColumn] || "Row 1"} (first recipient)
                      </span>
                    </div>
                    <CertificatePreview
                      template={t}
                      fields={visibleFields}
                      recipientData={mappedData}
                      recipientName={String(firstRow[nameColumn] || "Recipient Name")}
                      orgName={orgName}
                    />
                  </div>
                );
              })()}
            </div>

            <div className="rounded-lg border border-border overflow-hidden">
              <div className="bg-muted px-4 py-2 flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-muted-foreground">Recipients ({csvRows.length})</span>
                <span className="text-xs text-muted-foreground">Showing all uploaded rows</span>
              </div>
              <div className="max-h-[28rem] overflow-auto">
                <table className="w-full min-w-max text-sm">
                  <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm">
                    <tr className="border-b border-border">
                      {csvHeaders.map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvRows.map((row, i) => (
                      <tr key={`${i}-${row[nameColumn] ?? i}`} className="border-b border-border even:bg-muted/20">
                        {csvHeaders.map((h) => (
                          <td key={h} className="px-3 py-2 text-xs text-foreground whitespace-nowrap">
                            {row[h] || "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("mapping")}>
                Back
              </Button>
              <Button
                variant="hero"
                onClick={handleGenerate}
                disabled={!nameColumn || !orgId || !templateId || setupLoading || generating}
              >
                {setupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                {setupLoading ? "Preparing..." : `Generate ${csvRows.length} Certificates`}
              </Button>
            </div>
          </div>
        )}

        {step === "generating" && (
          <div className="space-y-6 text-center py-12">
            <Loader2 className="h-12 w-12 text-accent mx-auto animate-spin" />
            <div>
              <h2 className="font-heading text-2xl font-bold text-foreground">Generating Certificates</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {progress} of {total} certificates generated...
              </p>
            </div>
            <Progress value={progressPercent} className="max-w-sm mx-auto" />
            <p className="text-xs text-muted-foreground">
              Large batches are processed progressively so the page stays responsive.
            </p>
          </div>
        )}

        {step === "complete" && (
          <div className="space-y-6 text-center py-12">
            <CheckCircle className="h-16 w-16 text-accent mx-auto" />
            <div>
              <h2 className="font-heading text-2xl font-bold text-foreground">Certificates Ready!</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {generatedCerts.length} certificates generated successfully
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                variant="hero"
                size="lg"
                onClick={handleDownloadZip}
                disabled={downloading}
              >
                {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {downloading ? "Preparing ZIP..." : "Download All as ZIP"}
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/dashboard">Back to Dashboard</Link>
              </Button>
            </div>

            <div className="rounded-lg border border-border overflow-hidden text-left mt-8 max-w-2xl mx-auto w-full">
              <div className="bg-muted px-4 py-2 text-xs font-medium text-muted-foreground">
                Generated Certificates
              </div>
              <div className="max-h-64 overflow-auto divide-y divide-border">
                {generatedCerts.map((cert) => (
                  <div key={cert.serialNumber} className="px-4 py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{cert.recipientName}</p>
                      <p className="text-xs text-muted-foreground">{cert.serialNumber}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => downloadSingleCertificate(cert)}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default GenerateCertificates;
