import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Aksjeinnsikt", template: "%s · Aksjeinnsikt" },
  description: "Hva kunder, ansatte og markedet faktisk mener om selskapene du vurderer.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0e141b" },
  ],
};

// Setter tema før første maling for å unngå blink. Valget lagres i localStorage.
const themeScript = `(function(){try{var t=localStorage.getItem('tema');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="nb" suppressHydrationWarning className="h-full antialiased">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
