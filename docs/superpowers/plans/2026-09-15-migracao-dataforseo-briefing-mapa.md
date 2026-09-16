# Migração para DataForSEO — Briefing e Mapa — Plano de Implementação

> **Para executores agênticos:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para executar task a task. Os passos usam checkbox (`- [ ]`).

**Goal:** Tirar o Google do briefing e do render de mapa, trocando autocomplete e geocoding pelo LocationIQ e os dois canvas pelo MapLibre.

**Architecture:** O DataForSEO não tem produto de geocoding, de autocomplete de endereço nem de tile — estes quatro pontos vão para o LocationIQ, que cobre os três com um provider só. O autocomplete do LocationIQ já devolve o endereço estruturado e a coordenada no mesmo resultado, o que **elimina a segunda chamada** que o `applyBriefingPlace` fazia ao Places. Os dois canvas viram MapLibre GL, com as faixas de cor e o tema lidos do `SHADCN_PALETTE`, como hoje.

**Tech Stack:** Next.js (App Router, Server Actions), TypeScript, LocationIQ (Autocomplete, Search, Maps), MapLibre GL JS, `node --test` sobre `.mjs`.

**Spec:** `../specs/2026-09-15-migracao-dataforseo-design.md`

**Cobre as ondas 3 e 4 da spec.** **Depende agora da Task 2 do plano
`2026-09-15-migracao-dataforseo-pipeline.md`**, que cria `lib/locationiq/client.ts`
— a onda 0 mediu que a busca de estabelecimento precisa de centroide, e isso
puxou o cliente do LocationIQ para a onda 1. As tasks daqui **acrescentam** a um
arquivo que já existe, em vez de criá-lo. A limpeza final está em
`2026-09-15-migracao-dataforseo-lighthouse.md`.

## Global Constraints

- **Módulo testável não usa alias nem `server-only`.** Import relativo com
  extensão. `lib/briefing/address.ts` importa por alias e **não** é carregável
  pelo `node --test` — por isso o parser novo nasce em `lib/locationiq/`, sem
  import nenhum, e a conversão para `ParsedBrazilianAddress` fica na action.
- **Nenhuma task commita.** Escreva os arquivos e pare.
- **Verificação uma vez, no fim** (Task 7). Os testes `.mjs` da própria task, sim.
- **Dois tokens, não um — e não porque o painel obrigue.** No LocationIQ os
  dois são "Data API token"; o que separa é a permissão marcada e a restrição
  por referrer. O de tiles vai ao navegador e fica visível no HTML, então ele
  tem só `Vector Map Tiles` e `Raster Map Tiles` e um referrer preenchido. O de
  geocoding tem só `GEOCODING` e nunca sai do servidor.
- **Idioma:** interface, comentário e mensagem de erro em português do Brasil.
- **Roda um teste só assim:**
  `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/caminho/arquivo.test.mjs`

---

## Estrutura de arquivos

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `lib/locationiq/address.ts` | resultado do LocationIQ → endereço brasileiro, **puro** | 1 |
| `lib/locationiq/client.ts` | **+** autocomplete (o geocoding já está lá) | 2 |
| `lib/locationiq/index.ts` | **+** os novos exports | 2 |
| `app/actions/briefing/suggest-addresses.ts` | action de sugestão | 3 |
| `components/custom/BriefingAddressSearch/` | campo de busca de endereço | 3 |
| `lib/briefing/geocode-address.ts` | coordenada do mapa de raio | 4 |
| `lib/maplibre/style.ts` | estilos claro e escuro | 5 |
| `components/custom/BriefingServiceRadiusMap/BriefingServiceRadiusMapCanvas.tsx` | raio de atendimento | 6 |
| `components/custom/LeadGbpPanel/LeadGbpGridMap.tsx` | malha geográfica | 7 |

**Deletados:** `applyBriefingPlace` de `app/actions/briefing/suggest-addresses.ts`
(Task 3), `lib/places/geocode.ts` (Task 4).

---

## Task 1: Parser de endereço do LocationIQ

**Files:**
- Create: `lib/locationiq/address.ts`
- Create: `lib/locationiq/address.test.mjs`

**Interfaces:**
- Consumes: nada. Zero imports, de propósito.
- Produces:
  - `type LocationIqAddress = { street: string; number: string; complement: string; neighborhood: string; city: string; stateName: string; postalCode: string }`
  - `addressFromLocationIq(address: unknown): LocationIqAddress`

- [ ] **Step 1: Escrever o teste que falha**

Crie `lib/locationiq/address.test.mjs`:

