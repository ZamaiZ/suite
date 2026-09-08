import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  readTaskGetEnvelope,
  readTaskPostEnvelope,
  readTasksReadyEnvelope,
} from "./envelope.ts"

const ERROR = "erro genérico"

/**
 * Envelopes copiados da documentação do DataForSEO. O formato é o contrato
 * externo: quando ele foi lido errado, 121 buscas pagas viraram lixo em
 * silêncio, então cada campo relevante tem teste.
 */

describe("readTaskPostEnvelope", () => {
  it("lê o tag de tasks[i].data.tag, e não do nível da task", () => {
    const body = {
      status_code: 20000,
      cost: 0.1,
      tasks: [
        {
          id: "11141653-0696-0066-0000-dd1e3c01884b",
          status_code: 20100,
          status_message: "Task Created.",
          cost: 0.05,
          data: { tag: "scan-1:0:0", keyword: "seo local" },
          result: null,
        },
      ],
    }

    const read = readTaskPostEnvelope(body, ERROR)

    assert.equal(read.status, "ok")
    assert.deepEqual(read.created, [
      {
        index: 0,
        id: "11141653-0696-0066-0000-dd1e3c01884b",
        tag: "scan-1:0:0",
      },
    ])
    assert.deepEqual(read.rejected, [])
    assert.equal(read.cost, 0.1)
  })

  it("não confunde um tag no nível da task com o tag real", () => {
    const body = {
      status_code: 20000,
      cost: 0.05,
      tasks: [
        {
          id: "task-1",
          status_code: 20100,
          // Onde o código antigo procurava. A API nunca põe o tag aqui.
          tag: "scan-1:9:9",
          data: { keyword: "seo local" },
        },
      ],
    }

    const read = readTaskPostEnvelope(body, ERROR)

    assert.equal(read.status, "ok")
    assert.equal(read.created[0].tag, null)
    assert.equal(read.created[0].index, 0)
  })

  it("reporta a task recusada com o código e a mensagem da API", () => {
    const body = {
      status_code: 20000,
      cost: 0.05,
      tasks: [
        {
          id: "task-1",
          status_code: 20100,
          data: { tag: "scan-1:0:0" },
        },
        {
          id: "task-2",
          status_code: 40501,
          status_message: "Invalid Field: 'location_coordinate'.",
          data: { tag: "scan-1:0:1" },
        },
      ],
    }

    const read = readTaskPostEnvelope(body, ERROR)

    assert.equal(read.status, "ok")
    assert.equal(read.created.length, 1)
    assert.deepEqual(read.rejected, [
      {
        index: 1,
        code: 40501,
        message: "Invalid Field: 'location_coordinate'.",
        tag: "scan-1:0:1",
      },
    ])
  })

  it("erra quando nenhuma task foi criada, usando a mensagem da API", () => {
    const body = {
      status_code: 20000,
      tasks: [
        {
          id: "task-1",
          status_code: 40501,
          status_message: "Invalid Field: 'keyword'.",
          data: { tag: "scan-1:0:0" },
        },
      ],
    }

    const read = readTaskPostEnvelope(body, ERROR)

    assert.equal(read.status, "error")
    assert.equal(read.message, "Invalid Field: 'keyword'.")
  })

  it("erra quando o envelope não está em 20000", () => {
    const read = readTaskPostEnvelope(
      { status_code: 40200, status_message: "Payment Required." },
      ERROR,
    )

    assert.equal(read.status, "error")
    assert.equal(read.message, ERROR)
  })
})

describe("readTaskGetEnvelope", () => {
  it("trata 40602 Task In Queue como espera, não como falha", () => {
    const read = readTaskGetEnvelope(
      {
        status_code: 20000,
        tasks_error: 1,
        tasks: [
          {
            id: "task-1",
            status_code: 40602,
            status_message: "Task In Queue.",
            result: null,
          },
        ],
      },
      ERROR,
    )

    assert.equal(read.status, "pending")
  })

  it("trata 40601 Task Handed como espera", () => {
    const read = readTaskGetEnvelope(
      {
        status_code: 20000,
        tasks: [{ id: "task-1", status_code: 40601, result: null }],
      },
      ERROR,
    )

    assert.equal(read.status, "pending")
  })

  it("separa resultado ausente de resultado coletado", () => {
    const read = readTaskGetEnvelope(
      {
        status_code: 20000,
        cost: 0,
        tasks: [{ id: "task-1", status_code: 20000, result: null }],
      },
      ERROR,
    )

    assert.equal(read.status, "empty")
    assert.equal(read.cost, 0)
  })

  it("devolve o primeiro resultado quando a tarefa está pronta", () => {
    const read = readTaskGetEnvelope(
      {
        status_code: 20000,
        cost: 0,
        tasks: [
          {
            id: "task-1",
            status_code: 20000,
            result: [
              {
                keyword: "seo local",
                items: [
                  { rank_absolute: 1, title: "Agência A", place_id: "ChIJa" },
                ],
              },
            ],
          },
        ],
      },
      ERROR,
    )

    assert.equal(read.status, "ok")
    assert.equal(read.data.items[0].place_id, "ChIJa")
  })

  it("propaga o código quando a tarefa falhou de verdade", () => {
    const read = readTaskGetEnvelope(
      {
        status_code: 20000,
        tasks: [
          {
            id: "task-1",
            status_code: 40102,
            status_message: "Task not found.",
          },
        ],
      },
      ERROR,
    )

    assert.equal(read.status, "error")
    assert.equal(read.code, 40102)
    assert.equal(read.message, "Task not found.")
  })

  it("reconhece a espera anunciada no próprio envelope", () => {
    const read = readTaskGetEnvelope({ status_code: 40602 }, ERROR)

    assert.equal(read.status, "pending")
  })
})

describe("readTasksReadyEnvelope", () => {
  it("lê a lista de tarefas prontas com id e tag", () => {
    const read = readTasksReadyEnvelope(
      {
        status_code: 20000,
        tasks: [
          {
            id: "wrapper",
            status_code: 20000,
            result: [
              {
                id: "task-1",
                se: "google",
                se_type: "maps",
                date_posted: "2026-09-07 01:53:43 +00:00",
                tag: "scan-1:0:0",
                endpoint_advanced: "/v3/serp/google/maps/task_get/advanced/task-1",
              },
              { id: "task-2", tag: null },
            ],
          },
        ],
      },
      ERROR,
    )

    assert.equal(read.status, "ok")
    assert.deepEqual(read.tasks, [
      { id: "task-1", tag: "scan-1:0:0" },
      { id: "task-2", tag: null },
    ])
  })

  it("trata lista vazia como sucesso sem tarefas", () => {
    const read = readTasksReadyEnvelope(
      {
        status_code: 20000,
        tasks: [{ id: "wrapper", status_code: 20000, result: null }],
      },
      ERROR,
    )

    assert.equal(read.status, "ok")
    assert.deepEqual(read.tasks, [])
  })
})
