import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";

import "@/App.css";
import SplashLanding from "@/pages/SplashLanding";
import Landing from "@/pages/Landing";
import ChamberPage from "@/pages/ChamberPage";
import CourtPage from "@/pages/CourtPage";
import ForgePage from "@/pages/ForgePage";
import VerdictPage from "@/pages/VerdictPage";
import ArchivePage from "@/pages/ArchivePage";
import AboutPage from "@/pages/AboutPage";
import ReceiptsPage from "@/pages/ReceiptsPage";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Toaster
          position="bottom-center"
          theme="dark"
          toastOptions={{
            style: {
              background: "#14141C",
              color: "#E8E4DC",
              border: "1px solid #2A2A36",
              fontFamily: "'DM Sans', sans-serif",
              borderRadius: 2,
            },
          }}
        />
        <Routes>
          <Route path="/" element={<SplashLanding />} />
          <Route path="/cortex" element={<Landing />} />
          <Route path="/court/:sessionId" element={<CourtPage />} />
          <Route path="/forge" element={<ForgePage />} />
          <Route path="/chamber/:id" element={<ChamberPage />} />
          <Route path="/chamber/forge" element={<Navigate to="/forge" replace />} />
          <Route path="/verdict/:id" element={<VerdictPage />} />
          <Route path="/archive" element={<ArchivePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/receipts" element={<ReceiptsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
