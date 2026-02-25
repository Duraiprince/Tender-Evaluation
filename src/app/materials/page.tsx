"use client";

import AppLayout from "@/components/AppLayout";
import { useRouter } from "next/navigation";
import { useState, useRef } from "react";
import JSZip from "jszip";
import { setBidderZip } from "@/lib/bidder-store";
import { setNitZip } from "@/lib/nit-store";

export default function MaterialsPage() {
  const router = useRouter();
  const [tenderName, setTenderName] = useState("");
  const [tenderNumber, setTenderNumber] = useState("");
  const [nitFile, setNitFile] = useState<File | null>(null);
  const [bidderFile, setBidderFile] = useState<File | null>(null);
  const [bidderNames, setBidderNames] = useState<string[]>([]);
  const [dragOverNit, setDragOverNit] = useState(false);
  const [dragOverBidder, setDragOverBidder] = useState(false);
  const nitInputRef = useRef<HTMLInputElement>(null);
  const bidderInputRef = useRef<HTMLInputElement>(null);

  const extractBidderNames = async (file: File) => {
    try {
      const zip = await JSZip.loadAsync(file);
      const secondLevelFolders = new Set<string>();
      zip.forEach((relativePath) => {
        const parts = relativePath.split("/").filter(Boolean);
        if (parts.length >= 2) {
          secondLevelFolders.add(parts[1]);
        }
      });
      const names = Array.from(secondLevelFolders).sort();
      setBidderNames(names);
    } catch {
      setBidderNames([]);
    }
  };

  const handleBidderFile = async (file: File | null) => {
    setBidderFile(file);
    if (file) {
      await extractBidderNames(file);
    } else {
      setBidderNames([]);
    }
  };

  const handleUploadAndEvaluate = () => {
    if (!tenderName.trim()) {
      alert("Please enter a Tender / Enquiry Name.");
      return;
    }
    if (!bidderFile) {
      alert("Please upload Bidder Offers ZIP file.");
      return;
    }
    setBidderZip(bidderFile);
    setNitZip(nitFile); // store NIT zip for tender page matching
    const id = tenderNumber.trim() || tenderName.trim().replace(/\s+/g, "-").toLowerCase();
    const params = new URLSearchParams({
      name: tenderName.trim(),
      number: tenderNumber.trim(),
      bidders: bidderNames.join(","),
    });
    router.push(`/materials/${encodeURIComponent(id)}?${params.toString()}`);
  };

  const handleDrop = (
    e: React.DragEvent,
    setter: (f: File | null) => void,
    setDrag: (v: boolean) => void
  ) => {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith(".zip")) setter(file);
  };

  return (
    <AppLayout>
      <div className="p-8 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">CPCL Tender AI</h1>
          <p className="text-sm text-gray-500 mt-1">
            Upload bidder documents and run AI-powered technical evaluation
          </p>
        </div>

        {/* Form fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Tender / Enquiry Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Mechanical Works for Storage Tanks"
              value={tenderName}
              onChange={(e) => setTenderName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Enquiry / Tender Number
            </label>
            <input
              type="text"
              placeholder="e.g. CPCLV25478"
              value={tenderNumber}
              onChange={(e) => setTenderNumber(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
        </div>

        {/* Upload zones */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* NIT Document Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tender / NIT Document (.zip)
              </label>
              <div
                onClick={() => nitInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverNit(true);
                }}
                onDragLeave={() => setDragOverNit(false)}
                onDrop={(e) => handleDrop(e, setNitFile, setDragOverNit)}
                className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-xl px-4 py-10 cursor-pointer transition-all ${
                  dragOverNit
                    ? "border-blue-400 bg-blue-50"
                    : nitFile
                    ? "border-green-300 bg-green-50"
                    : "border-gray-300 bg-white hover:border-gray-400"
                }`}
              >
                <input
                  ref={nitInputRef}
                  type="file"
                  accept=".zip"
                  className="hidden"
                  onChange={(e) => setNitFile(e.target.files?.[0] ?? null)}
                />
                {nitFile ? (
                  <>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 12l2 2 4-4" />
                      <circle cx="12" cy="12" r="10" />
                    </svg>
                    <span className="text-sm font-medium text-green-700 mt-2">{nitFile.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setNitFile(null);
                      }}
                      className="text-xs text-gray-400 hover:text-red-500 mt-1"
                    >
                      Remove
                    </button>
                  </>
                ) : (
                  <>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                    <span className="text-sm font-medium text-gray-700 mt-2">
                      Tender / NIT Document
                    </span>
                    <span className="text-xs text-gray-400 mt-0.5">
                      Optional — improves accuracy
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Bidder Offers Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bidder Offers (.zip) <span className="text-red-500">*</span>
              </label>
              <div
                onClick={() => bidderInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverBidder(true);
                }}
                onDragLeave={() => setDragOverBidder(false)}
                onDrop={(e) => handleDrop(e, handleBidderFile, setDragOverBidder)}
                className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-xl px-4 py-10 cursor-pointer transition-all ${
                  dragOverBidder
                    ? "border-blue-400 bg-blue-50"
                    : bidderFile
                    ? "border-green-300 bg-green-50"
                    : "border-gray-300 bg-white hover:border-gray-400"
                }`}
              >
                <input
                  ref={bidderInputRef}
                  type="file"
                  accept=".zip"
                  className="hidden"
                  onChange={(e) => handleBidderFile(e.target.files?.[0] ?? null)}
                />
                {bidderFile ? (
                  <>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 12l2 2 4-4" />
                      <circle cx="12" cy="12" r="10" />
                    </svg>
                    <span className="text-sm font-medium text-green-700 mt-2">{bidderFile.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleBidderFile(null);
                      }}
                      className="text-xs text-gray-400 hover:text-red-500 mt-1"
                    >
                      Remove
                    </button>
                  </>
                ) : (
                  <>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="M12 4v16" />
                      <path d="M2 12h20" />
                    </svg>
                    <span className="text-sm font-medium text-gray-700 mt-2">
                      All Bidder Offers ZIP
                    </span>
                    <span className="text-xs text-gray-400 mt-0.5">
                      One folder per bidder
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-400 mt-4">
            ZIP structure: Each top-level folder = one bidder. Files inside = their offer documents (PDF/XLSX/DOCX).
          </p>

          {bidderNames.length > 0 && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs font-medium text-blue-700 mb-2">
                {bidderNames.length} Bidder{bidderNames.length > 1 ? "s" : ""} detected:
              </p>
              <div className="flex flex-wrap gap-2">
                {bidderNames.map((b) => (
                  <span
                    key={b}
                    className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-white text-blue-800 border border-blue-200"
                  >
                    {b}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Upload Button */}
        <button
          onClick={handleUploadAndEvaluate}
          className="inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-lg px-6 py-3 transition-colors active:scale-[0.98]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Upload and Run Evaluation
        </button>
      </div>
    </AppLayout>
  );
}
