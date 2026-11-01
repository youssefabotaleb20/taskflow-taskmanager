/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}

import "@tanstack/react-query";
import type { ApiError } from "./lib/api";

declare module "@tanstack/react-query" {
  interface Register {
    defaultError: ApiError;
  }
}