```js
import assert from "node:assert/strict"
import { test } from "node:test"

import { addressFromLocationIq } from "./address.ts"

/** Forma real do objeto `address` do autocomplete do LocationIQ. */
const PAULISTA = {
  name: "Avenida Paulista",
  house_number: "1578",
  road: "Avenida Paulista",
  suburb: "Bela Vista",
  city: "São Paulo",
  state: "São Paulo",
  postcode: "01310-200",
  country: "Brasil",
  country_code: "br",
}

test("lê rua, número, bairro, cidade, estado e CEP", () => {
  const parsed = addressFromLocationIq(PAULISTA)
  assert.equal(parsed.street, "Avenida Paulista")
  assert.equal(parsed.number, "1578")
  assert.equal(parsed.neighborhood, "Bela Vista")
  assert.equal(parsed.city, "São Paulo")
  assert.equal(parsed.stateName, "São Paulo")
  assert.equal(parsed.postalCode, "01310200")
})

test("o CEP sai só com dígitos, para casar com o que o formulário grava", () => {
  assert.equal(addressFromLocationIq({ postcode: "01310-200" }).postalCode, "01310200")
  assert.equal(addressFromLocationIq({ postcode: "cep 01310200" }).postalCode, "01310200")
})

test("neighbourhood britânico vale tanto quanto suburb", () => {
  assert.equal(
    addressFromLocationIq({ neighbourhood: "Pinheiros" }).neighborhood,
    "Pinheiros",
  )
  // `suburb` vence quando os dois vêm: é o mais específico dos dois no Brasil.
  assert.equal(
    addressFromLocationIq({ neighbourhood: "Zona Oeste", suburb: "Pinheiros" })
      .neighborhood,
    "Pinheiros",
  )
})

test("cai para town, village e municipality quando não há city", () => {
  assert.equal(addressFromLocationIq({ town: "Itu" }).city, "Itu")
  assert.equal(addressFromLocationIq({ village: "Cunha" }).city, "Cunha")
  assert.equal(addressFromLocationIq({ municipality: "Bertioga" }).city, "Bertioga")
})

test("entrada inválida vira endereço vazio, nunca erro", () => {
  const vazio = addressFromLocationIq(null)
  assert.equal(vazio.street, "")
  assert.equal(vazio.city, "")
  assert.deepEqual(addressFromLocationIq("nada"), vazio)
})
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/locationiq/address.test.mjs
```

Esperado: FAIL com `Cannot find module './address.ts'`.

- [ ] **Step 3: Implementar**

Crie `lib/locationiq/address.ts`:

```ts
/**
 * Objeto `address` do LocationIQ → campos do endereço brasileiro.
 *
 * Sem import nenhum, de propósito: `lib/briefing/address.ts` importa por alias
 * e não carrega no `node --test`. A conversão para `ParsedBrazilianAddress` e a
 * resolução de UF ficam na action, que já vive no mundo do bundler.
 *
 * O estado sai como **nome**, não como sigla: o LocationIQ devolve "São Paulo",
 * e traduzir aqui exigiria a tabela de estados, que é o import que este arquivo
 * não pode ter.
 */

export type LocationIqAddress = {
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  stateName: string
  postalCode: string
}

function text(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim()
    }
  }
  return ""
}

export function addressFromLocationIq(address: unknown): LocationIqAddress {
  const row =
    address && typeof address === "object" && !Array.isArray(address)
      ? (address as Record<string, unknown>)
      : {}

  return {
    street: text(row, "road", "pedestrian", "footway", "name"),
    number: text(row, "house_number"),
    complement: "",
    // `suburb` primeiro: no recorte brasileiro do OSM é ele que carrega o
    // bairro, e `neighbourhood` costuma trazer a zona, que é mais larga.
    neighborhood: text(row, "suburb", "neighbourhood", "quarter"),
    city: text(row, "city", "town", "village", "municipality", "county"),
    stateName: text(row, "state"),
    postalCode: text(row, "postcode").replace(/\D+/g, ""),
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/locationiq/address.test.mjs
```

Esperado: `# pass 5`.

---

## Task 2: Autocomplete no cliente do LocationIQ

**O cliente já existe.** `lib/locationiq/client.ts`, `lib/locationiq/index.ts` e
as variáveis de ambiente foram criados na Task 2 do plano do pipeline, com
`geocodeAddressText`, `getLocationIq`, `asCoordinate`, `locationIqKey` e os
tipos `LocationIqResult` e `Coordinates`. Esta task **acrescenta** o
autocomplete; não reescreve o arquivo.

