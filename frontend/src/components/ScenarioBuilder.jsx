// Choose who plays whom.
//
// Everything the room can do is one primitive: a list of actors, each with the
// teams advising it. The presets just fill that in — "play the United States"
// is every team on one actor, "US vs China" is the teams split across two. Any
// arrangement the user invents runs on exactly the same engine.
import React, { useMemo, useState } from "react";

import TeamRoster from "./TeamRoster";

const ACCENT = "#D6C08A";
const MAX_ACTORS = 4;

export const PRESETS = [
  {
    id: "projection",
    label: "Projection",
    blurb: "Each team forecasts the next five years independently, then the forecasts are read against each other.",
    kind: "projection",
  },
  {
    id: "play_us",
    label: "Play the United States",
    blurb: "All five teams sit as one war council advising Washington. They will not agree.",
    kind: "scenario",
    actors: ["United States"],
  },
  {
    id: "play_china",
    label: "Play China",
    blurb: "The same five teams, now advising Beijing. Watch which arguments change and which do not.",
    kind: "scenario",
    actors: ["China"],
  },
  {
    id: "us_v_china",
    label: "United States vs China",
    blurb: "Teams split between the two, each side played as hard as its advisers would play it.",
    kind: "scenario",
    actors: ["United States", "China"],
    split: true,
  },
  {
    id: "custom",
    label: "Custom",
    blurb: "Name your own actors and deal the teams out however you like.",
    kind: "scenario",
    actors: ["", ""],
  },
];

function dealTeams(teamIds, actorCount) {
  // Round-robin so a two-sided game gets a genuine mix of doctrines per side
  // rather than, say, every cautious commander on one bench.
  const out = Array.from({ length: actorCount }, () => []);
  teamIds.forEach((id, i) => out[i % actorCount].push(id));
  return out;
}

