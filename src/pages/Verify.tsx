import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck, Search, CheckCircle, XCircle } from "lucide-react";

const Verify = () => {
  const [certificateId, setCertificateId] = useState("");
  const [result, setResult] = useState<null | "valid" | "invalid">(null);
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (!certificateId.trim()) return;
    setLoading(true);
    // Simulate verification
    await new Promise((r) => setTimeout(r, 1500));
    setResult(certificateId.length > 5 ? "valid" : "invalid");
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto flex items-center justify-between h-16 px-6">
          <Link to="/" className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-accent" />
            <span className="font-heading text-xl font-semibold text-foreground">CertifyPro</span>
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">Back to Home</Link>
          </Button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-md text-center space-y-8">
          <div>
            <h1 className="font-heading text-3xl font-bold text-foreground">Verify Certificate</h1>
            <p className="mt-2 text-muted-foreground">Enter the certificate ID or scan the QR code to verify authenticity.</p>
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Enter Certificate ID..."
              value={certificateId}
              onChange={(e) => {
                setCertificateId(e.target.value);
                setResult(null);
              }}
              className="text-center"
            />
            <Button variant="hero" onClick={handleVerify} disabled={loading}>
              {loading ? (
                <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>

          {result === "valid" && (
            <div className="rounded-xl border border-border bg-card p-6 animate-fade-up">
              <CheckCircle className="h-12 w-12 text-success mx-auto mb-4" />
              <h3 className="font-heading text-lg font-semibold text-foreground">Certificate Verified</h3>
              <div className="mt-4 space-y-2 text-sm text-left">
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Holder</span>
                  <span className="font-medium text-foreground">John Doe</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Course</span>
                  <span className="font-medium text-foreground">Web Development</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Issue Date</span>
                  <span className="font-medium text-foreground">April 7, 2026</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">Status</span>
                  <span className="inline-flex items-center gap-1 text-success font-medium">
                    <CheckCircle className="h-3.5 w-3.5" /> Active
                  </span>
                </div>
              </div>
            </div>
          )}

          {result === "invalid" && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 animate-fade-up">
              <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="font-heading text-lg font-semibold text-foreground">Certificate Not Found</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                No certificate matches this ID. Please check the ID and try again.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Verify;
