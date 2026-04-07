import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck,
  ArrowLeft,
  Upload,
  FileText,
  Loader2,
  Download,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import CSVUpload from "@/components/dashboard/CSVUpload";
import { useCertificateGeneration } from "@/hooks/use-certificate-generation";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type Step = "upload" | "configure" | "generating" | "complete";

const GenerateCertificates = () => {
  const [step, setStep] = useState<Step>("upload");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [batchName, setBatchName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [nameColumn, setNameColumn] = useState("");
  const [emailColumn, setEmailColumn] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);

  const { generateBatch, downloadBatchAsZip, generating, progress, total } = useCertificateGeneration();

  const [generatedCerts, setGeneratedCerts] = useState<
    { serialNumber: string; recipientName: string; pdfBlob: Blob }[]
  >([]);

  // Get or create org + template for the current user
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      // Get or create org
      let { data: orgs } = await supabase
        .from("organizations")
        .select("id, name")
        .limit(1);

      let org = orgs?.[0];
      if (!org) {
        const slug = `org-${user.id.substring(0, 8)}`;
        const { data: newOrg } = await supabase
          .from("organizations")
          .insert({ name: "My Organization", slug, owner_id: user.id })
          .select("id, name")
          .single();
        org = newOrg;
      }

      if (org) {
        setOrgId(org.id);
        setOrgName(org.name);
      }

      // Get or create template
      if (org) {
        let { data: templates } = await supabase
          .from("templates")
          .select("id")
          .eq("organization_id", org.id)
          .limit(1);

        let tmpl = templates?.[0];
        if (!tmpl) {
          const { data: newTmpl } = await supabase
            .from("templates")
            .insert({
              organization_id: org.id,
              name: "Default Template",
              created_by: user.id,
              width_px: 842,
              height_px: 595,
            })
            .select("id")
            .single();
          tmpl = newTmpl;
        }

        if (tmpl) setTemplateId(tmpl.id);
      }
    };
    init();
  }, []);

  const handleDataParsed = (headers: string[], rows: Record<string, string>[]) => {
    setCsvHeaders(headers);
    setCsvRows(rows);
    // Auto-detect name & email columns
    const nameCandidates = headers.filter((h) =>
      ["name", "recipient_name", "full_name", "student_name"].includes(h.toLowerCase())
    );
    if (nameCandidates.length > 0) setNameColumn(nameCandidates[0]);
    const emailCandidates = headers.filter((h) =>
      ["email", "recipient_email", "mail", "e-mail"].includes(h.toLowerCase())
    );
    if (emailCandidates.length > 0) setEmailColumn(emailCandidates[0]);
    setStep("configure");
  };

  const handleGenerate = async () => {
    if (!orgId || !templateId || !userId || !nameColumn) {
      toast({ title: "Error", description: "Missing configuration. Please check all fields.", variant: "destructive" });
      return;
    }

    setStep("generating");

    // Create batch record
    const { data: batch, error: batchError } = await supabase
      .from("certificate_batches")
      .insert({
        organization_id: orgId,
        template_id: templateId,
        name: batchName || `Batch ${new Date().toLocaleDateString()}`,
        total_count: csvRows.length,
        status: "processing",
        created_by: userId,
      })
      .select("id")
      .single();

    if (batchError || !batch) {
      toast({ title: "Error creating batch", description: batchError?.message, variant: "destructive" });
      setStep("configure");
      return;
    }

    // Prepare rows
    const batchRows = csvRows.map((row) => ({
      recipientName: row[nameColumn] || "Unknown",
      recipientEmail: emailColumn ? row[emailColumn] : undefined,
      recipientData: row,
    }));

    // Extra fields from CSV (besides name/email)
    const extraFields = csvHeaders
      .filter((h) => h !== nameColumn && h !== emailColumn)
      .map((h, i) => ({
        fieldKey: h,
        label: h.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        xPosition: 0,
        yPosition: 0,
        fontSize: 12,
        fontColor: "#333333",
        textAlign: "center" as const,
        maxWidth: undefined,
      }));

    const config = {
      templateName: "Default Template",
      organizationName: orgName,
      width: 842,
      height: 595,
      fields: extraFields,
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

  const progressPercent = total > 0 ? (progress / total) * 100 : 0;

  return (
    <div className="min-h-screen bg-background">
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

      <main className="container mx-auto max-w-2xl px-6 py-10">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-10">
          {(["upload", "configure", "generating", "complete"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium ${
                step === s
                  ? "bg-primary text-primary-foreground"
                  : ["upload", "configure", "generating", "complete"].indexOf(step) > i
                  ? "bg-accent text-accent-foreground"
                  : "bg-muted text-muted-foreground"
              }`}>
                {["upload", "configure", "generating", "complete"].indexOf(step) > i ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  i + 1
                )}
              </div>
              {i < 3 && <div className="w-12 h-px bg-border" />}
            </div>
          ))}
        </div>

        {/* Step: Upload */}
        {step === "upload" && (
          <div className="space-y-6">
            <div>
              <h2 className="font-heading text-2xl font-bold text-foreground">Upload Recipients</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Upload a CSV file with your certificate recipients.
              </p>
            </div>
            <CSVUpload onDataParsed={handleDataParsed} />
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-xs font-medium text-foreground mb-2">Example CSV format:</p>
              <pre className="text-xs text-muted-foreground font-mono">
{`name,email,course,date
John Doe,john@example.com,Web Development,2026-04-07
Jane Smith,jane@example.com,Data Science,2026-04-07`}
              </pre>
            </div>
          </div>
        )}

        {/* Step: Configure */}
        {step === "configure" && (
          <div className="space-y-6">
            <div>
              <h2 className="font-heading text-2xl font-bold text-foreground">Configure Batch</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Map your CSV columns and name this batch.
              </p>
            </div>

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

            {/* Preview */}
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="bg-muted px-4 py-2 text-xs font-medium text-muted-foreground">
                Preview ({csvRows.length} recipients)
              </div>
              <div className="max-h-48 overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      {csvHeaders.slice(0, 5).map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvRows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-b border-border">
                        {csvHeaders.slice(0, 5).map((h) => (
                          <td key={h} className="px-3 py-2 text-xs text-foreground">{row[h]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("upload")}>
                Back
              </Button>
              <Button variant="hero" onClick={handleGenerate} disabled={!nameColumn || !orgId}>
                <FileText className="h-4 w-4" />
                Generate {csvRows.length} Certificates
              </Button>
            </div>
          </div>
        )}

        {/* Step: Generating */}
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
              Each certificate gets a unique serial number and QR code
            </p>
          </div>
        )}

        {/* Step: Complete */}
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
                onClick={() => downloadBatchAsZip(generatedCerts, batchName || "batch")}
              >
                <Download className="h-4 w-4" />
                Download All as ZIP
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/dashboard">Back to Dashboard</Link>
              </Button>
            </div>

            {/* Certificate list */}
            <div className="rounded-lg border border-border overflow-hidden text-left mt-8 max-w-lg mx-auto">
              <div className="bg-muted px-4 py-2 text-xs font-medium text-muted-foreground">
                Generated Certificates
              </div>
              <div className="max-h-64 overflow-auto divide-y divide-border">
                {generatedCerts.map((cert) => (
                  <div key={cert.serialNumber} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{cert.recipientName}</p>
                      <p className="text-xs text-muted-foreground">{cert.serialNumber}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const url = URL.createObjectURL(cert.pdfBlob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `${cert.recipientName.replace(/\s+/g, "_")}_${cert.serialNumber}.pdf`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
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
