/** Three core DEVCITY brand colors. Neutrals and semantic colors live in CSS. */
export const BRAND = {
  primary: "#B86543",
  secondary: "#1C2925",
  accent: "#E79818",
  paper: "#FFFCF4",
  ink: "#30211D",
} as const;

export type BrandRole = "primary" | "secondary" | "accent";