**Files:**
- Modify: `lib/locationiq/client.ts`
- Modify: `lib/locationiq/index.ts`

**Interfaces:**
- Consumes: `addressFromLocationIq` (Task 1); `getLocationIq`, `asCoordinate`, `locationIqKey`, `LocationIqResult` do cliente existente.
- Produces:
  - `type BriefingAddressCandidate = { id: string; label: string; secondary: string | null; latitude: number; longitude: number; address: LocationIqAddress }`
  - `LOCATIONIQ_SUGGEST_MIN_CHARS: number`
  - `autocompleteAddresses(query: string): Promise<LocationIqResult<BriefingAddressCandidate[]>>`

- [ ] **Step 1: Conferir que a base está lá**

```bash
grep -n "export function locationIqKey\|export async function getLocationIq\|export function asCoordinate\|export async function geocodeAddressText" lib/locationiq/client.ts
```

Esperado: as quatro. Se faltarem, a Task 2 do plano do pipeline não rodou —
**pare** e execute aquele plano primeiro.

- [ ] **Step 1-b: Conferir as variáveis de ambiente**

Em `.env.example`, remova a seção `── Google Places (New) ──` inteira e a seção
`── Google Maps JavaScript ──` inteira, e acrescente:

```
# ── LocationIQ ─────────────────────────────────────────────────────────────────
# Provider único de geocoding, autocomplete de endereço e tiles de mapa. O
# DataForSEO não tem produto para nenhum dos três. Plano gratuito: 5.000
# requisições/dia, uso comercial permitido.
#
# São DOIS tokens, e os dois são "Data API token" no painel — o que muda entre
# eles são as PERMISSÕES marcadas e a restrição por referrer. A separação existe
# porque um vai ao navegador e o outro não:
#   - LOCATIONIQ_API_KEY: só GEOCODING marcado, sem referrer. Nunca sai daqui.
#   - NEXT_PUBLIC_LOCATIONIQ_MAPS_KEY: só Vector e Raster Map Tiles marcados, e
#     HTTP Referrers preenchido. Fica visível no HTML — restrito por referrer e
#     sem geocoding, não serve para mais nada se for copiado.
LOCATIONIQ_API_KEY=<your-locationiq-api-token>
NEXT_PUBLIC_LOCATIONIQ_MAPS_KEY=<your-locationiq-maps-access-token>
```

Peça ao dono do repositório para preencher as duas no `.env.local` antes da
Task 3 — sem elas a busca de endereço e o mapa ficam mudos, e o erro na tela
diz exatamente isso.

- [ ] **Step 2: Acrescentar o autocomplete ao cliente**

Em `lib/locationiq/client.ts`, acrescente ao que já existe. **Não recrie o
arquivo** — `geocodeAddressText`, `getLocationIq`, `asCoordinate`,
`locationIqKey` e os tipos ficam como estão.

```ts
import {
  addressFromLocationIq,
  type LocationIqAddress,
} from "@/lib/locationiq/address"

const AUTOCOMPLETE = "https://api.locationiq.com/v1/autocomplete"

export const LOCATIONIQ_SUGGEST_MIN_CHARS = 3

export type BriefingAddressCandidate = {
  id: string
  label: string
  secondary: string | null
  latitude: number
  longitude: number
  address: LocationIqAddress
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

export async function autocompleteAddresses(
  query: string,
): Promise<LocationIqResult<BriefingAddressCandidate[]>> {
  const key = locationIqKey()
  if (!key) return { status: "error", message: LOCATIONIQ_UNCONFIGURED }

  const trimmed = query.trim()
  if (trimmed.length < LOCATIONIQ_SUGGEST_MIN_CHARS) {
    return { status: "ok", data: [] }
  }

  const url = new URL(AUTOCOMPLETE)
  url.searchParams.set("key", key)
  url.searchParams.set("q", trimmed)
  url.searchParams.set("countrycodes", "br")
  url.searchParams.set("limit", "8")
  url.searchParams.set("normalizecity", "1")
  url.searchParams.set("accept-language", "pt")

  const result = await getLocationIq<unknown[]>(url)
  if (result.status === "error") {
    // Consulta sem resultado não é erro de busca: é lista vazia. O `getLocationIq`
    // traduz o 404 do fornecedor em mensagem, e aqui ela vira o vazio legítimo.
    return result.message.includes("localizar")
      ? { status: "ok", data: [] }
      : result
  }

  const rows = Array.isArray(result.data) ? result.data : []
  const candidates = rows.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return []
    const row = entry as Record<string, unknown>
    const id = asText(row.place_id) ?? asText(row.osm_id)
    const latitude = asCoordinate(row.lat)
    const longitude = asCoordinate(row.lon)
    const label = asText(row.display_place) ?? asText(row.display_name)
    if (!id || latitude === null || longitude === null || !label) return []
    return [
      {
        id,
        label,
        secondary: asText(row.display_address),
        latitude,
        longitude,
        address: addressFromLocationIq(row.address),
      },
    ]
  })

  return { status: "ok", data: candidates }
}
```

