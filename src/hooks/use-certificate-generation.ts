import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  generateCertificatePDF,
  generateSerialNumber,
  type CertificateData,
  type GenerationConfig,
} from "@/lib/certificate-generator";
import JSZip from "jszip";
import { toast } from "@/hooks/use-toast";

interface BatchRow {
  recipientName: string;
  recipientEmail?: string;
  recipientData: Record<string, string>;
}

interface GenerationResult {
  success: number;
  failed: number;
  certificates: {
    serialNumber: string;
    recipientName: string;
    pdfBlob: Blob;
  }[];
}

export const useCertificateGeneration = () => {
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);

  const generateBatch = useCallback(
    async (
      rows: BatchRow[],
      config: GenerationConfig,
      organizationId: string,
      templateId: string,
      batchId: string

    ): Promise<GenerationResult> => {
      setGenerating(true);
      setTotal(rows.length);
      setProgress(0);

      const verifyBaseUrl = window.location.origin;
      const results: GenerationResult = { success: 0, failed: 0, certificates: [] };

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const serialNumber = generateSerialNumber();

        try {
          const certData: CertificateData = {
            recipientName: row.recipientName,
            recipientEmail: row.recipientEmail,
            recipientData: row.recipientData,
            serialNumber,
            verificationToken: "", // Will be set by DB default
          };

          // Insert certificate record first to get the verification token
          const { data: certRecord, error: insertError } = await supabase
            .from("certificates")
            .insert({
              organization_id: organizationId,
              template_id: templateId,
              batch_id: batchId,
              serial_number: serialNumber,
              recipient_name: row.recipientName,
              recipient_email: row.recipientEmail || null,
              recipient_data: row.recipientData,
              status: "active",
            })
            .select("id, verification_token")
            .single();

          if (insertError || !certRecord) {
            console.error("Insert error:", insertError);
            results.failed++;
            setProgress(i + 1);
            continue;
          }

          // Generate PDF with real verification token
          certData.verificationToken = certRecord.verification_token;
          const pdfBytes = await generateCertificatePDF(certData, config, verifyBaseUrl);
          const pdfBlob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });

          // Upload PDF to storage
          const pdfPath = `${organizationId}/${batchId}/${certRecord.id}.pdf`;
          const { error: uploadError } = await supabase.storage
            .from("generated-certificates")
            .upload(pdfPath, pdfBlob, { contentType: "application/pdf" });

          if (uploadError) {
            console.error("Upload error:", uploadError);
            results.failed++;
            setProgress(i + 1);
            continue;
          }

          // Get public URL
          const { data: urlData } = supabase.storage
            .from("generated-certificates")
            .getPublicUrl(pdfPath);

          // Update certificate with PDF URL
          await supabase
            .from("certificates")
            .update({ pdf_url: urlData.publicUrl })
            .eq("id", certRecord.id);

          results.success++;
          results.certificates.push({
            serialNumber,
            recipientName: row.recipientName,
            pdfBlob,
          });
        } catch (err) {
          console.error("Generation error for", row.recipientName, err);
          results.failed++;
        }

        setProgress(i + 1);
      }

      // Update batch status
      await supabase
        .from("certificate_batches")
        .update({
          status: results.failed === rows.length ? "failed" : "completed",
          generated_count: results.success,
        })
        .eq("id", batchId);

      setGenerating(false);
      return results;
    },
    []
  );

  const downloadBatchAsZip = useCallback(
    async (
      certificates: { serialNumber: string; recipientName: string; pdfBlob: Blob }[],
      batchName: string
    ) => {
      const zip = new JSZip();
      for (const cert of certificates) {
        const safeName = cert.recipientName.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_");
        zip.file(`${safeName}_${cert.serialNumber}.pdf`, cert.pdfBlob);
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${batchName.replace(/\s+/g, "_")}_certificates.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: "Download complete", description: `${certificates.length} certificates downloaded.` });
    },
    []
  );

  return { generateBatch, downloadBatchAsZip, generating, progress, total };
};
