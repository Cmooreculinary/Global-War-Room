// PricingPage — the single membership offer.
// 5 free verdicts, then $10/month for unlimited.
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";

import Layout from "@/components/Layout";
import { fetchEntitlement, fetchPlans, startCheckout } from "@/lib/api";

export default function PricingPage() {
  const [plans, setPlans] = useState([]);
  const [freeLimit, setFreeLimit] = useState(5);
  const [entitlement, setEntitlement] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchPlans(), fetchEntitlement()])
      .then(([p, e]) => {
        if (!alive) return;
        setPlans(p.plans || []);
        setFreeLimit(p.free_limit || 5);
        setEntitlement(e);
      })
      .catch(() => {
        if (!alive) return;
        toast.error("Could not load membership details.");
      });
    return () => {
      alive = false;
    };
  }, []);

  const onSubscribe = async (planId) => {
    setLoading(true);
    try {
      const { url } = await startCheckout(planId);
      window.location.href = url;
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not start checkout.");
      setLoading(false);
    }
  };

  const monthly = plans.find((p) => p.id === "membership_monthly");

  return (
    <Layout>
      <section className="mx-auto max-w-3xl px-6 pb-24 pt-16 md:pt-24" data-testid="pricing-page">
        <header className="text-center">
          <p className="smallcaps text-ash">Membership</p>
          <h1
            className="cortex-display mt-3 text-4xl tracking-tight text-pearl md:text-6xl"
            style={{ fontWeight: 700 }}
            data-testid="pricing-title"
          >
            Take your seat at the bench.
          </h1>
          <p className="cortex-display mx-auto mt-5 max-w-xl text-xl italic text-bone/85 md:text-2xl">
            Five verdicts on the house. After that, unlimited for the price of dinner.
          </p>
        </header>

        {entitlement?.is_member && (
          <div
            className="mx-auto mt-12 max-w-md border bg-carbon/70 p-5 text-center"
            style={{ borderColor: "#C9A96177", borderRadius: 2 }}
            data-testid="pricing-already-member"
          >
            <p className="smallcaps" style={{ color: "#C9A961" }}>You are seated</p>
            <p className="cortex-display italic mt-2 text-pearl">
              Membership active. Convene as often as the matter demands.
            </p>
            <Link
              to="/cortex"
              className="smallcaps mt-4 inline-block border-b border-bone/30 pb-0.5 text-bone hover:border-bone/60"
              data-testid="pricing-back-to-cortex"
            >
              Back to the cortex →
            </Link>
          </div>
        )}

        {!entitlement?.is_member && (
          <div className="mt-14 grid gap-6 md:grid-cols-2">
            {/* Free tier card */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="border bg-carbon/55 p-7"
              style={{ borderColor: "#2A2A36", borderRadius: 2 }}
              data-testid="plan-free"
            >
              <p className="smallcaps text-ash">The Gallery</p>
              <p className="cortex-display mt-2 text-3xl text-pearl" style={{ fontWeight: 600 }}>
                Free
              </p>
              <p className="cortex-editorial mt-1 text-sm text-bone/70">
                For curious minds.
              </p>
              <ul className="cortex-editorial mt-6 space-y-2 text-bone/85">
                <Bullet>{freeLimit} verdicts, on the house.</Bullet>
                <Bullet>Full council deliberation.</Bullet>
                <Bullet>Voice the verdict aloud.</Bullet>
                <Bullet>Save what matters to your archive.</Bullet>
              </ul>
              <p className="smallcaps mt-7 text-ash">
                {entitlement
                  ? `${entitlement.free_remaining} of ${freeLimit} remaining`
                  : "—"}
              </p>
            </motion.div>

            {/* Membership card — featured */}
            {monthly && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.1 }}
                className="relative border-2 bg-carbon/80 p-7"
                style={{
                  borderColor: "#C9A961",
                  borderRadius: 2,
                  boxShadow: "0 0 50px rgba(201,169,97,0.18)",
                }}
                data-testid="plan-membership"
              >
                <span
                  className="absolute -top-3 left-6 cortex-ui px-3 py-0.5 text-xs"
                  style={{
                    background: "#0B0B10",
                    color: "#FFE5B4",
                    border: "1px solid #C9A961",
                    letterSpacing: "0.18em",
                  }}
                >
                  RECOMMENDED
                </span>
                <p className="smallcaps" style={{ color: "#C9A961" }}>
                  {monthly.label}
                </p>
                <p className="cortex-display mt-2 text-pearl" style={{ fontWeight: 600 }}>
                  <span className="text-4xl">${monthly.price_usd.toFixed(0)}</span>
                  <span className="cortex-editorial italic ml-2 text-base text-bone/70">
                    / month
                  </span>
                </p>
                <p className="cortex-editorial mt-1 text-sm text-bone/70">
                  {monthly.blurb}
                </p>
                <ul className="cortex-editorial mt-6 space-y-2 text-bone/90">
                  <Bullet glow>Unlimited verdicts.</Bullet>
                  <Bullet glow>Convene a court — invite witnesses.</Bullet>
                  <Bullet glow>The full bench, every chamber.</Bullet>
                  <Bullet glow>Cancel anytime, with no script.</Bullet>
                </ul>
                <button
                  onClick={() => onSubscribe(monthly.id)}
                  disabled={loading}
                  className="mt-7 inline-flex w-full items-center justify-center gap-3 border px-6 py-3.5 transition-all duration-300 disabled:opacity-50"
                  style={{
                    borderColor: "#C9A961",
                    color: "#FFE5B4",
                    backgroundColor: "rgba(139,26,26,0.22)",
                    borderRadius: 2,
                    letterSpacing: "0.16em",
                    fontFamily: "'Cormorant Garamond', serif",
                    fontStyle: "italic",
                    fontWeight: 600,
                  }}
                  data-testid="subscribe-button"
                >
                  {loading ? "Approaching the bench…" : "Become a member"}
                </button>
                <p className="cortex-editorial mt-3 text-center text-xs italic text-bone/55">
                  Secure checkout via Stripe. Test card: 4242 4242 4242 4242.
                </p>
              </motion.div>
            )}
          </div>
        )}

        <div className="mt-14 text-center">
          <Link
            to="/cortex"
            className="smallcaps text-ash hover:text-bone transition-colors"
            data-testid="pricing-cortex-link"
          >
            ← Back to the cortex
          </Link>
        </div>
      </section>
    </Layout>
  );
}

function Bullet({ children, glow }) {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden
        className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full shrink-0"
        style={{
          background: glow ? "#C9A961" : "#6B6B78",
          boxShadow: glow ? "0 0 8px rgba(201,169,97,0.6)" : "none",
        }}
      />
      <span>{children}</span>
    </li>
  );
}