> Se `asText` já existir no arquivo com outro nome, use o que está lá em vez de
> declarar um segundo.

- [ ] **Step 3: Acrescentar os exports**

Em `lib/locationiq/index.ts`, junte ao que já existe:

```ts
export {
  LOCATIONIQ_SUGGEST_MIN_CHARS,
  autocompleteAddresses,
  type BriefingAddressCandidate,
} from "./client"
export {
  addressFromLocationIq,
  type LocationIqAddress,
} from "./address"
```

---

## Task 3: Briefing sem o Places

**Files:**
- Modify: `app/actions/briefing/suggest-addresses.ts`
- Modify: `app/actions/briefing/index.ts`
- Modify: `components/custom/BriefingAddressSearch/BriefingAddressSearch.types.ts`
- Modify: `components/custom/BriefingAddressSearch/BriefingAddressSearch.tsx`
- Modify: `components/custom/ClientBriefingCompanyForm/ClientBriefingCompanyForm.tsx:229-266,444-450`

**Interfaces:**
- Consumes: `autocompleteAddresses`, `BriefingAddressCandidate` (Task 2).
- Produces:
  - `suggestBriefingAddresses(input: { query: string; clientId?: string }): Promise<{ status: "success"; candidates: BriefingAddressCandidate[] } | { status: "error"; message: string } | { status: "unauthenticated" }>`

- [ ] **Step 1: Reescrever a action**

Substitua `app/actions/briefing/suggest-addresses.ts` inteiro:

```ts
"use server"

import { requireBriefingWriter } from "@/lib/briefing/writer"
import {
  autocompleteAddresses,
  LOCATIONIQ_SUGGEST_MIN_CHARS,
  type BriefingAddressCandidate,
} from "@/lib/locationiq"
import { z } from "zod"

/**
 * Uma chamada, não duas.
 *
 * O Places exigia autocomplete e depois detalhes, porque a sugestão vinha só
 * com texto. O autocomplete do LocationIQ já devolve endereço estruturado e
 * coordenada no mesmo resultado — então o `applyBriefingPlace`, que era a
 * segunda chamada, deixou de ter o que buscar e foi removido.
 */
export type SuggestBriefingAddressesState =
  | { status: "success"; candidates: BriefingAddressCandidate[] }
  | { status: "error"; message: string }
  | { status: "unauthenticated" }

const suggestSchema = z.object({
  query: z.string().trim().min(LOCATIONIQ_SUGGEST_MIN_CHARS).max(200),
})

export async function suggestBriefingAddresses(input: {
  query: string
  clientId?: string
}): Promise<SuggestBriefingAddressesState> {
  const loaded = await requireBriefingWriter(input.clientId)
  if (loaded.status !== "ok") return loaded

  const parsed = suggestSchema.safeParse({ query: input.query })
  if (!parsed.success) {
    return {
      status: "error",
      message: `Digite pelo menos ${LOCATIONIQ_SUGGEST_MIN_CHARS} caracteres.`,
    }
  }

  const result = await autocompleteAddresses(parsed.data.query)
  if (result.status === "error") {
    return { status: "error", message: result.message }
  }
  return { status: "success", candidates: result.data }
}
```

- [ ] **Step 2: Trocar os exports**

Em `app/actions/briefing/index.ts`, remova `applyBriefingPlace` da lista de
exports e mantenha `suggestBriefingAddresses`.

- [ ] **Step 3: Trocar as props do campo de busca**

`components/custom/BriefingAddressSearch/BriefingAddressSearch.types.ts`:

```ts
import type { BriefingAddressCandidate } from "@/lib/locationiq"

export type BriefingAddressSearchProps = {
  id: string
  value: string
  onValueChange: (value: string) => void
  onPick: (candidate: BriefingAddressCandidate) => void
  disabled?: boolean
  error?: string
}
```

Em `BriefingAddressSearch.tsx`, troque o import de `PLACES_SUGGEST_MIN_CHARS` e
`PlaceSuggestion` por `LOCATIONIQ_SUGGEST_MIN_CHARS` e
`BriefingAddressCandidate` de `"@/lib/locationiq"`, remova o `sessionToken` e
tudo que o gera, e ajuste os campos exibidos: `item.name` vira `item.label` e
`item.address` vira `item.secondary`. O typeahead **continua** aqui — o
autocomplete do LocationIQ é barato e feito para isso, ao contrário da busca de
estabelecimento.

