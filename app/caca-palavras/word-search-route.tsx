"use client";

import dynamic from "next/dynamic";

export const WordSearchRoute = dynamic(
  () => import("./word-search-game").then((module) => module.WordSearchGame),
  { ssr: false },
);
