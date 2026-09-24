"use client";

import { createContext, useContext } from "react";

/** Icon data: URLs keyed by raw process name, provided by the dashboard. */
export const IconContext = createContext<Record<string, string>>({});

export function useIcon(process: string): string | undefined {
  return useContext(IconContext)[process];
}
