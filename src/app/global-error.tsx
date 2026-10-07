"use client";

// Vises bare hvis selve rotoppsettet feiler. Har egne <html> og <body>.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="nb">
      <body style={{ fontFamily: "Aptos, system-ui, sans-serif", padding: "4rem 1rem", textAlign: "center" }}>
        <h1 style={{ fontSize: 20 }}>Noe gikk galt</h1>
        <p style={{ color: "#5d6b7c" }}>Last siden på nytt, eller prøv igjen om litt.</p>
        <button onClick={reset} style={{ marginTop: 16, padding: "8px 14px" }}>
          Prøv igjen
        </button>
      </body>
    </html>
  );
}
