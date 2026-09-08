import "server-only"

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer"
import { formatDateTimeShort } from "@/lib/date-time"
import { SHADCN_PALETTE } from "@/lib/theme/shadcn-palette"
import {
  DIAGNOSIS_PILLAR_LABELS,
  DIAGNOSIS_PILLARS,
  type DiagnosisDocument,
  type DiagnosisPillar,
} from "@/lib/leads/diagnosis-document"

const colors = {
  accent: SHADCN_PALETTE.light.primary,
  accentSubtle: SHADCN_PALETTE.light.accent,
  ink: SHADCN_PALETTE.light.foreground,
  muted: SHADCN_PALETTE.light.mutedForeground,
  secondary: SHADCN_PALETTE.light.secondaryForeground,
  border: SHADCN_PALETTE.light.border,
  canvas: SHADCN_PALETTE.light.background,
  white: SHADCN_PALETTE.light.background,
  onPrimary: SHADCN_PALETTE.light.primaryForeground,
  warning: SHADCN_PALETTE.light.chart[2],
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 48,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: colors.ink,
    backgroundColor: colors.white,
  },
  coverBand: {
    backgroundColor: colors.accent,
    marginHorizontal: -48,
    marginTop: -48,
    paddingHorizontal: 48,
    paddingTop: 56,
    paddingBottom: 36,
    marginBottom: 28,
  },
  brand: {
    color: colors.onPrimary,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 18,
  },
  coverTitle: {
    color: colors.onPrimary,
    fontSize: 26,
    fontFamily: "Helvetica-Bold",
    marginBottom: 8,
  },
  coverSub: {
    color: colors.accentSubtle,
    fontSize: 11,
    lineHeight: 1.5,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: colors.accent,
    marginBottom: 10,
    marginTop: 18,
  },
  body: {
    fontSize: 10,
    lineHeight: 1.55,
    color: colors.secondary,
  },
  hook: {
    backgroundColor: colors.accentSubtle,
    borderRadius: 6,
    padding: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  scoreRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  scoreCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    padding: 10,
    backgroundColor: colors.canvas,
  },
  scoreValue: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: colors.accent,
    marginBottom: 2,
  },
  scoreLabel: {
    fontSize: 8,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  scoreMeta: {
    fontSize: 8,
    color: colors.secondary,
    marginTop: 4,
  },
  finding: {
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  findingTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    marginBottom: 3,
  },
  roadmapItem: {
    flexDirection: "row",
    marginBottom: 8,
    gap: 8,
  },
  impact: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: colors.warning,
    width: 54,
  },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: colors.muted,
  },
  pillarBlock: {
    marginBottom: 14,
  },
  metricRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
    marginBottom: 6,
  },
  metricChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  listItem: {
    marginBottom: 3,
    color: colors.secondary,
  },
})

function Scorecard({ document }: { document: DiagnosisDocument }) {
  return (
    <View style={styles.scoreRow}>
      {DIAGNOSIS_PILLARS.map((pillar) => {
        const cell = document.facts.scorecard[pillar]
        return (
          <View key={pillar} style={styles.scoreCard}>
            <Text style={styles.scoreValue}>{cell.score}</Text>
            <Text style={styles.scoreLabel}>
              {DIAGNOSIS_PILLAR_LABELS[pillar]}
            </Text>
            <Text style={styles.scoreMeta}>
              {cell.highCount + cell.mediumCount === 0
                ? "Sem alertas"
                : `${cell.highCount} altos · ${cell.mediumCount} médios`}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

function PillarSection({
  document,
  pillar,
}: {
  document: DiagnosisDocument
  pillar: DiagnosisPillar
}) {
  const facts = document.facts.pillars[pillar]
  const narrative = document.prose.pillarNarratives[pillar]
  return (
    <View style={styles.pillarBlock} wrap={false}>
      <Text style={styles.sectionTitle}>{DIAGNOSIS_PILLAR_LABELS[pillar]}</Text>
      {narrative ? <Text style={styles.body}>{narrative}</Text> : null}
      {facts.keyMetrics.length > 0 ? (
        <View style={styles.metricRow}>
          {facts.keyMetrics.map((item) => (
            <View key={item.id} style={styles.metricChip}>
              <Text style={{ fontSize: 8, color: colors.muted }}>
                {item.label}
              </Text>
              <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold" }}>
                {item.value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {facts.opportunities.slice(0, 6).map((item) => (
        <Text key={item.id} style={styles.listItem}>
          • {item.title}
          {item.impact === "high" ? " (alto impacto)" : ""}
        </Text>
      ))}
      {facts.opportunities.length === 0 ? (
        <Text style={styles.body}>Nenhum ponto crítico neste pilar.</Text>
      ) : null}
    </View>
  )
}

function DiagnosisPdfDocument({ document }: { document: DiagnosisDocument }) {
  const generated = formatDateTimeShort(document.meta.generatedAt)
  const place = document.meta.city ? ` · ${document.meta.city}` : ""

  return (
    <Document
      title={`Diagnóstico — ${document.meta.companyName}`}
      author="Rankup Suite"
      subject="Diagnóstico digital"
      language="pt-BR"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.coverBand}>
          <Text style={styles.brand}>Rankup · Diagnóstico digital</Text>
          <Text style={styles.coverTitle}>{document.meta.companyName}</Text>
          <Text style={styles.coverSub}>
            {document.meta.domain}
            {place}
            {"\n"}
            Gerado em {generated}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Resumo executivo</Text>
        <Text style={styles.body}>{document.prose.executiveSummary}</Text>
        {document.prose.commercialHook ? (
          <View style={styles.hook}>
            <Text style={styles.body}>{document.prose.commercialHook}</Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Scorecard</Text>
        <Scorecard document={document} />

        {document.facts.findings.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Achados prioritários</Text>
            {document.facts.findings.map((item) => (
              <View key={item.id} style={styles.finding}>
                <Text style={styles.findingTitle}>{item.title}</Text>
                <Text style={styles.body}>{item.detail}</Text>
              </View>
            ))}
          </>
        ) : null}

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `Rankup Suite · Confidencial · ${pageNumber}/${totalPages}`
          }
          fixed
        />
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Roadmap recomendado</Text>
        {document.facts.roadmap.length === 0 ? (
          <Text style={styles.body}>Nenhum item prioritário nesta coleta.</Text>
        ) : (
          document.facts.roadmap.map((item) => (
            <View key={item.id} style={styles.roadmapItem}>
              <Text style={styles.impact}>
                {item.impact === "high" ? "ALTO" : "MÉDIO"}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.findingTitle}>{item.title}</Text>
                <Text style={styles.body}>
                  {DIAGNOSIS_PILLAR_LABELS[item.pillar]} · {item.evidence}
                </Text>
              </View>
            </View>
          ))
        )}

        {DIAGNOSIS_PILLARS.map((pillar) => (
          <PillarSection key={pillar} document={document} pillar={pillar} />
        ))}

        <Text style={styles.sectionTitle}>Limitações da coleta</Text>
        {document.limitations.map((line) => (
          <Text key={line} style={styles.listItem}>
            • {line}
          </Text>
        ))}

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `Rankup Suite · Confidencial · ${pageNumber}/${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  )
}

export async function renderDiagnosisPdfBuffer(
  document: DiagnosisDocument,
): Promise<Buffer> {
  const instance = pdf(<DiagnosisPdfDocument document={document} />)
  const result = await instance.toBuffer()
  if (Buffer.isBuffer(result)) return result
  const chunks: Buffer[] = []
  for await (const chunk of result as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}
