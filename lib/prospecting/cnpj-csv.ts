import {
  CNPJ_RESEARCH_CSV_COLUMNS,
  CnpjCsvError,
  type CnpjCsvRow,
} from "./cnpj-files"

const MAX_CSV_FIELD_LENGTH = 4096

async function* byteChunks(
  source: AsyncIterable<Uint8Array> | ReadableStream<Uint8Array>,
): AsyncIterable<Uint8Array> {
  if (Symbol.asyncIterator in source) {
    yield* source
    return
  }

  const reader = source.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) return
      yield value
    }
  } finally {
    reader.releaseLock()
  }
}

export async function* parseCnpjResearchCsv(
  source: AsyncIterable<Uint8Array> | ReadableStream<Uint8Array>,
): AsyncIterable<CnpjCsvRow> {
  const decoder = new TextDecoder("utf-8", { fatal: true })
  let headerSeen = false
  let recordNumber = 1
  let fields: string[] = []
  let field = ""
  let fieldStarted = false
  let insideQuotes = false
  let closingQuotePending = false
  let afterQuote = false
  let carriageReturnPending = false
  let firstCharacter = true

  const pushField = () => {
    fields.push(field)
    field = ""
    fieldStarted = false
    afterQuote = false
  }

  const finishRecord = (): CnpjCsvRow | null => {
    pushField()
    const record = fields
    fields = []
    const currentRecordNumber = recordNumber
    recordNumber += 1

    if (!headerSeen) {
      headerSeen = true
      if (
        record.length !== CNPJ_RESEARCH_CSV_COLUMNS.length ||
        record.some((column, index) => column !== CNPJ_RESEARCH_CSV_COLUMNS[index])
      ) {
        throw new CnpjCsvError(
          `O cabeçalho deve conter exatamente estas colunas, nesta ordem: ${CNPJ_RESEARCH_CSV_COLUMNS.join(",")}.`,
          currentRecordNumber,
        )
      }
      return null
    }

    if (record.length !== CNPJ_RESEARCH_CSV_COLUMNS.length) {
      throw new CnpjCsvError(
        `Esperadas ${CNPJ_RESEARCH_CSV_COLUMNS.length} colunas; encontradas ${record.length}.`,
        currentRecordNumber,
      )
    }
    return Object.fromEntries(
      CNPJ_RESEARCH_CSV_COLUMNS.map((column, index) => [column, record[index] ?? ""]),
    ) as CnpjCsvRow
  }

  const consume = (character: string): CnpjCsvRow | null | undefined => {
    if (firstCharacter) {
      firstCharacter = false
      if (character === "\uFEFF") return undefined
    }

    if (carriageReturnPending) {
      if (character !== "\n") {
        throw new CnpjCsvError("Use CRLF ou LF para separar as linhas.", recordNumber)
      }
      carriageReturnPending = false
      return finishRecord()
    }

    if (closingQuotePending) {
      closingQuotePending = false
      if (character === '"') {
        field += '"'
        if (field.length > MAX_CSV_FIELD_LENGTH) {
          throw new CnpjCsvError(`Uma célula excede ${MAX_CSV_FIELD_LENGTH} caracteres.`, recordNumber)
        }
        return undefined
      }
      insideQuotes = false
      afterQuote = true
    }

    if (insideQuotes) {
      if (character === '"') {
        closingQuotePending = true
      } else {
        field += character
        if (field.length > MAX_CSV_FIELD_LENGTH) {
          throw new CnpjCsvError(`Uma célula excede ${MAX_CSV_FIELD_LENGTH} caracteres.`, recordNumber)
        }
      }
      return undefined
    }

    if (afterQuote && character !== "," && character !== "\r" && character !== "\n") {
      throw new CnpjCsvError("Há conteúdo após o fechamento de aspas.", recordNumber)
    }

    if (character === '"') {
      if (fieldStarted || field.length > 0) {
        throw new CnpjCsvError("Aspas inesperadas em uma célula sem aspas.", recordNumber)
      }
      fieldStarted = true
      insideQuotes = true
      return undefined
    }
    if (character === ",") {
      pushField()
      return undefined
    }
    if (character === "\r") {
      carriageReturnPending = true
      return undefined
    }
    if (character === "\n") return finishRecord()

    fieldStarted = true
    field += character
    if (field.length > MAX_CSV_FIELD_LENGTH) {
      throw new CnpjCsvError(`Uma célula excede ${MAX_CSV_FIELD_LENGTH} caracteres.`, recordNumber)
    }
    return undefined
  }

  try {
    for await (const bytes of byteChunks(source)) {
      const decoded = decoder.decode(bytes, { stream: true })
      for (const character of decoded) {
        const row = consume(character)
        if (row) yield row
      }
    }
    const tail = decoder.decode()
    for (const character of tail) {
      const row = consume(character)
      if (row) yield row
    }
  } catch (error) {
    if (error instanceof CnpjCsvError) throw error
    throw new CnpjCsvError("O arquivo não está codificado corretamente em UTF-8.", recordNumber)
  }

  if (carriageReturnPending) {
    throw new CnpjCsvError("A última linha termina com um CR sem LF.", recordNumber)
  }
  if (closingQuotePending) {
    closingQuotePending = false
    insideQuotes = false
    afterQuote = true
  }
  if (insideQuotes) {
    throw new CnpjCsvError("Há uma célula com aspas não fechadas.", recordNumber)
  }
  if (fields.length > 0 || fieldStarted || field.length > 0 || afterQuote) {
    const row = finishRecord()
    if (row) yield row
  }
  if (!headerSeen) throw new CnpjCsvError("O arquivo está vazio ou não contém cabeçalho.", 1)
}
