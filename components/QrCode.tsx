import QRCode from "qrcode";

// Server komponenti: QR kodni SVG sifatida chizadi (tashqi so'rovsiz).
export async function QrCode({ text, size = 160, className }: { text: string; size?: number; className?: string }) {
  const svg = await QRCode.toString(text, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#122354", light: "#ffffff" } });
  return (
    <div
      className={className}
      style={{ width: size, height: size }}
      aria-label="QR kod"
      role="img"
      dangerouslySetInnerHTML={{ __html: svg.replace("<svg", '<svg width="100%" height="100%"') }}
    />
  );
}
