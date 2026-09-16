import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import {
  gbpBusinessStatusFromDataForSeo,
  gbpWeekdayDescriptions,
  snapshotFromBusinessInfo,
} from "./gbp-business-info-map.ts"

/**
 * Item real de `business_data/google/my_business_info/live`, colhido em
 * 2026-09-15. É a única chamada da coleta que produz snapshot e enrichment
 * juntos, então é ela que sustenta a etapa única.
 */
const FIXTURE = JSON.parse(
  readFileSync(
    new URL("./gbp-business-info.fixture.json", import.meta.url),
    "utf8",
  ),
)

test("o snapshot sai completo do item real", () => {
  const snapshot = snapshotFromBusinessInfo(FIXTURE)
  assert.equal(snapshot.placeId, "ChIJkchU8A1ZzpQR99LmKcm-kT0")
  assert.equal(snapshot.displayName, "Funerária Benttus")
  assert.equal(snapshot.primaryTypeDisplayName, "Casa funerária")
  assert.deepEqual(snapshot.types, ["funeral_home"])
  assert.equal(snapshot.primaryType, "funeral_home")
  assert.equal(snapshot.websiteDomain, "grupofunerariabenttus.com.br")
  assert.equal(snapshot.rating, 4.7)
  assert.equal(snapshot.userRatingCount, 401)
  assert.equal(snapshot.latitude, -23.5649348)
  assert.equal(snapshot.longitude, -46.6528995)
})

test("acha o status no caminho aninhado do my_business_info", () => {
  // A trava do achado da onda 0: `current_status` mora em
  // `work_time.work_hours`, e não em `work_time`. Lido no caminho da
  // documentação isto seria null, o gap `closed` morreria em silêncio e a tela
  // nunca diria "Em operação".
  assert.equal(snapshotFromBusinessInfo(FIXTURE).businessStatus, "OPERATIONAL")
})

test("acha o status na raiz, como vem no item do Maps", () => {
  const snapshot = snapshotFromBusinessInfo({
    place_id: "ChIJabc",
    title: "Alvo",
    work_hours: { current_status: "open" },
  })
  assert.equal(snapshot.businessStatus, "OPERATIONAL")
})

test("sem check_url o link do mapa é montado pelo cid", () => {
  assert.equal(
    snapshotFromBusinessInfo(FIXTURE).googleMapsUri,
    "https://www.google.com/maps?cid=4436536879137346295",
  )
})

test("com check_url, é ele que vale", () => {
  const snapshot = snapshotFromBusinessInfo({
    place_id: "ChIJabc",
    title: "Alvo",
    cid: "123",
    check_url: "https://www.google.com/maps/search/?q=alvo",
  })
  assert.equal(snapshot.googleMapsUri, "https://www.google.com/maps/search/?q=alvo")
})

test("item sem place_id não vira snapshot", () => {
  assert.equal(snapshotFromBusinessInfo({ title: "Sem id" }), null)
})

test("photoNames sai vazio e photoCount vem de total_photos", () => {
  const snapshot = snapshotFromBusinessInfo(FIXTURE)
  assert.deepEqual(snapshot.photoNames, [])
  assert.equal(snapshot.photoCount, 101)
})

test("sem total_photos a contagem é zero, não nula", () => {
  const snapshot = snapshotFromBusinessInfo({
    place_id: "ChIJabc",
    title: "Alvo",
  })
  assert.equal(snapshot.photoCount, 0)
})

test("o status é traduzido para o vocabulário do Google", () => {
  // Medido minúsculo em 2026-09-15: o fornecedor manda "open", não "OPEN".
  assert.equal(gbpBusinessStatusFromDataForSeo("open"), "OPERATIONAL")
  assert.equal(gbpBusinessStatusFromDataForSeo("OPEN"), "OPERATIONAL")
  assert.equal(
    gbpBusinessStatusFromDataForSeo("temporarily_closed"),
    "CLOSED_TEMPORARILY",
  )
  assert.equal(
    gbpBusinessStatusFromDataForSeo("permanently_closed"),
    "CLOSED_PERMANENTLY",
  )
})

test("fechado agora não é empresa fechada", () => {
  // `close` significa "fechado neste momento". Virar CLOSED_* faria toda
  // auditoria noturna acusar encerramento de atividade.
  assert.equal(gbpBusinessStatusFromDataForSeo("close"), "OPERATIONAL")
})

test("status desconhecido vira null, e não um CLOSED inventado", () => {
  assert.equal(gbpBusinessStatusFromDataForSeo("qualquer_coisa"), null)
  assert.equal(gbpBusinessStatusFromDataForSeo(undefined), null)
})

test("o horário real da fixture vira sete linhas de 24 horas", () => {
  // A Benttus abre 24h todos os dias. Os casos de dia fechado e de dois turnos
  // não existem nela, e por isso são sintéticos, abaixo.
  const linhas = snapshotFromBusinessInfo(FIXTURE).weekdayDescriptions
  assert.equal(linhas.length, 7)
  assert.equal(linhas[0], "segunda-feira: Aberto 24 horas")
  assert.equal(linhas.at(-1), "domingo: Aberto 24 horas")
})

test("o horário comum vira uma linha por dia, na ordem da semana", () => {
  const linhas = gbpWeekdayDescriptions({
    timetable: {
      monday: [{ open: { hour: 8, minute: 0 }, close: { hour: 18, minute: 30 } }],
      sunday: null,
    },
  })
  assert.equal(linhas[0], "segunda-feira: 08:00 – 18:30")
  assert.equal(linhas.at(-1), "domingo: Fechado")
})

test("dois turnos no mesmo dia viram uma linha só", () => {
  const linhas = gbpWeekdayDescriptions({
    timetable: {
      tuesday: [
        { open: { hour: 8, minute: 0 }, close: { hour: 12, minute: 0 } },
        { open: { hour: 14, minute: 0 }, close: { hour: 18, minute: 0 } },
      ],
    },
  })
  assert.equal(
    linhas.find((linha) => linha.startsWith("terça")),
    "terça-feira: 08:00 – 12:00, 14:00 – 18:00",
  )
})

test("sem timetable não inventa horário", () => {
  // Sete linhas de "Fechado" esconderiam o gap `missing_hours`, que existe para
  // perfil que não publicou horário nenhum.
  assert.deepEqual(gbpWeekdayDescriptions(null), [])
  assert.deepEqual(gbpWeekdayDescriptions({}), [])
})
