"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Keyboard, ScanLine } from "lucide-react";
import { buttonClass, cn, inputClass } from "./ui";

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type DetectorCtor = new (opts: { formats: string[] }) => Detector;

/**
 * QR skaner: kamera (BarcodeDetector yoki jsQR) va qo'lda/USB skaner bilan kiritish.
 * USB skanerlar klaviatura kabi ishlaydi: kod kiritiladi va Enter bosiladi.
 */
export function Scanner({
  onScan,
  label = "QR kodni skaner qiling",
  placeholder = "Kodni kiriting yoki skaner qiling",
  disabled,
  compact,
}: {
  onScan: (text: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  compact?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastRef = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  const onScanRef = useRef(onScan);
  const [camera, setCamera] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const emit = useCallback((text: string) => {
    const t = text.trim();
    if (!t) return;
    const now = Date.now();
    // Bir xil kodni ketma-ket ikki marta yubormaslik
    if (lastRef.current.text === t && now - lastRef.current.at < 2500) return;
    lastRef.current = { text: t, at: now };
    if (navigator.vibrate) navigator.vibrate(60);
    onScanRef.current(t);
  }, []);

  useEffect(() => {
    if (!camera || disabled) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamError("Bu brauzerda kamera ishlamaydi (HTTPS yoki localhost kerak). Kodni qo'lda kiriting.");
        setCamera(false);
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
          audio: false,
        });
      } catch {
        setCamError("Kameraga ruxsat berilmadi. Kodni qo'lda kiriting.");
        setCamera(false);
        return;
      }
      if (stopped) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play().catch(() => {});

      const Ctor = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
      const detector = Ctor ? new Ctor({ formats: ["qr_code"] }) : null;
      const jsQR = detector ? null : (await import("jsqr")).default;
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      const tick = async () => {
        if (stopped) return;
        if (video.readyState >= 2) {
          try {
            if (detector) {
              const codes = await detector.detect(video);
              if (codes[0]?.rawValue) emit(codes[0].rawValue);
            } else if (jsQR && ctx) {
              const w = 480;
              const h = Math.round((video.videoHeight / video.videoWidth) * w) || 360;
              canvas.width = w;
              canvas.height = h;
              ctx.drawImage(video, 0, 0, w, h);
              const img = ctx.getImageData(0, 0, w, h);
              const res = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" });
              if (res?.data) emit(res.data);
            }
          } catch {
            // kadr o'qilmadi — keyingisini kutamiz
          }
        }
        raf = window.setTimeout(() => requestAnimationFrame(tick), 120);
      };
      tick();
    })();

    return () => {
      stopped = true;
      window.clearTimeout(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [camera, disabled, emit]);

  return (
    <div className="space-y-3">
      {camera ? (
        <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-2xl bg-ink">
          <video ref={videoRef} playsInline muted className="size-full object-cover" />
          <div className="pointer-events-none absolute inset-[14%] rounded-2xl border-[3px] border-gold-400/90 shadow-[0_0_0_9999px_rgb(0_0_0/0.35)]">
            <div className="absolute inset-x-3 top-1/2 h-0.5 animate-pulse bg-gold-400" />
          </div>
          <button
            type="button"
            onClick={() => setCamera(false)}
            className="absolute right-3 top-3 grid size-10 place-items-center rounded-full bg-black/50 text-white"
            aria-label="Kamerani o'chirish"
          >
            <CameraOff className="size-5" />
          </button>
          <canvas ref={canvasRef} className="hidden" />
        </div>
      ) : (
        !compact && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setCamError(null);
              setCamera(true);
            }}
            className={cn(
              "group flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/50 px-6 py-10",
              "text-brand-700 transition-colors hover:border-brand-500 hover:bg-brand-50 disabled:opacity-50",
            )}
          >
            <span className="grid size-16 place-items-center rounded-2xl bg-brand-700 text-white shadow-pop transition-transform group-hover:scale-105">
              <ScanLine className="size-8" />
            </span>
            <span className="font-semibold">{label}</span>
            <span className="flex items-center gap-1.5 text-sm text-muted">
              <Camera className="size-4" /> Kamerani yoqish
            </span>
          </button>
        )
      )}

      {camError && <p className="text-sm font-medium text-warn-600">{camError}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          lastRef.current = { text: "", at: 0 };
          emit(manual);
          setManual("");
          inputRef.current?.focus();
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Keyboard className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            ref={inputRef}
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            disabled={disabled}
            placeholder={placeholder}
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            className={cn(inputClass, "pl-10 font-mono")}
          />
        </div>
        <button type="submit" disabled={disabled || !manual.trim()} className={buttonClass("primary")}>
          OK
        </button>
        {compact && !camera && (
          <button
            type="button"
            onClick={() => {
              setCamError(null);
              setCamera(true);
            }}
            disabled={disabled}
            className={buttonClass("secondary")}
            aria-label="Kamera"
          >
            <Camera className="size-4" />
          </button>
        )}
      </form>
    </div>
  );
}