- [ ] **Step 4: Ajustar o formulário**

Em `components/custom/ClientBriefingCompanyForm/ClientBriefingCompanyForm.tsx`,
substitua `handlePlacePick` por uma função síncrona — não há mais chamada:

```tsx
  function handlePlacePick(candidate: BriefingAddressCandidate) {
    const { address } = candidate
    const stateCode =
      BR_STATES.find(
        (state) =>
          state.name.localeCompare(address.stateName, "pt-BR", {
            sensitivity: "base",
          }) === 0,
      )?.code ?? ""

    const next = {
      street: address.street || payload.street,
      number: address.number || payload.number,
      complement: payload.complement,
      neighborhood: address.neighborhood || payload.neighborhood,
      city: address.city || payload.city,
      stateCode: stateCode || payload.stateCode,
      postalCode: address.postalCode || payload.postalCode,
    }
    patch({ ...next, formattedAddress: joinBrazilianAddress(next) })
  }
```

O horário **não** entra mais: o LocationIQ não devolve horário de funcionamento.
Com perfil do Google vinculado o horário continua vindo do snapshot, que é a
fonte melhor; sem perfil, o campo fica para o cliente preencher. Remova
`currentHours`, `snapshotHours` e o `...(result.hoursLines ? ... : {})`.

No JSX (linha ~444), troque:

```tsx
          <BriefingAddressSearch
            id="briefing-street-search"
            value={payload.street}
            onValueChange={(street) => patchAddress({ street })}
            onPick={handlePlacePick}
          />
```

Acrescente os imports no topo: `BR_STATES` de `"@/lib/br-locations"` e
`type BriefingAddressCandidate` de `"@/lib/locationiq"`. Remova o import de
`applyBriefingPlace`.

Se `sourceSnapshot` ficar sem uso no arquivo, **não o remova** — ele é prop do
componente e é usado em outros pontos. Confira antes:

```bash
grep -n "sourceSnapshot" components/custom/ClientBriefingCompanyForm/ClientBriefingCompanyForm.tsx
```

- [ ] **Step 5: Remover o que ficou órfão em `lib/briefing/address.ts`**

`addressFromPlaceComponents` e o tipo `PlaceAddressComponentLike` existiam só
para o formato de componentes do Places e agora não têm chamador. Confirme e
remova as duas declarações:

```bash
grep -rn "addressFromPlaceComponents\|PlaceAddressComponentLike" app components lib
```

Esperado depois da remoção: nenhum resultado. **Não** toque em
`parseBrazilianAddress`, `mergeAddress`, `joinBrazilianAddress`,
`emptyParsedAddress`, `looksLikeFullAddress` nem `hydrateStructuredAddress` —
todos continuam em uso, inclusive pelo caminho do CEP, que usa o ViaCEP e nunca
dependeu do Google.

---

## Task 4: Geocoding do mapa de raio

**Files:**
- Modify: `lib/briefing/geocode-address.ts:7,13,98`
- Modify: `app/actions/briefing/geocode-briefing-address.ts:20,78`
- Delete: `lib/places/geocode.ts`
- Modify: `lib/places/index.ts` (remover a linha do geocode)

- [ ] **Step 1: Trocar a origem**

Em `lib/briefing/geocode-address.ts`, troque a linha 7:

```ts
import { geocodeAddressText } from "@/lib/locationiq"
```

E o literal do tipo, linha 13:

```ts
  source: "gbp" | "geocode"
```

E o retorno da linha 98:

```ts
      source: "geocode",
```

`"places"` vira `"geocode"` porque o nome do fornecedor deixou de ser verdade e
o valor não é persistido — o payload do briefing grava `mapLatitude` e
`mapLongitude`, e o `source` vive só no retorno da action. Conferido.

- [ ] **Step 2: Acompanhar o tipo na action**

Em `app/actions/briefing/geocode-briefing-address.ts`, linha 20, troque o
literal do mesmo jeito: `source: "gbp" | "geocode"`.

- [ ] **Step 3: Apagar o geocode antigo**

```bash
rm lib/places/geocode.ts
```

E remova de `lib/places/index.ts` a linha:

```ts
export { geocodeAddressText, type GeocodeCoordinates } from "./geocode"
```

- [ ] **Step 4: Conferir que ninguém mais aponta para lá**

