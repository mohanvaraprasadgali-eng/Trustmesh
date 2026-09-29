import type { Metadata } from "next";
import "./globals.css";
import { Web3Provider } from "@/context/Web3Context";
import { NotificationProvider } from "@/context/NotificationContext";
import { Navbar } from "@/components/Navbar";

export const metadata: Metadata = {
  title: "TrustMesh | Trust the Agent. Verify the Work.",
  description:
    "A blockchain-backed trust layer for AI agents on MST Blockchain that enables agent identity, task execution, independent verification, verifiable reputation, proof of work, escrow, and conditional payment.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-[#070a13] text-[#f8fafc] min-h-screen flex flex-col">
        <NotificationProvider>
          <Web3Provider>
            <Navbar />
            <div className="flex-1">{children}</div>
            <footer className="border-t border-white/10 bg-[#070a13]/95 py-6 px-8 text-xs text-gray-500 font-mono">
              <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
                <div>
                  TrustMesh Protocol • Built for <strong>MST Blockchain AI & Web3 Hackathon</strong>
                </div>
                <div className="flex items-center gap-6">
                  <a
                    href="https://mstscan.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-[#00f2fe] transition"
                  >
                    MSTScan Explorer
                  </a>
                  <a
                    href="http://localhost:8000/docs"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-[#00f2fe] transition"
                  >
                    FastAPI OpenAPI Specs
                  </a>
                  <span>Chain ID: 91562037 / 4545</span>
                </div>
              </div>
            </footer>
          </Web3Provider>
        </NotificationProvider>
      </body>
    </html>
  );
}
