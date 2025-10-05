// Ambient declarations for Deno edge function remote imports so ESLint/TypeScript don't error.
// Minimal surface only; extend if needed.

declare module "https://deno.land/std@0.168.0/http/server.ts" {
  export function serve(handler: (req: Request) => Promise<Response> | Response): void;
}

declare module "https://deno.land/std@0.190.0/http/server.ts" {
  export function serve(handler: (req: Request) => Promise<Response> | Response): void;
}

declare module 'https://esm.sh/@supabase/supabase-js@2' {
  // Generic createClient stub; refine types if project later consumes edge function code.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Stub type for edge function compatibility
  export function createClient<DB = unknown>(url: string, key: string): any;
}