```bash
grep -rn "places/geocode\|GeocodeCoordinates" --include="*.ts" --include="*.tsx" app components lib
```

Esperado: nenhum resultado.

---

## Task 5: MapLibre e os estilos

**Files:**
- Modify: `package.json`
- Create: `lib/maplibre/style.ts`
- Create: `lib/maplibre/index.ts`

**Interfaces:**
- Produces:
  - `getMapTilesKey(): string | null`
  - `mapStyleUrl(theme: "light" | "dark"): string | null`
  - `MAP_STYLE_UNCONFIGURED: string`

- [ ] **Step 1: Instalar**

```bash
pnpm add maplibre-gl && pnpm remove @googlemaps/js-api-loader
```

- [ ] **Step 2: Criar o módulo de estilo**

Crie `lib/maplibre/style.ts`:

```ts
/**
 * Estilo do mapa, por tema.
 *
 * O LocationIQ publica estilos prontos em claro e escuro, e a chave de tile é
 * **diferente** da chave de API: `Maps Access Token` no painel, não `API token`.
 * Trocar uma pela outra devolve 401 num tile e nada no console, então o nome da
 * variável carrega o `MAPS` para o erro ser óbvio.
 */

export const MAP_STYLE_UNCONFIGURED =
  "Mapa não configurado. Defina NEXT_PUBLIC_LOCATIONIQ_MAPS_KEY."

export function getMapTilesKey(): string | null {
  const key = process.env.NEXT_PUBLIC_LOCATIONIQ_MAPS_KEY
  return typeof key === "string" && key.trim().length > 0 ? key.trim() : null
}

export function mapStyleUrl(theme: "light" | "dark"): string | null {
  const key = getMapTilesKey()
  if (!key) return null
  return `https://tiles.locationiq.com/v3/${theme}/vector.json?key=${encodeURIComponent(key)}`
}
```

Crie `lib/maplibre/index.ts`:

```ts
export {
  MAP_STYLE_UNCONFIGURED,
  getMapTilesKey,
  mapStyleUrl,
} from "./style"
```

- [ ] **Step 3: Conferir o estilo no navegador antes de escrever canvas**

Abra a URL impressa por este comando numa aba e confirme que volta JSON, e não
401:

```bash
node -e "
const fs=require('fs');
const env=fs.readFileSync('.env.local','utf8');
const k=env.match(/^NEXT_PUBLIC_LOCATIONIQ_MAPS_KEY=(.*)$/m)?.[1]?.trim();
console.log('https://tiles.locationiq.com/v3/light/vector.json?key='+k)
"
```

Se voltar 401, a chave usada é o *API token* e não o *Maps Access Token*. Se o
caminho `/v3/light/vector.json` der 404, confira o catálogo em
`https://docs.locationiq.com/docs/maps` e ajuste `mapStyleUrl` — **o painel
manda, não este plano.**

---

## Task 6: Mapa do raio de atendimento

**Files:**
- Modify: `components/custom/BriefingServiceRadiusMap/BriefingServiceRadiusMapCanvas.tsx`

- [ ] **Step 1: Trocar o canvas**

Substitua o corpo do componente. O contrato de props em
`BriefingServiceRadiusMap.types.ts` **não muda** — só a implementação.

