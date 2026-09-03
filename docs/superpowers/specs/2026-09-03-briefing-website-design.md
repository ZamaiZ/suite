# Briefing Website — Design

## Objetivo

Novo step `website` após `finance` para capturar identidade visual (logo + inventário + uploads), política de cores e referências de sites (gosta / não gosta) — UI em cards, autosave/complete no padrão dos steps existentes.

## Decisões

- Logo: `have_file` | `use_current_site` | `create_new` | `none`; upload obrigatório só se `have_file`.
- Cores: só política em cards — `keep_current` | `follow_brand` | `refresh_ok` | `open` (sem hex/picker).
- Inventário sim/não: brand book, ícones, paleta documentada, outras guidelines.
- Uploads: logo SVG/PNG (máx. 3, 2 MB); brand book PDF (1, 10 MB); ícones SVG/PNG (máx. 10, 2 MB). Fotos institucionais fora de escopo.
- Se inventário brand book/ícones = `yes`: exige upload **ou** ≥1 `assetLinks`.
- Sites: ≥1 URL válida em liked e disliked (domínio normalizado → `https://domain`).
- Notes opcional. Limpeza de Storage só em remove explícito e ao limpar refs no sanitize; sem GC em background.

## Payload

```ts
{
  logoStatus: "have_file" | "use_current_site" | "create_new" | "none" | null
  logos: BriefingAssetRef[]
  brandBook: BriefingAssetRef | null
  iconKit: BriefingAssetRef[]
  assetInventory: {
    brandBook: "yes" | "no" | null
    icons: "yes" | "no" | null
    documentedPalette: "yes" | "no" | null
    otherGuidelines: "yes" | "no" | null
  }
  assetLinks: string[]
  colorPolicy: "keep_current" | "follow_brand" | "refresh_ok" | "open" | null
  likedSites: string[]
  dislikedSites: string[]
  notes: string
}
```

`BriefingAssetRef`: `{ id, kind: "logo" | "brand_book" | "icon", fileName, mimeType, sizeBytes, storagePath }`.

## Complete

`isWebsiteReadyToComplete(payload)`:

1. `logoStatus` preenchido.
2. Se `have_file` → ≥1 logo válido.
3. Quatro campos do inventário ≠ `null`.
4. Se brand book/ícones = `yes` → arquivo correspondente **ou** ≥1 `assetLinks`.
5. `colorPolicy` preenchido.
6. ≥1 liked e ≥1 disliked com URL válida.
7. `notes` nunca obrigatório.

Sanitize: zera `logos` se ≠ `have_file`; zera brandBook/iconKit quando inventário = `no`; normaliza listas de sites e links.

## Persistência

Linha em `client_briefing_steps` com `step = 'website'`. Bytes no bucket Storage `briefing-assets` via Server Actions do portal (admin client). Jsonb guarda só metadados dos assets.
