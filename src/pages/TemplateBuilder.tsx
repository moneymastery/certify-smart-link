import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ShieldCheck,
  ArrowLeft,
  Upload,
  Image,
  PenTool,
  Stamp,
  Plus,
  Trash2,
  Save,
  GripVertical,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { LINE_HEIGHT_RATIO, getTextAnchorTransform, getTextAnchorTop } from "@/lib/certificate-layout";

interface FieldItem {
  id: string;
  fieldKey: string;
  label: string;
  xPosition: number;
  yPosition: number;
  fontSize: number;
  fontColor: string;
  fontWeight: string;
  textAlign: string;
  verticalAlign: "top" | "middle" | "bottom" | "baseline";
  maxWidth: number | null;
}

interface AssetPosition {
  x: number;
  y: number;
}

interface AssetSize {
  width: number;
  height: number;
}

const DEFAULT_FIELDS: Omit<FieldItem, "id">[] = [
  { fieldKey: "recipient_name", label: "Recipient Name", xPosition: 50, yPosition: 45, fontSize: 28, fontColor: "#1a1a2e", fontWeight: "bold", textAlign: "center", verticalAlign: "middle", maxWidth: 600 },
  { fieldKey: "course", label: "Course Name", xPosition: 50, yPosition: 58, fontSize: 16, fontColor: "#444444", fontWeight: "normal", textAlign: "center", verticalAlign: "middle", maxWidth: 500 },
  { fieldKey: "date", label: "Date", xPosition: 50, yPosition: 70, fontSize: 14, fontColor: "#666666", fontWeight: "normal", textAlign: "center", verticalAlign: "middle", maxWidth: 300 },
];

const SAMPLE_VALUES: Record<string, string> = {
  recipient_name: "Bibak Kumar",
  name: "Bibak Kumar",
  full_name: "Bibak Kumar",
  student_name: "Bibak Kumar",
  father_name: "Rajendra Prasad Singh",
  parent_name: "Rajendra Prasad Singh",
  roll_no: "123060052",
  roll_number: "123060052",
  reg_no: "SBN/INTS/23-27/11014",
  registration_no: "SBN/INTS/23-27/11014",
  session: "2023-2027",
  college: "R S COLLEGE TARAPUR, MUNGER",
  course: "DATA ANALYTICS & REPORTING",
  grade: "A",
  company: "SUNITI AND SONS INFOTECH LLP",
  organization: "SUNITI AND SONS INFOTECH LLP",
  start_date: "23.02.2026",
  end_date: "20.03.2026",
  date: "23.02.2026 to 20.03.2026",
};

const sampleFieldValue = (field: FieldItem) => {
  const sampleForKey = (key: string) => SAMPLE_VALUES[key.trim().toLowerCase()] || key.trim().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const sample = field.label.includes("{{")
    ? field.label.replace(/\{\{([^}]+)\}\}/g, (_, key) => sampleForKey(String(key)))
    : SAMPLE_VALUES[field.fieldKey.toLowerCase()] || field.label || sampleForKey(field.fieldKey);
  return sample || `{{${field.fieldKey}}}`;
};

type DragTarget = string | "logo" | "signature" | "seal" | "qrCode" | "certId" | "orgName";