export default function ScenarioBuilder({ teams, horizon, onHorizonChange, onRun, running }) {
  const allIds = useMemo(() => teams.map((t) => t.id), [teams]);
  const [presetId, setPresetId] = useState("projection");
  const [actors, setActors] = useState([{ actor: "United States", teams: allIds }]);

  const preset = PRESETS.find((p) => p.id === presetId) || PRESETS[0];

  const applyPreset = (p) => {
    setPresetId(p.id);
    if (p.kind === "projection") return;
    const names = p.actors || [""];
    const dealt = p.split ? dealTeams(allIds, names.length) : names.map((_, i) => (i === 0 ? allIds : []));
    setActors(names.map((name, i) => ({ actor: name, teams: dealt[i] || [] })));
  };

  const setActorName = (i, name) =>
    setActors((prev) => prev.map((a, j) => (j === i ? { ...a, actor: name } : a)));

  const toggleTeam = (actorIndex, teamId) =>
    setActors((prev) =>
      prev.map((a, j) => {
        if (j === actorIndex) {
          const has = a.teams.includes(teamId);
          return { ...a, teams: has ? a.teams.filter((t) => t !== teamId) : [...a.teams, teamId] };
        }
        // A team can only advise one side — taking it here removes it there.
        return { ...a, teams: a.teams.filter((t) => t !== teamId) };
      })
    );

  const addActor = () =>
    setActors((prev) => (prev.length >= MAX_ACTORS ? prev : [...prev, { actor: "", teams: [] }]));
  const removeActor = (i) => setActors((prev) => prev.filter((_, j) => j !== i));

  const playable =
    preset.kind === "projection" ||
    actors.filter((a) => a.actor.trim() && a.teams.length > 0).length > 0;

  const run = () => {
    if (!playable || running) return;
    if (preset.kind === "projection") {
      onRun({ kind: "projection" });
      return;
    }
    onRun({
      kind: "scenario",
      assignments: actors
        .filter((a) => a.actor.trim() && a.teams.length > 0)
        .map((a) => ({ actor: a.actor.trim(), teams: a.teams })),
    });
  };

  return (
    <div data-testid="scenario-builder">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => applyPreset(p)}
            disabled={running}
            className="cortex-ui border px-4 py-2 text-sm transition-colors disabled:opacity-40"
            style={{
              borderColor: presetId === p.id ? ACCENT : "#2A2A36",
              color: presetId === p.id ? ACCENT : "#E8E4DC",
              background: presetId === p.id ? "rgba(214,192,138,0.10)" : "transparent",
              borderRadius: 2,
            }}
            data-testid={`preset-${p.id}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <p className="cortex-editorial mt-3 text-sm text-bone/70">{preset.blurb}</p>

      {preset.kind === "scenario" && (
        <div className="mt-6 space-y-5">
          {actors.map((actor, i) => (
            <div
              key={i}
              className="border p-5"
              style={{ borderColor: "#2A2A36", borderRadius: 3, background: "rgba(20,20,28,0.45)" }}
              data-testid={`actor-${i}`}
            >
              <div className="flex items-center gap-3">
                <input
                  value={actor.actor}
                  onChange={(e) => setActorName(i, e.target.value)}
                  disabled={running}
                  placeholder="Name the actor — a state, a bloc, an alliance"
                  className="cortex-editorial flex-1 border bg-transparent px-4 py-2.5 text-bone placeholder:text-ash focus:outline-none"
                  style={{ borderColor: `${ACCENT}44`, borderRadius: 2 }}
                  data-testid={`actor-name-${i}`}
                />
                {actors.length > 1 && (
                  <button
                    onClick={() => removeActor(i)}
                    disabled={running}
                    className="smallcaps text-ash transition-colors hover:text-bone"
                    data-testid={`remove-actor-${i}`}
                  >
                    remove
                  </button>
                )}
              </div>
              <p className="smallcaps mt-4 text-ash">
                Advised by {actor.teams.length || "no"} {actor.teams.length === 1 ? "team" : "teams"}
              </p>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {teams.map((team) => (
                  <TeamRoster
                    key={team.id}
                    team={team}
                    selectable
                    selected={actor.teams.includes(team.id)}
                    onToggle={() => !running && toggleTeam(i, team.id)}
                  />
                ))}
              </div>
            </div>
          ))}

          {actors.length < MAX_ACTORS && (
            <button
              onClick={addActor}
              disabled={running}
              className="smallcaps text-ash transition-colors hover:text-bone disabled:opacity-40"
              data-testid="add-actor"
            >
              + Add another actor
            </button>
          )}
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-5 border-t pt-6" style={{ borderColor: "#2A2A36" }}>
        <div className="flex items-center gap-2">
          <span className="smallcaps text-ash">Horizon</span>
          <select
            value={horizon}
            onChange={(e) => onHorizonChange(Number(e.target.value))}
            disabled={running}
            className="cortex-ui border bg-transparent px-2 py-1 text-sm text-bone focus:outline-none disabled:opacity-40"
            style={{ borderColor: "#2A2A36", borderRadius: 2 }}
            data-testid="horizon-select"
          >
            {[3, 5, 7, 10].map((y) => (
              <option key={y} value={y} className="bg-carbon">
                {y} years
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={run}
          disabled={!playable || running}
          className="cortex-ui inline-flex items-center border px-7 py-3 text-sm tracking-wide transition-all disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            borderColor: ACCENT,
            backgroundColor: "rgba(30,42,51,0.6)",
            color: ACCENT,
            boxShadow: "0 0 24px rgba(214,192,138,0.30)",
            borderRadius: 2,
          }}
          data-testid="run-scenario"
        >
          {running
            ? "Running…"
            : preset.kind === "projection"
            ? "Take the projections"
            : "Play it out"}
        </button>

        <span className="smallcaps text-ash">
          {preset.kind === "projection"
            ? "One forecast per team, then compared"
            : `${horizon} years, played one at a time`}
        </span>
      </div>
    </div>
  );
}