```tsx
"use client"

import { useEffect, useRef, useState } from "react"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import { RiMapPinLine, RiRefreshLine } from "react-icons/ri"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import { cn } from "cn"
import { SHADCN_PALETTE } from "@/lib/theme/shadcn-palette"
import { MAP_STYLE_UNCONFIGURED, mapStyleUrl } from "@/lib/maplibre"
import type { BriefingServiceRadiusMapProps } from "./BriefingServiceRadiusMap.types"

const CIRCLE_VERTICES = 64
const EARTH_KM = 6371

function readPrimaryColor(): string {
  if (typeof window === "undefined") return SHADCN_PALETTE.light.primary
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue("--primary")
    .trim()
  return value || SHADCN_PALETTE.light.primary
}

function isDarkMode(): boolean {
  return document.documentElement.classList.contains("dark")
}

/**
 * Círculo geodésico em GeoJSON.
 *
 * O `google.maps.Circle` desenhava em metros sobre a projeção; o MapLibre
 * desenha polígono em graus. Um círculo de raio constante em graus vira elipse
 * achatada longe do equador — por isso a longitude é dividida pelo cosseno da
 * latitude, e não só somada.
 */
function circlePolygon(
  latitude: number,
  longitude: number,
  radiusKm: number,
): GeoJSON.Feature<GeoJSON.Polygon> {
  const latDelta = (radiusKm / EARTH_KM) * (180 / Math.PI)
  const lonDelta = latDelta / Math.cos((latitude * Math.PI) / 180)
  const ring: [number, number][] = []
  for (let step = 0; step <= CIRCLE_VERTICES; step += 1) {
    const angle = (step / CIRCLE_VERTICES) * 2 * Math.PI
    ring.push([
      longitude + lonDelta * Math.cos(angle),
      latitude + latDelta * Math.sin(angle),
    ])
  }
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [ring] },
  }
}

function circleBounds(
  latitude: number,
  longitude: number,
  radiusKm: number,
): maplibregl.LngLatBoundsLike {
  const latDelta = (radiusKm / EARTH_KM) * (180 / Math.PI)
  const lonDelta = latDelta / Math.cos((latitude * Math.PI) / 180)
  return [
    [longitude - lonDelta, latitude - latDelta],
    [longitude + lonDelta, latitude + latDelta],
  ]
}

export function BriefingServiceRadiusMapCanvas({
  latitude,
  longitude,
  radiusKm,
  formattedAddress,
  loading = false,
  errorMessage = null,
  onRetry,
  className,
}: BriefingServiceRadiusMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [mapError, setMapError] = useState<string | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || mapRef.current) return

    const style = mapStyleUrl(isDarkMode() ? "dark" : "light")
    if (!style) {
      setMapError(MAP_STYLE_UNCONFIGURED)
      return
    }

    const map = new maplibregl.Map({
      container,
      style,
      center: [longitude, latitude],
      zoom: 11,
      attributionControl: { compact: true },
    })
    mapRef.current = map

    map.on("error", () => setMapError("Não foi possível carregar o mapa."))
    map.on("load", () => {
      const color = readPrimaryColor()
      map.addSource("radius", {
        type: "geojson",
        data: circlePolygon(latitude, longitude, radiusKm),
      })
      map.addLayer({
        id: "radius-fill",
        type: "fill",
        source: "radius",
        paint: { "fill-color": color, "fill-opacity": 0.15 },
      })
      map.addLayer({
        id: "radius-line",
        type: "line",
        source: "radius",
        paint: { "line-color": color, "line-width": 2 },
      })
      new maplibregl.Marker({ color }).setLngLat([longitude, latitude]).addTo(map)
      map.fitBounds(circleBounds(latitude, longitude, radiusKm), { padding: 28 })
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
    // Só na montagem: o reposicionamento tem efeito próprio, abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    const source = map.getSource("radius") as maplibregl.GeoJSONSource | undefined
    if (!source) return
    source.setData(circlePolygon(latitude, longitude, radiusKm))
    map.fitBounds(circleBounds(latitude, longitude, radiusKm), { padding: 28 })
  }, [latitude, longitude, radiusKm])

  const message = mapError ?? errorMessage

  return (
    <div className={cn("relative overflow-hidden rounded-lg", className)}>
      <div ref={containerRef} className="h-full w-full" />
      {loading ? (
        <div className="absolute inset-0 grid place-items-center bg-background/60">
          <Spinner aria-hidden className="size-5" />
        </div>
      ) : null}
      {message ? (
        <div className="absolute inset-0 grid place-items-center gap-2 bg-background/90 p-4 text-center">
          <RiMapPinLine size={20} aria-hidden className="mx-auto text-muted-foreground" />
          <p role="alert" className="text-xs/relaxed text-muted-foreground">
            {message}
          </p>
          {onRetry ? (
            <Button type="button" variant="ghost" onClick={onRetry}>
              <RiRefreshLine size={16} aria-hidden />
              Tentar de novo
            </Button>
          ) : null}
        </div>
      ) : null}
      {formattedAddress ? (
        <p className="absolute inset-x-0 bottom-0 truncate bg-background/85 px-3 py-1.5 text-xs text-muted-foreground">
          {formattedAddress}
        </p>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 2: Conferir a forma real das props antes de dar por pronto**

O bloco acima assume os nomes de prop que o arquivo atual usa. Confirme:

```bash
cat components/custom/BriefingServiceRadiusMap/BriefingServiceRadiusMap.types.ts
```

Se algum nome divergir, use o do arquivo — **o contrato existente manda**, e
mudá-lo quebraria `BriefingServiceRadiusMap.tsx`, que não está neste plano.

---

## Task 7: Mapa da malha geográfica

**Files:**
- Modify: `components/custom/LeadGbpPanel/LeadGbpGridMap.tsx`

- [ ] **Step 1: Preservar as faixas**

`GBP_GRID_BANDS` **não muda**: nem a ordem, nem os rótulos, nem a decisão de
pintar "Falhou" em tom neutro. A ordem importa — vence a primeira que casar — e
a legenda sai da mesma lista. Copie o bloco inteiro do arquivo atual, intocado.

- [ ] **Step 2: Trocar marcadores por camada de círculos**

Substitua a montagem do mapa. Cada ponto vira uma feature com a cor já
resolvida, e a camada lê a cor da propriedade — 121 marcadores DOM seriam 121
nós; uma camada é um desenho só.

```tsx
"use client"