const TemplateBuilder = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id: editId } = useParams<{ id: string }>();
  const isEditMode = !!editId;
  const canvasRef = useRef<HTMLDivElement>(null);

  const [templateName, setTemplateName] = useState("My Certificate Template");
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [sealUrl, setSealUrl] = useState<string | null>(null);

  const [logoPos, setLogoPos] = useState<AssetPosition>({ x: 50, y: 5 });
  const [signaturePos, setSignaturePos] = useState<AssetPosition>({ x: 25, y: 85 });
  const [sealPos, setSealPos] = useState<AssetPosition>({ x: 80, y: 82 });

  const [logoSize, setLogoSize] = useState<AssetSize>({ width: 0, height: 50 });
  const [signatureSize, setSignatureSize] = useState<AssetSize>({ width: 0, height: 40 });
  const [sealSize, setSealSize] = useState<AssetSize>({ width: 0, height: 60 });

  const [showQrCode, setShowQrCode] = useState(true);
  const [showCertificateId, setShowCertificateId] = useState(true);
  const [showOrgName, setShowOrgName] = useState(true);
  const [qrCodePos, setQrCodePos] = useState<AssetPosition>({ x: 90, y: 90 });
  const [certIdPos, setCertIdPos] = useState<AssetPosition>({ x: 50, y: 90 });
  const [orgNamePos, setOrgNamePos] = useState<AssetPosition>({ x: 10, y: 90 });

  const [fields, setFields] = useState<FieldItem[]>(
    DEFAULT_FIELDS.map((f, i) => ({ ...f, id: `field-${i}` }))
  );
  const [dragging, setDragging] = useState<DragTarget | null>(null);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<"logo" | "signature" | "seal" | "qrCode" | "certId" | "orgName" | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);
  const childClickedRef = useRef(false);

  const CANVAS_WIDTH = 842;
  const CANVAS_HEIGHT = 595;
  const [canvasScale, setCanvasScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scale canvas to fit container using ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateScale = () => {
      const { clientWidth, clientHeight } = el;
      const pad = 48;
      const scaleX = (clientWidth - pad) / CANVAS_WIDTH;
      const scaleY = (clientHeight - pad) / CANVAS_HEIGHT;
      setCanvasScale(Math.min(1, scaleX, scaleY));
    };
    updateScale();
    const ro = new ResizeObserver(updateScale);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!user) return;
    const getOrg = async () => {
      const { data: orgs } = await supabase
        .from("organizations")
        .select("id, created_at")
        .order("created_at", { ascending: true })
        .limit(20);
      let org = orgs?.[0];
      if (orgs && orgs.length > 0) {
        const { data: templateOrgs } = await supabase
          .from("templates")
          .select("organization_id, created_at")
          .in("organization_id", orgs.map((item) => item.id))
          .order("created_at", { ascending: false })
          .limit(1);
        const activeOrgId = templateOrgs?.[0]?.organization_id;
        org = orgs.find((item) => item.id === activeOrgId) || org;
      }
      if (!org) {
        const slug = `org-${user.id.substring(0, 8)}`;
        const { data: newOrgId } = await supabase.rpc('create_user_organization', {
          _name: 'My Organization',
          _slug: slug,
          _owner_id: user.id,
        });
        org = newOrgId ? ({ id: newOrgId as string } as any) : null;
      }
      if (org) setOrgId(org.id);
    };
    getOrg();
  }, [user]);

  // Load existing template for edit mode
  useEffect(() => {
    if (!editId || !user) return;
    const loadTemplate = async () => {
      setLoading(true);
      try {
        const [tmplRes, fieldsRes] = await Promise.all([
          supabase.from("templates").select("*").eq("id", editId).single(),
          supabase.from("template_fields").select("*").eq("template_id", editId).order("sort_order"),
        ]);
        const t = tmplRes.data as any;
        if (!t) { toast({ title: "Template not found", variant: "destructive" }); navigate("/dashboard"); return; }
        setOrgId(t.organization_id);
        setTemplateName(t.name);
        setBackgroundUrl(t.background_url);
        setLogoUrl(t.logo_url);
        setSignatureUrl(t.signature_url);
        setSealUrl(t.seal_url);
        setLogoPos({ x: Number(t.logo_x), y: Number(t.logo_y) });
        setSignaturePos({ x: Number(t.signature_x), y: Number(t.signature_y) });
        setSealPos({ x: Number(t.seal_x), y: Number(t.seal_y) });
        setLogoSize({ width: t.logo_width ?? 0, height: t.logo_height ?? 50 });
        setSignatureSize({ width: t.signature_width ?? 0, height: t.signature_height ?? 40 });
        setSealSize({ width: t.seal_width ?? 0, height: t.seal_height ?? 60 });
        setShowQrCode(t.show_qr_code !== false);
        setShowCertificateId(t.show_certificate_id !== false);
        setShowOrgName(t.show_org_name !== false);
        setQrCodePos({ x: Number(t.qr_code_x ?? 90), y: Number(t.qr_code_y ?? 90) });
        setCertIdPos({ x: Number(t.cert_id_x ?? 50), y: Number(t.cert_id_y ?? 90) });
        setOrgNamePos({ x: Number(t.org_name_x ?? 10), y: Number(t.org_name_y ?? 90) });

        const loadedFields = (fieldsRes.data || []).map((f: any) => ({
          id: f.id,
          fieldKey: f.field_key,
          label: f.label,
          xPosition: Number(f.x_position),
          yPosition: Number(f.y_position),
          fontSize: f.font_size,
          fontColor: f.font_color,
          fontWeight: f.font_weight || "normal",
          textAlign: f.text_align,
          verticalAlign: f.vertical_align || "middle",
          maxWidth: f.max_width,
        }));
        if (loadedFields.length > 0) setFields(loadedFields);
      } catch (err: any) {
        toast({ title: "Failed to load template", description: err.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    loadTemplate();
  }, [editId, user]);

  const uploadFile = async (file: File, bucket: string, path: string): Promise<string | null> => {
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      return null;
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  };

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "background" | "logo" | "signature" | "seal"
  ) => {
    const file = e.target.files?.[0];
    if (!file || !orgId) return;

    const path = `${orgId}/${type}-${Date.now()}.${file.name.split(".").pop()}`;
    const url = await uploadFile(file, "certificate-templates", path);
    if (!url) return;

    switch (type) {
      case "background": setBackgroundUrl(url); break;
      case "logo": setLogoUrl(url); break;
      case "signature": setSignatureUrl(url); break;
      case "seal": setSealUrl(url); break;
    }
  };

  const handlePointerDown = (target: DragTarget, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    childClickedRef.current = true;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setDragging(target);
    if (target === "logo" || target === "signature" || target === "seal" || target === "qrCode" || target === "certId" || target === "orgName") {
      setSelectedAsset(target as any);
      setSelectedField(null);
    } else {
      setSelectedField(target);
      setSelectedAsset(null);
    }
  };

  const getCanvasPercent = useCallback((clientX: number, clientY: number) => {
    if (!canvasRef.current) return { x: 50, y: 50 };
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    return {
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    };
  }, []);

  const applyDrag = useCallback((clientX: number, clientY: number) => {
    if (!dragging) return;
    const { x: clampX, y: clampY } = getCanvasPercent(clientX, clientY);
    if (dragging === "logo") {
      setLogoPos({ x: clampX, y: clampY });
    } else if (dragging === "signature") {
      setSignaturePos({ x: clampX, y: clampY });
    } else if (dragging === "seal") {
      setSealPos({ x: clampX, y: clampY });
    } else if (dragging === "qrCode") {
      setQrCodePos({ x: clampX, y: clampY });
    } else if (dragging === "certId") {
      setCertIdPos({ x: clampX, y: clampY });
    } else if (dragging === "orgName") {
      setOrgNamePos({ x: clampX, y: clampY });
    } else {
      setFields((prev) =>
        prev.map((f) =>
          f.id === dragging ? { ...f, xPosition: clampX, yPosition: clampY } : f
        )
      );
    }
  }, [dragging, getCanvasPercent]);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!dragging) return;
    e.preventDefault();
    applyDrag(e.clientX, e.clientY);
  }, [dragging, applyDrag]);

  const handlePointerUp = useCallback(() => {
    setDragging(null);
  }, []);

  useEffect(() => {
    if (dragging) {
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      return () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
      };
    }
  }, [dragging, handlePointerMove, handlePointerUp]);

  const addField = () => {
    const newField: FieldItem = {
      id: `field-${Date.now()}`,
      fieldKey: `field_${fields.length + 1}`,
      label: `Field ${fields.length + 1}`,
      xPosition: 50,
      yPosition: 50,
      fontSize: 16,
      fontColor: "#333333",
      fontWeight: "normal",
      textAlign: "center",
      verticalAlign: "middle",
      maxWidth: null,
    };
    setFields([...fields, newField]);
    setSelectedField(newField.id);
    setSelectedAsset(null);
  };

  const removeField = (id: string) => {
    setFields(fields.filter((f) => f.id !== id));
    if (selectedField === id) setSelectedField(null);
  };

  const updateField = (id: string, updates: Partial<FieldItem>) => {
    setFields(fields.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    // Guard: if a child element just handled this interaction, skip
    if (childClickedRef.current) {
      childClickedRef.current = false;
      return;
    }
    // Only deselect when clicking directly on the canvas background
    if (e.target === e.currentTarget) {
      setSelectedField(null);
      setSelectedAsset(null);
    }
  };

  const handleSave = async () => {
    if (!user || !orgId) return;
    setSaving(true);

    const templatePayload = {
      name: templateName,
      width_px: CANVAS_WIDTH,
      height_px: CANVAS_HEIGHT,
      background_url: backgroundUrl,
      logo_url: logoUrl,
      signature_url: signatureUrl,
      seal_url: sealUrl,
      logo_x: logoPos.x,
      logo_y: logoPos.y,
      signature_x: signaturePos.x,
      signature_y: signaturePos.y,
      seal_x: sealPos.x,
      seal_y: sealPos.y,
      logo_width: logoSize.width,
      logo_height: logoSize.height,
      signature_width: signatureSize.width,
      signature_height: signatureSize.height,
      seal_width: sealSize.width,
      seal_height: sealSize.height,
      show_qr_code: showQrCode,
      show_certificate_id: showCertificateId,
      show_org_name: showOrgName,
      qr_code_x: qrCodePos.x,
      qr_code_y: qrCodePos.y,
      cert_id_x: certIdPos.x,
      cert_id_y: certIdPos.y,
      org_name_x: orgNamePos.x,
      org_name_y: orgNamePos.y,
    } as any;

    try {
      let templateId: string;

      if (isEditMode && editId) {
        // Update existing template
        const { error: tmplErr } = await supabase
          .from("templates")
          .update(templatePayload)
          .eq("id", editId);
        if (tmplErr) throw tmplErr;
        templateId = editId;

        // Delete old fields and re-insert
        await supabase.from("template_fields").delete().eq("template_id", editId);
      } else {
        // Create new template
        const { data: template, error: tmplErr } = await supabase
          .from("templates")
          .insert({ ...templatePayload, organization_id: orgId, created_by: user.id })
          .select("id")
          .single();
        if (tmplErr) throw tmplErr;
        templateId = template.id;
      }

      const fieldRows = fields.map((f, i) => ({
        template_id: templateId,
        field_key: f.fieldKey,
        label: f.label,
        x_position: f.xPosition,
        y_position: f.yPosition,
        font_size: f.fontSize,
        font_color: f.fontColor,
        font_weight: f.fontWeight,
        text_align: f.textAlign,
        vertical_align: f.verticalAlign,
        max_width: f.maxWidth,
        sort_order: i,
      }));

      const { error: fieldsErr } = await supabase.from("template_fields").insert(fieldRows as any);
      if (fieldsErr) throw fieldsErr;

      toast({ title: "Template saved!", description: isEditMode ? "Template updated." : "Template created." });
      navigate("/dashboard");
    } catch (error: any) {
      toast({ title: "Error saving template", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const selectedFieldData = fields.find((f) => f.id === selectedField);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card shrink-0">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/dashboard"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <ShieldCheck className="h-5 w-5 text-accent" />
            <Input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="border-none bg-transparent font-heading text-lg font-semibold h-auto p-0 focus-visible:ring-0 w-64"
            />
          </div>
          <Button variant="hero" size="sm" onClick={handleSave} disabled={saving || loading}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isEditMode ? "Update Template" : "Save Template"}
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar - uploads */}
        <aside className="hidden md:block w-60 border-r border-border bg-card p-4 space-y-5 overflow-y-auto shrink-0">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assets</h3>

          {[
            { type: "background" as const, label: "Background", icon: Image, url: backgroundUrl },
            { type: "logo" as const, label: "Logo", icon: ShieldCheck, url: logoUrl },
            { type: "signature" as const, label: "Signature", icon: PenTool, url: signatureUrl },
            { type: "seal" as const, label: "Seal / Stamp", icon: Stamp, url: sealUrl },
          ].map((asset) => (
            <div key={asset.type} className="space-y-2">
              <Label className="text-xs">{asset.label}</Label>
              {asset.url ? (
                <div className="relative group">
                  <img src={asset.url} alt={asset.label} className="w-full h-20 object-contain rounded-md border border-border bg-muted" />
                  <label className="absolute inset-0 flex items-center justify-center bg-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-md">
                    <span className="text-xs text-background font-medium">Replace</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, asset.type)} />
                  </label>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-20 rounded-md border border-dashed border-border bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
                  <Upload className="h-4 w-4 text-muted-foreground mb-1" />
                  <span className="text-xs text-muted-foreground">Upload</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, asset.type)} />
                </label>
              )}
            </div>
          ))}

          <div className="border-t border-border pt-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Fields</h3>
            <div className="space-y-1">
              {fields.map((field) => (
                <button
                  key={field.id}
                  onClick={() => { setSelectedField(field.id); setSelectedAsset(null); }}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                    selectedField === field.id
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  <GripVertical className="h-3 w-3 shrink-0 opacity-50" />
                  <span className="truncate">{field.label}</span>
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" className="w-full mt-2" onClick={addField}>
              <Plus className="h-3 w-3" /> Add Field
            </Button>
          </div>
        </aside>

        {/* Canvas */}
        <div ref={containerRef} className="flex-1 bg-muted/30 flex items-center justify-center p-6 overflow-auto">
          <div
            ref={canvasRef}
            onPointerDown={handleCanvasPointerDown}
            className="relative bg-background border border-border shadow-lg origin-center touch-none"
            style={{
              width: CANVAS_WIDTH,
              height: CANVAS_HEIGHT,
              transform: `scale(${canvasScale})`,
              backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
              fontFamily: "Arial, Helvetica, sans-serif",
            }}
          >
            {/* Logo overlay — draggable */}
            {logoUrl && (
              <img
                src={logoUrl}
                alt="Logo"
                onPointerDown={(e) => handlePointerDown("logo", e)}
                className={`absolute h-12 object-contain cursor-move select-none touch-none ${
                  selectedAsset === "logo" ? "ring-2 ring-accent ring-offset-1" : "hover:ring-1 hover:ring-border"
                }`}
                style={{
                  left: `${logoPos.x}%`,
                  top: `${logoPos.y}%`,
                  transform: "translate(-50%, -50%)",
                  width: logoSize.width > 0 ? `${logoSize.width}px` : "auto",
                  height: logoSize.height > 0 ? `${logoSize.height}px` : "50px",
                }}
                draggable={false}
              />
            )}

            {/* Signature overlay — draggable */}
            {signatureUrl && (
              <img
                src={signatureUrl}
                alt="Signature"
                onPointerDown={(e) => handlePointerDown("signature", e)}
                className={`absolute h-10 object-contain cursor-move select-none touch-none ${
                  selectedAsset === "signature" ? "ring-2 ring-accent ring-offset-1" : "hover:ring-1 hover:ring-border"
                }`}
                style={{
                  left: `${signaturePos.x}%`,
                  top: `${signaturePos.y}%`,
                  transform: "translate(-50%, -50%)",
                  width: signatureSize.width > 0 ? `${signatureSize.width}px` : "auto",
                  height: signatureSize.height > 0 ? `${signatureSize.height}px` : "40px",
                }}
                draggable={false}
              />
            )}

            {/* Seal overlay — draggable */}
            {sealUrl && (
              <img
                src={sealUrl}
                alt="Seal"
                onPointerDown={(e) => handlePointerDown("seal", e)}
                className={`absolute h-16 object-contain cursor-move select-none touch-none ${
                  selectedAsset === "seal" ? "ring-2 ring-accent ring-offset-1" : "hover:ring-1 hover:ring-border"
                }`}
                style={{
                  left: `${sealPos.x}%`,
                  top: `${sealPos.y}%`,
                  transform: "translate(-50%, -50%)",
                  width: sealSize.width > 0 ? `${sealSize.width}px` : "auto",
                  height: sealSize.height > 0 ? `${sealSize.height}px` : "60px",
                }}
                draggable={false}
              />
            )}

            {/* QR Code placeholder — draggable */}
            {showQrCode && (
              <div
                onPointerDown={(e) => handlePointerDown("qrCode", e)}
                className={`absolute cursor-move select-none touch-none flex flex-col items-center ${
                  selectedAsset === "qrCode" ? "ring-2 ring-accent ring-offset-1" : "hover:ring-1 hover:ring-border"
                }`}
                style={{
                  left: `${qrCodePos.x}%`,
                  top: `${qrCodePos.y}%`,
                  transform: "translate(-50%, -50%)",
                }}
              >
                <div className="w-14 h-14 border-2 border-dashed border-muted-foreground/60 bg-background/50 rounded flex items-center justify-center">
                  <span className="text-[9px] text-muted-foreground font-medium">QR</span>
                </div>
                <span className="text-[7px] text-muted-foreground mt-0.5">Scan to verify</span>
              </div>
            )}

            {/* Certificate ID placeholder — draggable */}
            {showCertificateId && (
              <div
                onPointerDown={(e) => handlePointerDown("certId", e)}
                className={`absolute cursor-move select-none touch-none px-2 py-0.5 rounded ${
                  selectedAsset === "certId" ? "ring-2 ring-accent ring-offset-1" : "hover:ring-1 hover:ring-border"
                }`}
                style={{
                  left: `${certIdPos.x}%`,
                  top: `${certIdPos.y}%`,
                  transform: "translate(-50%, -50%)",
                }}
              >
                <span className="text-[9px] text-muted-foreground">Certificate ID: CERT-XXXXXX</span>
              </div>
            )}

            {/* Organization Name placeholder — draggable */}
            {showOrgName && (
              <div
                onPointerDown={(e) => handlePointerDown("orgName", e)}
                className={`absolute cursor-move select-none touch-none px-2 py-0.5 rounded ${
                  selectedAsset === "orgName" ? "ring-2 ring-accent ring-offset-1" : "hover:ring-1 hover:ring-border"
                }`}
                style={{
                  left: `${orgNamePos.x}%`,
                  top: `${orgNamePos.y}%`,
                  transform: "translate(-50%, -50%)",
                }}
              >
                <span className="text-[10px] font-bold text-foreground/70">Org Name</span>
              </div>
            )}

            {/* Draggable fields */}
            {fields.map((field) => {
              const isSelected = selectedField === field.id;
              const align = (field.textAlign || "left") as "left" | "center" | "right";
              const anchorLabel = `Pinned ${align} / ${field.verticalAlign}`;
              return (
                <div key={field.id}>
                  <div
                    onPointerDown={(e) => handlePointerDown(field.id, e)}
                    className="absolute cursor-move select-none touch-none"
                    style={{
                      left: `${field.xPosition}%`,
                      top: getTextAnchorTop(field.yPosition, field.fontSize, field.verticalAlign),
                      transform: getTextAnchorTransform(field.textAlign, field.verticalAlign),
                      fontSize: field.fontSize,
                      lineHeight: LINE_HEIGHT_RATIO,
                      fontWeight: field.fontWeight === "bold" ? "bold" : "normal",
                      color: field.fontColor,
                      textAlign: align,
                      maxWidth: field.maxWidth || undefined,
                      whiteSpace: field.label.includes("{{") ? "normal" : "nowrap",
                      wordBreak: field.label.includes("{{") ? "break-word" : "normal",
                    }}
                  >
                    {sampleFieldValue(field)}
                    <span className={`absolute inset-0 rounded pointer-events-none transition-shadow ${isSelected ? "ring-2 ring-accent ring-offset-1 shadow-md" : "ring-0"}`} />
                  </div>

                  {isSelected && (
                    <>
                      <div
                        className="absolute pointer-events-none bg-accent/40"
                        style={{ left: `${field.xPosition}%`, top: 0, width: "1px", height: "100%", transform: "translateX(-0.5px)" }}
                      />
                      <div
                        className="absolute pointer-events-none bg-accent/40"
                        style={{ left: 0, top: `${field.yPosition}%`, width: "100%", height: "1px", transform: "translateY(-0.5px)" }}
                      />
                      <div
                        className="absolute pointer-events-none rounded-full bg-accent ring-2 ring-background shadow"
                        style={{ left: `${field.xPosition}%`, top: `${field.yPosition}%`, width: "10px", height: "10px", transform: "translate(-50%, -50%)" }}
                      />
                      <div
                        className="absolute pointer-events-none px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent text-accent-foreground whitespace-nowrap shadow"
                        style={{ left: `${field.xPosition}%`, top: `${field.yPosition}%`, transform: "translate(8px, -140%)" }}
                      >
                        {anchorLabel}
                      </div>
                    </>
                  )}
                </div>
              );
            })}


            {/* Empty state */}
            {!backgroundUrl && fields.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center text-muted-foreground">
                  <Image className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Upload a background image to start</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar - always visible */}
        <aside className="hidden md:block w-72 border-l border-border bg-card p-4 space-y-4 overflow-y-auto shrink-0">
          {selectedAsset && (() => {
            // Image assets (logo, signature, seal) have size controls
            const isImageAsset = selectedAsset === "logo" || selectedAsset === "signature" || selectedAsset === "seal";
            // System elements (qrCode, certId, orgName) only have position
            const posMap: Record<string, [AssetPosition, React.Dispatch<React.SetStateAction<AssetPosition>>]> = {
              logo: [logoPos, setLogoPos],
              signature: [signaturePos, setSignaturePos],
              seal: [sealPos, setSealPos],
              qrCode: [qrCodePos, setQrCodePos],
              certId: [certIdPos, setCertIdPos],
              orgName: [orgNamePos, setOrgNamePos],
            };
            const [posState, setPos] = posMap[selectedAsset] || [{ x: 50, y: 50 }, () => {}];
            const sizeState = selectedAsset === "logo" ? logoSize : selectedAsset === "signature" ? signatureSize : sealSize;
            const setSize = selectedAsset === "logo" ? setLogoSize : selectedAsset === "signature" ? setSignatureSize : setSealSize;
            const labelMap: Record<string, string> = { logo: "Logo", signature: "Signature", seal: "Seal", qrCode: "QR Code", certId: "Certificate ID", orgName: "Organization Name" };
            return (
              <>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {labelMap[selectedAsset]} Properties
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">X (%)</Label>
                    <Input type="number" value={Math.round(posState.x)} onChange={(e) => setPos((p) => ({ ...p, x: Number(e.target.value) }))} className="h-8 text-sm" min={0} max={100} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Y (%)</Label>
                    <Input type="number" value={Math.round(posState.y)} onChange={(e) => setPos((p) => ({ ...p, y: Number(e.target.value) }))} className="h-8 text-sm" min={0} max={100} />
                  </div>
                </div>
                {isImageAsset && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Width (px)</Label>
                        <Input type="number" value={sizeState.width || ""} onChange={(e) => setSize((s) => ({ ...s, width: Number(e.target.value) }))} className="h-8 text-sm" placeholder="Auto" min={0} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Height (px)</Label>
                        <Input type="number" value={sizeState.height || ""} onChange={(e) => setSize((s) => ({ ...s, height: Number(e.target.value) }))} className="h-8 text-sm" placeholder="Auto" min={0} />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">Set 0 or empty for auto-sizing.</p>
                  </>
                )}
              </>
            );
          })()}

          {selectedFieldData && (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Field Properties</h3>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeField(selectedFieldData.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Label / Template Text</Label>
                  <Input value={selectedFieldData.label} onChange={(e) => updateField(selectedFieldData.id, { label: e.target.value })} className="h-8 text-sm" />
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Use <code className="bg-muted px-0.5 rounded">{"{{column_name}}"}</code> for inline data, e.g.{" "}
                    <code className="bg-muted px-0.5 rounded text-[9px]">{"S/O, D/O {{father_name}}"}</code>
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Field Key</Label>
                  <Input value={selectedFieldData.fieldKey} onChange={(e) => updateField(selectedFieldData.id, { fieldKey: e.target.value })} className="h-8 text-sm font-mono" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">X (%)</Label>
                    <Input type="number" value={Math.round(selectedFieldData.xPosition)} onChange={(e) => updateField(selectedFieldData.id, { xPosition: Number(e.target.value) })} className="h-8 text-sm" min={0} max={100} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Y (%)</Label>
                    <Input type="number" value={Math.round(selectedFieldData.yPosition)} onChange={(e) => updateField(selectedFieldData.id, { yPosition: Number(e.target.value) })} className="h-8 text-sm" min={0} max={100} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Bold</Label>
                  <div className="flex gap-1">
                    {["normal", "bold"].map((w) => (
                      <Button key={w} variant={selectedFieldData.fontWeight === w ? "default" : "outline"} size="sm" className="flex-1 h-7 text-xs capitalize" onClick={() => updateField(selectedFieldData.id, { fontWeight: w })}>{w}</Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Font Size</Label>
                  <Input type="number" value={selectedFieldData.fontSize} onChange={(e) => updateField(selectedFieldData.id, { fontSize: Number(e.target.value) })} className="h-8 text-sm" min={8} max={72} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Color</Label>
                  <div className="flex gap-2">
                    <input type="color" value={selectedFieldData.fontColor} onChange={(e) => updateField(selectedFieldData.id, { fontColor: e.target.value })} className="h-8 w-8 rounded border border-border cursor-pointer" />
                    <Input value={selectedFieldData.fontColor} onChange={(e) => updateField(selectedFieldData.id, { fontColor: e.target.value })} className="h-8 text-sm font-mono flex-1" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Align</Label>
                  <div className="flex gap-1">
                    {["left", "center", "right"].map((a) => (
                      <Button key={a} variant={selectedFieldData.textAlign === a ? "default" : "outline"} size="sm" className="flex-1 h-7 text-xs capitalize" onClick={() => updateField(selectedFieldData.id, { textAlign: a })}>{a}</Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Vertical Anchor</Label>
                  <div className="grid grid-cols-2 gap-1">
                    {(["top", "middle", "bottom", "baseline"] as const).map((a) => (
                      <Button key={a} variant={selectedFieldData.verticalAlign === a ? "default" : "outline"} size="sm" className="h-7 text-xs capitalize" onClick={() => updateField(selectedFieldData.id, { verticalAlign: a })}>{a}</Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Max Width (px)</Label>
                  <Input type="number" value={selectedFieldData.maxWidth || ""} onChange={(e) => updateField(selectedFieldData.id, { maxWidth: e.target.value ? Number(e.target.value) : null })} className="h-8 text-sm" placeholder="Auto" />
                </div>
              </div>
            </>
          )}

          {!selectedFieldData && !selectedAsset && (
            <div className="flex flex-col items-center justify-center h-24 text-center text-muted-foreground">
              <PenTool className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">Select a field or asset to edit</p>
            </div>
          )}

          {/* Display Toggles - always visible */}
          <div className="border-t border-border pt-4 space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Display Options</h3>

            <div className="flex items-center justify-between">
              <Label className="text-xs">QR Code</Label>
              <Switch checked={showQrCode} onCheckedChange={setShowQrCode} />
            </div>
            {showQrCode && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">QR X (%)</Label>
                  <Input type="number" value={Math.round(qrCodePos.x)} onChange={(e) => setQrCodePos((p) => ({ ...p, x: Number(e.target.value) }))} className="h-8 text-sm" min={0} max={100} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">QR Y (%)</Label>
                  <Input type="number" value={Math.round(qrCodePos.y)} onChange={(e) => setQrCodePos((p) => ({ ...p, y: Number(e.target.value) }))} className="h-8 text-sm" min={0} max={100} />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label className="text-xs">Certificate ID</Label>
              <Switch checked={showCertificateId} onCheckedChange={setShowCertificateId} />
            </div>
            {showCertificateId && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">ID X (%)</Label>
                  <Input type="number" value={Math.round(certIdPos.x)} onChange={(e) => setCertIdPos((p) => ({ ...p, x: Number(e.target.value) }))} className="h-8 text-sm" min={0} max={100} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">ID Y (%)</Label>
                  <Input type="number" value={Math.round(certIdPos.y)} onChange={(e) => setCertIdPos((p) => ({ ...p, y: Number(e.target.value) }))} className="h-8 text-sm" min={0} max={100} />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label className="text-xs">Organization Name</Label>
              <Switch checked={showOrgName} onCheckedChange={setShowOrgName} />
            </div>
            {showOrgName && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Org X (%)</Label>
                  <Input type="number" value={Math.round(orgNamePos.x)} onChange={(e) => setOrgNamePos((p) => ({ ...p, x: Number(e.target.value) }))} className="h-8 text-sm" min={0} max={100} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Org Y (%)</Label>
                  <Input type="number" value={Math.round(orgNamePos.y)} onChange={(e) => setOrgNamePos((p) => ({ ...p, y: Number(e.target.value) }))} className="h-8 text-sm" min={0} max={100} />
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default TemplateBuilder;
