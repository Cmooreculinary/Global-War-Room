// BillingSuccessPage — landing after Stripe checkout; polls for paid status.
import React, { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";

import Layout from "@/components/Layout";
import { getCheckoutStatus } from "@/lib/api";

const POLL_INTERVAL_MS = 1800;
const MAX_ATTEMPTS = 8;

export default function BillingSuccessPage() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const [state, setState] = useState("checking"); // checking | paid | failed | timeout
  const [error, setError] = useState("");
  const attemptsRef = useRef(0);

  useEffect(() => {
    if (!sessionId) {
      setState("failed");
      setError("Missing session id.");
      return undefined;
    }
    let timer = null;
    let alive = true;

    const tick = async () => {
      try {
        const result = await getCheckoutStatus(sessionId);
        if (!alive) return;
        if (result.payment_status === "paid") {
          setState("paid");
          return;
        }
        if (result.status === "expired") {
          setState("failed");
          setError("Your checkout session expired. Please try again.");
          return;
        }
        attemptsRef.current += 1;
        if (attemptsRef.current >= MAX_ATTEMPTS) {
          setState("timeout");
          return;
        }
        timer = setTimeout(tick, POLL_INTERVAL_MS);
      } catch (e) {
        if (!alive) return;
        setState("failed");
        setError(e?.response?.data?.detail || "Could not verify your payment.");
      }
    };
    tick();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [sessionId]);

  return (
    <Layout>
      <section
        className="mx-auto max-w-xl px-6 py-24 text-center"
        data-testid="billing-success-page"
      >
        {state === "checking" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
            <p className="smallcaps text-ash animate-pulse">The clerk is recording your seat…</p>
            <h1 className="cortex-display mt-4 text-3xl italic text-pearl md:text-4xl">
              Verifying your membership.
            </h1>
            <p className="cortex-editorial mt-4 text-bone/70 italic">
              This usually takes a moment.
            </p>
          </motion.div>
        )}

        {state === "paid" && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            data-testid="billing-paid"
          >
            <div
              className="mx-auto mb-7 flex h-20 w-20 items-center justify-center rounded-full border-2"
              style={{ borderColor: "#C9A961", boxShadow: "0 0 32px rgba(201,169,97,0.5)" }}
              aria-hidden
            >
              <span style={{ color: "#FFE5B4", fontSize: "1.6rem" }}>✓</span>
            </div>
            <p className="smallcaps" style={{ color: "#C9A961" }}>You are seated</p>
            <h1 className="cortex-display mt-3 text-3xl italic text-pearl md:text-4xl">
              Welcome to the bench.
            </h1>
            <p className="cortex-editorial mt-5 text-bone/85 italic">
              Your membership is active. The full council, every chamber, every court — they convene at your word.
            </p>
            <Link
              to="/cortex"
              className="cortex-ui mt-9 inline-flex items-center gap-2 border px-6 py-3 text-sm transition-colors hover:bg-carbon/40"
              style={{ borderColor: "#C9A961", color: "#FFE5B4", borderRadius: 2 }}
              data-testid="billing-back-to-cortex"
            >
              Bring your first matter →
            </Link>
          </motion.div>
        )}

        {(state === "failed" || state === "timeout") && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
            <p className="smallcaps text-ash">The clerk's office</p>
            <h1 className="cortex-display mt-3 text-3xl italic text-pearl md:text-4xl">
              {state === "timeout"
                ? "We couldn't confirm in time."
                : "We couldn't confirm your payment."}
            </h1>
            {error && (
              <p className="cortex-editorial mt-4 text-bone/70 italic">{error}</p>
            )}
            <p className="cortex-editorial mt-4 text-bone/70 italic">
              If your card was charged, your membership will activate shortly. Refresh in a moment, or reach out for help.
            </p>
            <Link
              to="/pricing"
              className="smallcaps mt-8 inline-block border-b border-bone/40 pb-0.5 text-bone hover:border-bone"
              data-testid="billing-retry"
            >
              Back to membership
            </Link>
          </motion.div>
        )}
      </section>
    </Layout>
  );
}