import { useEffect, useRef, useState } from "react"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import { RiMapPinLine } from "react-icons/ri"
import { cn } from "cn"
import { MAP_STYLE_UNCONFIGURED, mapStyleUrl } from "@/lib/maplibre"
import type { GbpGridPoint } from "@/lib/leads/gbp-grid"
import { SHADCN_PALETTE } from "@/lib/theme/shadcn-palette"
import { Spinner } from "@/components/ui/spinner"

// ... GBP_GRID_BANDS copiado do arquivo atual, sem alteração ...

function bandFor(point: GbpGridPoint) {
  return GBP_GRID_BANDS.find((band) => band.match(point)) ?? null
}

function pointsToGeoJson(
  points: readonly GbpGridPoint[],
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: points.map((point) => ({
      type: "Feature",
      properties: {
        color: bandFor(point)?.color ?? SHADCN_PALETTE.light.mutedForeground,
        label: point.position === null ? "—" : String(point.position),
      },
      geometry: {
        type: "Point",
        coordinates: [point.longitude, point.latitude],
      },
    })),
  }
}

function boundsOf(points: readonly GbpGridPoint[]): maplibregl.LngLatBounds | null {
  if (points.length === 0) return null
  const bounds = new maplibregl.LngLatBounds()
  for (const point of points) bounds.extend([point.longitude, point.latitude])
  return bounds
}
```

E, dentro do efeito de montagem, no `map.on("load")`:

```tsx
      map.addSource("grid", { type: "geojson", data: pointsToGeoJson(points) })
      map.addLayer({
        id: "grid-circles",
        type: "circle",
        source: "grid",
        paint: {
          "circle-radius": 13,
          "circle-color": ["get", "color"],
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#ffffff",
        },
      })
      map.addLayer({
        id: "grid-labels",
        type: "symbol",
        source: "grid",
        layout: {
          "text-field": ["get", "label"],
          "text-size": 11,
          "text-allow-overlap": true,
        },
        paint: { "text-color": "#ffffff" },
      })
      const bounds = boundsOf(points)
      if (bounds) map.fitBounds(bounds, { padding: 32 })
```

Mantenha o estado de erro, o `Spinner` e a legenda do arquivo atual.

- [ ] **Step 3: Conferir os nomes dos campos do ponto**

```bash
grep -n "export type GbpGridPoint" -A 15 lib/leads/gbp-grid.ts
```

Se `latitude`, `longitude`, `position` ou `status` tiverem outro nome, use o
real.

---

## Task 8: Bateria de verificação

- [ ] **Step 1: Tipos, lint, testes, formatação**

```bash
npx tsc --noEmit
```

```bash
npm run lint
```

```bash
npm test
```

```bash
npm run format:check
```

Erro em arquivo que não está na tabela de estrutura deste plano não é
necessariamente seu — a árvore é compartilhada com outras sessões. Confira
`git status` e atribua antes de tocar.

- [ ] **Step 2: Conferir que o Google sumiu do briefing e do mapa**

```bash
grep -rn "@/lib/google-maps\|googlemaps\|places.googleapis" app components lib
```

Esperado: nenhum resultado. O que restar em `lib/places/client.ts` sai na onda
5, no plano `2026-09-15-migracao-dataforseo-lighthouse.md`.

- [ ] **Step 3: Verificação visual**

O app exige sessão. Peça o login ao dono do repositório antes de abrir a tela.

1. No briefing, campo de endereço: digitar três letras e conferir que a lista
   aparece; selecionar e conferir que rua, número, bairro, cidade, **UF** e CEP
   preenchem. A UF é o ponto frágil — o LocationIQ devolve o nome do estado por
   extenso, e a conversão para sigla é a Task 3, Step 4.
2. Na etapa de público, definir o raio e conferir que o círculo aparece
   centrado no endereço, em tema claro **e** escuro.
3. Num lead com malha coletada, abrir a malha e conferir que os pontos aparecem
   com as mesmas cores de antes e que a legenda casa com o mapa.
