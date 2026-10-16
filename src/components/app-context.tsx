"use client";

import { createContext, useContext, useMemo } from "react";
import type { Directory, Team, Person } from "@/lib/data";
import type { Me } from "@/lib/perm";

export type Settings = {
  teamName: string;
  currency: string;
  season: string;
  seasonStart: string;
  expenseCategories: string[];
  incomeCategories: string[];
  labels: string[];
};

type Ctx = {
  me: Me;
  dir: Directory;
  settings: Settings;
  team: (id: string | null | undefined) => Team | undefined;
  person: (id: string | null | undefined) => Person | undefined;
  project: (id: string | null | undefined) => Directory["projects"][number] | undefined;
  taskKey: (t: { number: number; subteamId: string }) => string;
  activePeople: Person[];
};

const C = createContext<Ctx | null>(null);

export function AppProvider({ me, dir, settings, children }: { me: Me; dir: Directory; settings: Settings; children: React.ReactNode }) {
  const value = useMemo<Ctx>(() => {
    const teams = new Map(dir.teams.map((t) => [t.id, t]));
    const people = new Map(dir.people.map((p) => [p.id, p]));
    const projects = new Map(dir.projects.map((p) => [p.id, p]));
    return {
      me,
      dir,
      settings,
      team: (id) => (id ? teams.get(id) : undefined),
      person: (id) => (id ? people.get(id) : undefined),
      project: (id) => (id ? projects.get(id) : undefined),
      taskKey: (t) => `${teams.get(t.subteamId)?.code ?? "T"}-${t.number}`,
      activePeople: dir.people.filter((p) => p.active),
    };
  }, [me, dir, settings]);
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useApp() {
  const v = useContext(C);
  if (!v) throw new Error("useApp outside AppProvider");
  return v;
}
